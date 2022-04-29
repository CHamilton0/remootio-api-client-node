/// <reference types="node" />
import { EventEmitter } from 'events';
import { ReceivedEncryptedFrameContent, ReceivedFrames, RemootioAction, SentEcryptedFrameContent, SentFrames } from './frames';
/**
 * RemootioDevice class implements an API client for a signle device. You should create one instance per Remootio device you have.
 * The class takes care of keeping the connection alive by sending a PING message every sendPingMessageEveryXMs milliseconds to the Remootio device.
 * If no response is received within pingReplyTimeoutXMs=(sendPingMessageEveryXMs/2) time after a PING message, the connection is assumed to be broken.
 *
 * *** Constructor ***
 * The constructor takes 3 parameters: DeviceIp, ApiSecretKey, ApiAuthKey (all of them are available in the Remootio app)
 * @param {string} DeviceIp - the IP address of the Remootio device (this info is available in the Remootio app)
 * @param {string} ApiSecretKey - the API Secret Key of the Remootio device (this info is available in the Remootio app)
 * @param {string} ApiAuthKey - the API Auth Key of the Remootio device (this info is available in the Remootio app)
 * @param {string} [sendPingMessageEveryXMs=60000] - the API client sends a ping frame to the Remootio device every sendPingMessageEveryXMs milliseconds to keep the connection alive. Remootio closes the connection if no message is received for 120 seconds. If no message is received from Remootio within (sendPingMessageEveryXMs/2) milliseconds after PING frame is sent the API client considers the connection to be broken and closes it. It's not recommended to set sendPingMessageEveryXMs below 10000 (10 seconds).
 *
 * *** Properties ***
 * @property isConnected - shows if the API client is connected to the Remootio device's websocket API or not
 * @property isAuthenticated - shows if the API client is connected to the Remootio device's websocket API or not
 * @property theLastActionId - gets the id of the last action sent to the Remootio API (lastActionId), any new action sent should contain the incremented value of the the last action id modulo 0x7FFFFFFF. Incrementing this value is handled automatically by the RamootioDevice class. The only time you need this property if you want to send an arbitrary ENCRYPED frame using sendEncryptedFrame()
 *
 * *** Methods ****
 * @method connect(autoReconnect) - connect the API client to the Remootio device (via websocket)
 * @param {boolean} autoReconnect - the API client will try to reconnect to the Remootio device when the connection is lost
 *
 * @method disconnect() - disconnect the API client from the Remootio device
 *
 * @method authenticate() - authenticates the client with the Remootio API by first sending an AUTH frame, and then sending a QUERY action as a response to the authentication challenge from the server
 *
 * @method sendPing() - send a PING frame
 *
 * @method sendHello() - send a HELLO frame
 *
 * @method sendQuery() - send a QUERY action //needs authentication
 *
 * @method sendTrigger() - send a TRIGGER action //needs authentication
 *
 * @method sendTriggerSecondary() - send a TRIGGER_SECONDARY action //needs authentication
 *
 * @method sendOpen() - send a OPEN action //needs authentication
 *
 * @method sendClose() - send a CLOSE action //needs authentication
 *
 * @method holdTriggerOutputActive(durationMins) Holds the output triggered by the sendTrigger command active for durationMins
 *
 * @method holdTriggerSecondaryOutputActive(durationMins) Holds the secondary output triggered by the sendTriggerSecondary command active for durationMins
 *
 * @method holdOpenOutputActive(durationMins) Holds the output triggered by the sendOpen command active for durationMins
 *
 * @method holdCloseOutputActive(durationMins) Holds the output triggered by the sendClose command active for durationMins
 *
 * @method sendRestart() - send a RESTART action //needs authentication
 *
 * @method sendFrame(frame) - send a normal frame the sendPing and sendHello and authenticate functions above use this
 *
 * @method sendEncryptedFrame(unencryptedPayload) - send an encrypted frame the sendQuery, sendTrigger, sendOpen, sendClose, sendRestart functions use this
 *
 * *** Events ***
 * The class emits the following events:
 * @event connecting - when it tries to connect
 *
 * @event connected - when it is connected
 *
 * @event authenticated - when the authentication flow is finished (the client receives a response to his first QUERY action after the AUTH message)
 *
 * @event disconnect - when the connection is lost
 *
 * @event error - if there is any error
 *
 * @event outgoingmessage - the event is emitted whenever a message is sent to the API with the following two parameters
 * @param {Object} frame - contains the javascript object of the JSON frame
 * @param {Object} unencryptedPayload - contains the javascript object of the unencrypted payload (frame.data.payload) if it's an ENCRYPTED frame
 *
 * @event incomingmessage - the event is emitted whenever a message is received from the Remootio device with the following two parameters
 * @param {Object} frame - contains the javascript object of the JSON frame received
 * @param {Object} decryptedPayload - contains the javascript object of the decrypted payload (frame.data.payload) if it's an ENCRYPTED frame
 *
 */
