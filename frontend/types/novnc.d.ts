declare module "@novnc/novnc" {
  export type RFBEventName =
    | "connect"
    | "disconnect"
    | "credentialsrequired"
    | "securityfailure"
    | "desktopname"
    | "bell"
    | "capabilities";

  export interface RFBCredentials {
    username?: string;
    password?: string;
    target?: string;
  }

  export interface RFBOptions {
    credentials?: RFBCredentials;
    shared?: boolean;
    repeaterID?: string;
    wsProtocols?: string[];
  }

  export interface RFBDisconnectEvent extends Event {
    detail?: {
      clean?: boolean;
    };
  }

  export interface RFBSecurityFailureEvent extends Event {
    detail?: {
      status?: number;
      reason?: string;
    };
  }

  export interface RFBDesktopNameEvent extends Event {
    detail?: {
      name?: string;
    };
  }

  export default class RFB extends EventTarget {
    constructor(target: HTMLElement, url: string, options?: RFBOptions);
    viewOnly: boolean;
    scaleViewport: boolean;
    resizeSession: boolean;
    background: string;
    qualityLevel: number;
    compressionLevel: number;
    focus(): void;
    disconnect(): void;
    sendCredentials(credentials: RFBCredentials): void;
    sendCtrlAltDel(): void;
    clipboardPasteFrom(text: string): void;
  }
}
