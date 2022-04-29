/**
 * This module implements the crypto needed by the Remootio device API to handle ENCRYPTED frames used for sending sensitive information and commands
 * It uses crypto-js (https://github.com/brix/crypto-js) but the crypto operations here can also be done using the crypto node module require('crypto')
 * crypto-js is used for the code reuse purposes between the browser and the Node.js examples
 */
import { EncryptedFrame, ReceivedEncryptedFrameContent } from './frames';
/**
 * This function decrypts the payload of an ENCRYPTED frame.
 * @param {Object} frame - is a javascript object representing a valid encrypted frame
 * @param {string} ApiSecretKey - API Secret Key of the device (as seen in the Remootio app).
 * It is a hexstring representing a 256 bit long value e.g. "12b3f03211c384736b8a1906635f4abc90074e680138a689caf03485a971efb3"
 * @param {string} ApiAuthKey - API Auth Key of the device (as seen in the Remootio app).
 * It is a hexstring representing a 256 bit long value e.g. "74ca13b56b3c898670a67e8f36f8b8a61340738c82617ba1398ae7ca62f1670a"
 * @param {string} ApiSessionKey - API Session Key for the current session.
 * If the session is not authenticated this parameter must be undefined.
 * The sessionkey is received in the challenge.sessionKey field of the ENCRYPTED frame sent as a response to the AUTH frame
 * during the authentication flow. This is a base64 encoded string representing a 256 bit long value
 * e.g. "f+8UpraYuLV0wKdHNjJAj1OTaNOI83i6fJZ8TBtwx00="
 */
export declare function remootioApiDecryptEncrypedFrame(frame: EncryptedFrame, ApiSecretKey: string, ApiAuthKey: string, ApiSessionKey?: string): ReceivedEncryptedFrameContent | undefined;
/**
 * This function encrypts the payload of an ENCRYPTED frame, and the constructs the ENCRYPTED frame itself.
 * @param {Object} unencryptedPayload - is a javascript object representing the non-encrypted payload of the ENCRYPTED FRAME to send
 * @param {string} ApiSecretKey - API Secret Key of the device (as seen in the Remootio app).
 * It is a hexstring representing a 256 bit long value e.g. "12b3f03211c384736b8a1906635f4abc90074e680138a689caf03485a971efb3" - this parameter is actually not used as this function is only called in authenticated sessions, the parameter is here for consistency only
 * @param {string} ApiAuthKey - API Auth Key of the device (as seen in the Remootio app).
 * It is a hexstring representing a 256 bit long value e.g. "74ca13b56b3c898670a67e8f36f8b8a61340738c82617ba1398ae7ca62f1670a"
 * @param {string} ApiSessionKey - API Session Key for the current session received in the challenge.sessionKey field
 * of the ENCRYPTED frame sent as a response to the AUTH frame during the authentication flow.
 * This is a base64 encoded string representing a 256 bit long value e.g. "f+8UpraYuLV0wKdHNjJAj1OTaNOI83i6fJZ8TBtwx00="
 */
export declare function remootioApiConstructEncrypedFrame(unencryptedPayload: string, _ApiSecretKey: string, ApiAuthKey: string, ApiSessionKey?: string): EncryptedFrame | undefined;