interface RemootioDeviceEvents {
    connecting: () => void;
    connected: () => void;
    authenticated: () => void;
    disconnect: () => void;
    error: (errorMessage: string) => void;
    outgoingmessage: (frame?: SentFrames, unencryptedPayload?: SentEcryptedFrameContent) => void;
    incomingmessage: (frame: ReceivedFrames, decryptedPayload?: ReceivedEncryptedFrameContent) => void;
}
declare interface RemootioDevice {
    on<E extends keyof RemootioDeviceEvents>(event: E, listener: RemootioDeviceEvents[E]): this;
    emit<E extends keyof RemootioDeviceEvents>(event: E, ...args: Parameters<RemootioDeviceEvents[E]>): boolean;
}
declare class RemootioDevice extends EventEmitter {
    private apiSecretKey;
    private apiAuthKey;
    private deviceIp;
    private websocketClient?;
    private apiSessionKey?;
    private lastActionId?;
    private autoReconnect;
    private port;
    private sendPingMessageEveryXMs;
    private sendPingMessageIntervalHandle?;
    private pingReplyTimeoutXMs;
    private pingReplyTimeoutHandle?;
    private waitingForAuthenticationQueryActionResponse?;
    /**
     * Constructor to create a RemootioDevice instance. You should create one instance per Remootio device you have.
     * @param {string} DeviceIp - ip address of the device (as seen in the Remootio app) e.g. "192.168.1.155"
     * @param {string} ApiSecretKey - API Secret Key of the device (as seen in the Remootio app). It is a hexstring representing a 256 bit long value e.g. "12b3f03211c384736b8a1906635f4abc90074e680138a689caf03485a971efb3"
     * @param {string} ApiAuthKey - API Auth Key of the device (as seen in the Remootio app). It is a hexstring representing a 256 bit long value e.g. "74ca13b56b3c898670a67e8f36f8b8a61340738c82617ba1398ae7ca62f1670a"
     * @param {number} [sendPingMessageEveryXMs=60000] - the API client sends a ping frame to the Remootio device every sendPingMessageEveryXMs milliseconds to keep the connection alive. Remootio closes the connection if no message is received for 120 seconds. If no message is received from Remootio within (sendPingMessageEveryXMs/2) milliseconds after PING frame is sent the API client considers the connection to be broken and closes it. It's not recommended to set sendPingMessageEveryXMs below 10000 (10 seconds).
     */
    constructor(DeviceIp: string, ApiSecretKey: string, ApiAuthKey: string, sendPingMessageEveryXMs?: number);
    /**
     * Connect to the Remootio device's websocket API
     * @param {boolean} autoReconnect - If autoReconnect is true, the API client will try to reconnect to the device everytime the connection is lost (recommended)
     * @param {number} port - The port that the device is listening to
     */
    connect(autoReconnect: boolean, port: number): void;
    /**
     * Disconnect from the Remootio device's websocket API
     * it sents autoConnect to false, so even if you have enabled it in your connect method it will not reconnect automatically.
     */
    disconnect(): void;
    /**
     * Sends an arbitrary frame to the Remootio device's websocket API
     * @param {Object} frameJson - Is a javascript object that will be stringified and sent to the Remootio API. A valid frameJson example for the HELLO frame is:
     * {
     *     type:"HELLO"
     * }
     */
    sendFrame(frameJson: SentFrames): void;
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
    sendEncryptedFrame(unencryptedPayload: RemootioAction): void;
    /**
     * Handles the authentication flow. It sends an AUTH frame, and then extracts the sessionKey and initialActionId from the response, then swaps the encryption keys
     * to the sessionKey and performs a valid QUERY action to finish the authentication successfully.
     */
    authenticate(): void;
    /**
     * Sends a HELLO frame to the Remootio device API. The expected response is a SERVER_HELLO frame
     */
    sendHello(): void;
    /**
     * Sends a PING frame to the Remootio device API. The expected response is a PONG frame. The RemootioDevice class sends periodic PING frames automatically to keep the connection alive.
     */
    sendPing(): void;
    /**
     * Sends a QUERY action in an ENCRYPTED frame to the Remootio device API.
     * The response ENCRYPTED frame contains the gate status (open/closed)
     */
    sendQuery(): void;
    /**
     * Sends a TRIGGER action in an ENCRYPTED frame to the Remootio device API.
     * This action triggers the output of the Remootio device. (so it opens/closes your gate or garage door depending on how your gate or garage door opener is set up)
     */
    sendTrigger(): void;
    /**
     * Sends a TRIGGER_SECONDARY action in an ENCRYPTED frame to the Remootio device API.
     * The action requires you to have a Remootio 2 device with one control output configured to be a "free relay output"
     * This action triggers the free relay output of the Remootio device.
     * Only supported in API version 2 or above
     */
    sendTriggerSecondary(): void;
    /**
     * Sends an OPEN action in an ENCRYPTED frame to the Remootio device API.
     * This action triggers the output of the Remootio device to open the gate or garage door only if the gate or garage door is currently closed.
     * This action returns an error response if there is no gate status sensor installed.
     */
    sendOpen(): void;
    /**
     * Sends an CLOSE action in an ENCRYPTED frame to the Remootio device API.
     * This action triggers the output of the Remootio device to close the gate or garage door only if the gate or garage door is currently open.
     * This action returns an error response if there is no gate status sensor installed.
     */
    sendClose(): void;
    /**
     * Sends a TRIGGER action with hold active duration in an ENCRYPTED frame to the Remootio device API.
     * This action triggers the output of the Remootio device and holds it active for the duration specified in minutes
     */
    holdTriggerOutputActive(durationMins: number): void;
    /**
     * Sends a TRIGGER_SECONDARY action with hold active duration in an ENCRYPTED frame to the Remootio device API.
     * This action triggers the secondary output of the Remootio device and holds it active for the duration specified in minutes
     */
    holdTriggerSecondaryOutputActive(durationMins: number): void;
    /**
     * Sends a OPEN action with hold active duration in an ENCRYPTED frame to the Remootio device API.
     * This action triggers the open direction output of the Remootio device and holds it active for the duration specified in minutes
     */
    holdOpenOutputActive(durationMins: number): void;
    /**
     * Sends a CLOSE action with hold active duration in an ENCRYPTED frame to the Remootio device API.
     * This action triggers the close direction output of the Remootio device and holds it active for the duration specified in minutes
     */
    holdCloseOutputActive(durationMins: number): void;
    /**
     * Sends an RESTART action in an ENCRYPTED frame to the Remootio device API.
     * This action triggers a restart of the Remootio device.
     */
    sendRestart(): void;
    get isConnected(): boolean;
    get theLastActionId(): number | undefined;
    get isAuthenticated(): boolean;
}
export = RemootioDevice;
