"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var WebSocket = require("ws");
var events_1 = require("events");
var apicrypto = require("./apicrypto");
var RemootioDevice = /** @class */ (function (_super) {
    __extends(RemootioDevice, _super);
    /**
     * Constructor to create a RemootioDevice instance. You should create one instance per Remootio device you have.
     * @param {string} DeviceIp - ip address of the device (as seen in the Remootio app) e.g. "192.168.1.155"
     * @param {string} ApiSecretKey - API Secret Key of the device (as seen in the Remootio app). It is a hexstring representing a 256 bit long value e.g. "12b3f03211c384736b8a1906635f4abc90074e680138a689caf03485a971efb3"
     * @param {string} ApiAuthKey - API Auth Key of the device (as seen in the Remootio app). It is a hexstring representing a 256 bit long value e.g. "74ca13b56b3c898670a67e8f36f8b8a61340738c82617ba1398ae7ca62f1670a"
     * @param {number} [sendPingMessageEveryXMs=60000] - the API client sends a ping frame to the Remootio device every sendPingMessageEveryXMs milliseconds to keep the connection alive. Remootio closes the connection if no message is received for 120 seconds. If no message is received from Remootio within (sendPingMessageEveryXMs/2) milliseconds after PING frame is sent the API client considers the connection to be broken and closes it. It's not recommended to set sendPingMessageEveryXMs below 10000 (10 seconds).
     */
    function RemootioDevice(DeviceIp, ApiSecretKey, ApiAuthKey, sendPingMessageEveryXMs) {
        var _this = _super.call(this) || this;
        //Input check
        var hexstringRe = /[0-9A-Fa-f]{64}/g;
        if (!hexstringRe.test(ApiSecretKey)) {
            console.error('ApiSecretKey must be a hexstring representing a 256bit long byteArray');
        }
        hexstringRe = /[0-9A-Fa-f]{64}/g;
        if (!hexstringRe.test(ApiAuthKey)) {
            console.error('ApiAuthKey must be a hexstring representing a 256bit long byteArray');
        }
        //Set config
        _this.apiSecretKey = ApiSecretKey;
        _this.apiAuthKey = ApiAuthKey;
        _this.deviceIp = DeviceIp;
        _this.websocketClient = undefined;
        //Session related data - will be filled out by the code
        _this.apiSessionKey = undefined; //base64 encoded
        _this.lastActionId = undefined;
        _this.autoReconnect = false; //Reconnect automatically if connection is lost
        _this.port = 8080;
        if (sendPingMessageEveryXMs) {
            _this.sendPingMessageEveryXMs = sendPingMessageEveryXMs; //in ms , send a ping message every PingMessagePeriodicity time, a PONG reply is expected
        }
        else {
            _this.sendPingMessageEveryXMs = 60000;
        }
        _this.sendPingMessageIntervalHandle = undefined; //we fire up a setInterval upon connection to the device to send ping messages every x seconds
        _this.pingReplyTimeoutXMs = _this.sendPingMessageEveryXMs / 2; //in ms, if a PONG frame (or any other frame) doesn't arrive pingReplyTimeoutXMs milliseconds after we send a PING frame, we assume the connection is broken
        _this.pingReplyTimeoutHandle = undefined; //We check for pong response for all our ping messages, if they don't arrive we assume the connection is broken and close it
        _this.waitingForAuthenticationQueryActionResponse = false; //needed to emit the 'authenticated' even on the successful response to the QUERY action sent in the authentication flow
        return _this;
    }
    /**
     * Connect to the Remootio device's websocket API
     * @param {boolean} autoReconnect - If autoReconnect is true, the API client will try to reconnect to the device everytime the connection is lost (recommended)
     * @param {number} port - The port that the device is listening to
     */
    RemootioDevice.prototype.connect = function (autoReconnect, port) {
        var _this = this;
        if (autoReconnect == true) {
            this.autoReconnect = true;
        }
        if (port) {
            this.port = port;
        }
        //Set session data to NULL
        this.apiSessionKey = undefined;
        this.lastActionId = undefined;
        this.waitingForAuthenticationQueryActionResponse = undefined;
        //We connect to the API
        this.websocketClient = new WebSocket('ws://' + this.deviceIp + ':' + this.port.toString() + '/');
        this.emit('connecting');
        this.websocketClient.on('open', function () {
            _this.emit('connected');
            //We send a ping message every 60 seconds to keep the connection alive
            //If the Remootio API gets no message for 120 seconds, it closes the connection
            _this.sendPingMessageIntervalHandle = setInterval(function () {
                var _a;
                if (((_a = _this.websocketClient) === null || _a === void 0 ? void 0 : _a.readyState) == WebSocket.OPEN) {
                    //Create a timeout that is cleared once a PONG message is received - if it doesn't arrive, we assume the connection is broken
                    _this.pingReplyTimeoutHandle = setTimeout(function () {
                        _this.emit('error', 'No response for PING message in ' + _this.pingReplyTimeoutXMs + ' ms. Connection is broken.');
                        if (_this.websocketClient) {
                            _this.websocketClient.terminate();
                            _this.pingReplyTimeoutHandle = undefined;
                        }
                    }, _this.pingReplyTimeoutXMs);
                    _this.sendPing();
                }
            }, _this.sendPingMessageEveryXMs);
        });
        this.websocketClient.on('message', function (data) {
            try {
                //We process the messsage received from the API
                var rcvMsgJson = JSON.parse(data.toString()); //It must be JSON format
                //If we get any reply after our PING message (not only PONG) we clear the pingReplyTimeout
                if (_this.pingReplyTimeoutHandle != undefined) {
                    clearTimeout(_this.pingReplyTimeoutHandle);
                    _this.pingReplyTimeoutHandle = undefined;
                }
                //we process the incoming frames
                if (rcvMsgJson && rcvMsgJson.type == 'ENCRYPTED') {
                    //if it's an encrypted frame we decrypt it and then this.emit the event
                    var decryptedPayload = apicrypto.remootioApiDecryptEncrypedFrame(rcvMsgJson, _this.apiSecretKey, _this.apiAuthKey, _this.apiSessionKey);
                    //we this.emit the encrypted frames with decrypted payload
                    _this.emit('incomingmessage', rcvMsgJson, decryptedPayload);
                    if (decryptedPayload != undefined) {
                        if ('challenge' in decryptedPayload) {
                            //If it's an auth challenge
                            //It's a challenge message
                            _this.apiSessionKey = decryptedPayload.challenge.sessionKey; //we update the session key
                            _this.lastActionId = decryptedPayload.challenge.initialActionId; //and the actionId (frame counter for actions)
                            _this.waitingForAuthenticationQueryActionResponse = true;
                            _this.sendQuery();
                        }
                        if ('response' in decryptedPayload && decryptedPayload.response.id != undefined) {
                            //If we get a response to one of our actions, we incremenet the last action id
                            if (_this.lastActionId != undefined) {
                                if (_this.lastActionId < decryptedPayload.response.id || //But we only increment if the response.id is greater than the current counter value
                                    (decryptedPayload.response.id == 0 && _this.lastActionId == 0x7fffffff)) {
                                    //or when we overflow from 0x7FFFFFFF to 0
                                    _this.lastActionId = decryptedPayload.response.id; //We update the lastActionId
                                }
                            }
                            else {
                                console.warn('Unexpected error - lastActionId is undefined');
                            }
                            //if it's the response to our QUERY action sent during the authentication flow the 'authenticated' event should be emitted
                            if (decryptedPayload.response.type == 'QUERY' &&
                                _this.waitingForAuthenticationQueryActionResponse == true) {
                                _this.waitingForAuthenticationQueryActionResponse = false;
                                _this.emit('authenticated');
                            }
                        }
                    }
                    else {
                        _this.emit('error', 'Authentication or encryption error');
                    }
                }
                else {
                    //we this.emit the normal frames
                    _this.emit('incomingmessage', rcvMsgJson, undefined);
                }
            }
            catch (e) {
                _this.emit('error', e);
            }
        });
        this.websocketClient.on('close', function () {
            //Clear the ping message interval if the connection is lost
            if (_this.sendPingMessageIntervalHandle != undefined) {
                clearInterval(_this.sendPingMessageIntervalHandle);
                _this.sendPingMessageIntervalHandle = undefined;
            }
            if (_this.autoReconnect == true) {
                _this.connect(_this.autoReconnect, _this.port);
            }
            _this.emit('disconnect');
        });
        this.websocketClient.on('error', function () {
            //Connection error
        });
    };
    /**
     * Disconnect from the Remootio device's websocket API
     * it sents autoConnect to false, so even if you have enabled it in your connect method it will not reconnect automatically.
     */
    RemootioDevice.prototype.disconnect = function () {
        if (this.websocketClient != undefined) {
            this.autoReconnect = false; //We disable autoreconnect if we disconnect due to user will
            this.websocketClient.close();
        }
    };
    /**
     * Sends an arbitrary frame to the Remootio device's websocket API
     * @param {Object} frameJson - Is a javascript object that will be stringified and sent to the Remootio API. A valid frameJson example for the HELLO frame is:
     * {
     *     type:"HELLO"
     * }
     */
    RemootioDevice.prototype.sendFrame = function (frameJson) {
        if (this.websocketClient != undefined && this.websocketClient.readyState == WebSocket.OPEN) {
            this.websocketClient.send(JSON.stringify(frameJson));
            this.emit('outgoingmessage', frameJson, undefined);
        }
        else {
            console.warn('The websocket client is not connected');
        }
    };
    /**
     * Sends an ENCRYPTED frame with an arbitrary payload to the Remootio device's websocket API
     * @param {Object} unencryptedPayload - Is a javascript object that will be encrypted and placed into the ENCRYPTED frame's frame.data.payload. An example for a QUERY action is:
     * {
     *     action:{
     *         type:"QUERY",
     *         lastActionId = 321
     *     }
     * } where lastActionId must be an increment modulo 0x7FFFFFFF of the last action id (you can get this using the lastActionId property of the RemootioDevice class)
     */
    RemootioDevice.prototype.sendEncryptedFrame = function (unencryptedPayload) {
        if (this.websocketClient != undefined && this.websocketClient.readyState == WebSocket.OPEN) {
            if (this.apiSessionKey != undefined) {
                //Upon connecting, send the AUTH frame immediately to authenticate the session
                var encryptedFrame = apicrypto.remootioApiConstructEncrypedFrame(JSON.stringify(unencryptedPayload), this.apiSecretKey, this.apiAuthKey, this.apiSessionKey);
                this.websocketClient.send(JSON.stringify(encryptedFrame));
                this.emit('outgoingmessage', encryptedFrame, unencryptedPayload);
            }
            else {
                console.warn('Authenticate session first to send this message');
            }
        }
        else {
            console.warn('The websocket client is not connected');
        }
    };
    /**
     * Handles the authentication flow. It sends an AUTH frame, and then extracts the sessionKey and initialActionId from the response, then swaps the encryption keys
     * to the sessionKey and performs a valid QUERY action to finish the authentication successfully.
     */
    RemootioDevice.prototype.authenticate = function () {
        this.sendFrame({
            type: 'AUTH'
        });
    };
    /**
     * Sends a HELLO frame to the Remootio device API. The expected response is a SERVER_HELLO frame
     */
    RemootioDevice.prototype.sendHello = function () {
        this.sendFrame({
            type: 'HELLO'
        });
    };
    /**
     * Sends a PING frame to the Remootio device API. The expected response is a PONG frame. The RemootioDevice class sends periodic PING frames automatically to keep the connection alive.
     */
    RemootioDevice.prototype.sendPing = function () {
        this.sendFrame({
            type: 'PING'
        });
    };
    /**
     * Sends a QUERY action in an ENCRYPTED frame to the Remootio device API.
     * The response ENCRYPTED frame contains the gate status (open/closed)
     */
    RemootioDevice.prototype.sendQuery = function () {
        if (this.lastActionId != undefined) {
            this.sendEncryptedFrame({
                action: {
                    type: 'QUERY',
                    id: (this.lastActionId + 1) % 0x7fffffff //set frame counter to be last frame id + 1
                }
            });
        }
        else {
            console.warn('Unexpected error - lastActionId is undefined');
        }
    };
    /**
     * Sends a TRIGGER action in an ENCRYPTED frame to the Remootio device API.
     * This action triggers the output of the Remootio device. (so it opens/closes your gate or garage door depending on how your gate or garage door opener is set up)
     */
    RemootioDevice.prototype.sendTrigger = function () {
        if (this.lastActionId != undefined) {
            this.sendEncryptedFrame({
                action: {
                    type: 'TRIGGER',
                    id: (this.lastActionId + 1) % 0x7fffffff //set frame counter to be last frame id + 1
                }
            });
        }
        else {
            console.warn('Unexpected error - lastActionId is undefined');
        }
    };
    /**
     * Sends a TRIGGER_SECONDARY action in an ENCRYPTED frame to the Remootio device API.
     * The action requires you to have a Remootio 2 device with one control output configured to be a "free relay output"
     * This action triggers the free relay output of the Remootio device.
     * Only supported in API version 2 or above
     */
    RemootioDevice.prototype.sendTriggerSecondary = function () {
        if (this.lastActionId != undefined) {
            this.sendEncryptedFrame({
                action: {
                    type: 'TRIGGER_SECONDARY',
                    id: (this.lastActionId + 1) % 0x7fffffff //set frame counter to be last frame id + 1
                }
            });
        }
        else {
            console.warn('Unexpected error - lastActionId is undefined');
        }
    };
    /**
     * Sends an OPEN action in an ENCRYPTED frame to the Remootio device API.
     * This action triggers the output of the Remootio device to open the gate or garage door only if the gate or garage door is currently closed.
     * This action returns an error response if there is no gate status sensor installed.
     */
    RemootioDevice.prototype.sendOpen = function () {
        if (this.lastActionId != undefined) {
            this.sendEncryptedFrame({
                action: {
                    type: 'OPEN',
                    id: (this.lastActionId + 1) % 0x7fffffff //set frame counter to be last frame id + 1
                }
            });
        }
        else {
            console.warn('Unexpected error - lastActionId is undefined');
        }
    };
    /**
     * Sends an CLOSE action in an ENCRYPTED frame to the Remootio device API.
     * This action triggers the output of the Remootio device to close the gate or garage door only if the gate or garage door is currently open.
     * This action returns an error response if there is no gate status sensor installed.
     */
    RemootioDevice.prototype.sendClose = function () {
        if (this.lastActionId != undefined) {
            this.sendEncryptedFrame({
                action: {
                    type: 'CLOSE',
                    id: (this.lastActionId + 1) % 0x7fffffff //set frame counter to be last frame id + 1
                }
            });
        }
        else {
            console.warn('Unexpected error - lastActionId is undefined');
        }
    };
    /**
     * Sends a TRIGGER action with hold active duration in an ENCRYPTED frame to the Remootio device API.
     * This action triggers the output of the Remootio device and holds it active for the duration specified in minutes
     */
    RemootioDevice.prototype.holdTriggerOutputActive = function (durationMins) {
        if (this.lastActionId != undefined) {
            this.sendEncryptedFrame({
                action: {
                    type: 'TRIGGER',
                    duration: durationMins,
                    id: (this.lastActionId + 1) % 0x7fffffff //set frame counter to be last frame id + 1
                }
            });
        }
        else {
            console.warn('Unexpected error - lastActionId is undefined');
        }
    };
    /**
     * Sends a TRIGGER_SECONDARY action with hold active duration in an ENCRYPTED frame to the Remootio device API.
     * This action triggers the secondary output of the Remootio device and holds it active for the duration specified in minutes
     */
    RemootioDevice.prototype.holdTriggerSecondaryOutputActive = function (durationMins) {
        if (this.lastActionId != undefined) {
            this.sendEncryptedFrame({
                action: {
                    type: 'TRIGGER_SECONDARY',
                    duration: durationMins,
                    id: (this.lastActionId + 1) % 0x7fffffff //set frame counter to be last frame id + 1
                }
            });
        }
        else {
            console.warn('Unexpected error - lastActionId is undefined');
        }
    };
    /**
     * Sends a OPEN action with hold active duration in an ENCRYPTED frame to the Remootio device API.
     * This action triggers the open direction output of the Remootio device and holds it active for the duration specified in minutes
     */
    RemootioDevice.prototype.holdOpenOutputActive = function (durationMins) {
        if (this.lastActionId != undefined) {
            this.sendEncryptedFrame({
                action: {
                    type: 'OPEN',
                    duration: durationMins,
                    id: (this.lastActionId + 1) % 0x7fffffff //set frame counter to be last frame id + 1
                }
            });
        }
        else {
            console.warn('Unexpected error - lastActionId is undefined');
        }
    };
    /**
     * Sends a CLOSE action with hold active duration in an ENCRYPTED frame to the Remootio device API.
     * This action triggers the close direction output of the Remootio device and holds it active for the duration specified in minutes
     */
    RemootioDevice.prototype.holdCloseOutputActive = function (durationMins) {
        if (this.lastActionId != undefined) {
            this.sendEncryptedFrame({
                action: {
                    type: 'CLOSE',
                    duration: durationMins,
                    id: (this.lastActionId + 1) % 0x7fffffff //set frame counter to be last frame id + 1
                }
            });
        }
        else {
            console.warn('Unexpected error - lastActionId is undefined');
        }
    };
    /**
     * Sends an RESTART action in an ENCRYPTED frame to the Remootio device API.
     * This action triggers a restart of the Remootio device.
     */
    RemootioDevice.prototype.sendRestart = function () {
        if (this.lastActionId != undefined) {
            this.sendEncryptedFrame({
                action: {
                    type: 'RESTART',
                    id: (this.lastActionId + 1) % 0x7fffffff //set frame counter to be last frame id + 1
                }
            });
        }
        else {
            console.warn('Unexpected error - lastActionId is undefined');
        }
    };
    Object.defineProperty(RemootioDevice.prototype, "isConnected", {
        //Get method for the isConnected property
        get: function () {
            if (this.websocketClient != undefined && this.websocketClient.readyState == WebSocket.OPEN) {
                return true;
            }
            else {
                return false;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RemootioDevice.prototype, "theLastActionId", {
        //Get method for the lastActionId property
        get: function () {
            return this.lastActionId;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RemootioDevice.prototype, "isAuthenticated", {
        //Get method for the isAuthenticated property
        get: function () {
            if (this.websocketClient != undefined && this.websocketClient.readyState == WebSocket.OPEN) {
                if (this.apiSessionKey != undefined) {
                    //If the session is authenticated, the apiSessionKey must be defined
                    return true;
                }
                else {
                    return false;
                }
            }
            else {
                return false; //The connection cannot be authenticated if it's not even established
            }
        },
        enumerable: false,
        configurable: true
    });
    return RemootioDevice;
}(events_1.EventEmitter));
module.exports = RemootioDevice;
