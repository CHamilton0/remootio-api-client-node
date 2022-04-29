export interface AuthFrame {
    type: 'AUTH';
}
export interface HelloFrame {
    type: 'HELLO';
}
export interface PingFrame {
    type: 'PING';
}
export interface EncryptedFrame {
    type: 'ENCRYPTED';
    data: {
        iv: string;
        payload: string;
    };
    mac: string;
}
export declare type SentFrames = AuthFrame | HelloFrame | PingFrame | EncryptedFrame;
export interface ErrorFrame {
    type: 'ERROR';
    errorMessage: 'json error' | 'input error' | 'internal error' | 'connection timeout' | 'authentication timeout' | 'already authenticated' | 'authentication error';
}
export interface PongFrame {
    type: 'PONG';
}
export declare type ServerHelloFrame = {
    type: 'SERVER_HELLO';
    apiVersion: 2;
    message: string;
    serialNumber: string;
    remootioVersion: 'remootio-1' | 'remootio-2';
} | {
    type: 'SERVER_HELLO';
    apiVersion: 1;
    message: string;
};
export interface ChallengeFrame {
    type: 'CHALLENGE';
    challenge: {
        sessionKey: string;
        initialActionId: number;
    };
}
export declare type ReceivedFrames = ErrorFrame | PongFrame | ServerHelloFrame | EncryptedFrame;
export declare type SentEcryptedFrameContent = RemootioAction;
export declare type ReceivedEncryptedFrameContent = RemootioActionResponse | EventTypes | ChallengeFrame;
declare type ActionTypesWithDurationParam = 'TRIGGER' | 'TRIGGER_SECONDARY' | 'OPEN' | 'CLOSE';
declare type SimpleActionTypes = 'QUERY' | 'RESTART';
declare type ActionTypes = ActionTypesWithDurationParam | SimpleActionTypes;
declare type SensorStates = 'closed' | 'open' | 'no sensor';
declare type KeyTypes = 'master key' | 'unique key' | 'guest key' | 'api key' | 'smart home' | 'automation';
declare type ConnectionTypes = 'bluetooth' | 'wifi' | 'internet' | 'autoopen' | 'unknown' | 'none';
export interface RemootioAction {
    action: {
        type: SimpleActionTypes;
        id: number;
    } | {
        type: ActionTypesWithDurationParam;
        id: number;
        duration?: number;
    };
}
export interface RemootioActionResponse {
    response: {
        type: ActionTypes;
        id: number;
        success: boolean;
        state: SensorStates;
        t100ms: number;
        relayTriggered: boolean;
        errorCode: string;
    };
}
export declare type EventTypes = {
    event: {
        cnt: number;
        type: 'StateChange' | 'Restart' | 'ManualButtonPushed' | 'ManualButtonEnabled' | 'ManualButtonDisabled' | 'DoorbellPushed' | 'DoorbellEnabled' | 'DoorbellDisabled' | 'SensorEnabled' | 'SensorFlipped' | 'SensorDisabled';
        state: SensorStates;
        t100ms: number;
    };
} | {
    event: {
        cnt: number;
        type: 'RelayTrigger' | 'SecondaryRelayTrigger' | 'Connected';
        state: SensorStates;
        t100ms: number;
        data: {
            keyNr: number;
            keyType: KeyTypes;
            via: ConnectionTypes;
        };
    };
} | {
    event: {
        cnt: number;
        type: 'LeftOpen';
        state: SensorStates;
        t100ms: number;
        data: {
            timeOpen100ms: number;
        };
    };
} | {
    event: {
        cnt: number;
        type: 'KeyManagement';
        state: SensorStates;
        t100ms: number;
        data: {
            keyNr: number;
            keyType: KeyTypes;
            bluetooth: boolean;
            wifi: boolean;
            internet: boolean;
            notification: boolean;
            isRemoved: boolean;
        };
    };
};
export {};
