declare module 'react-native-websocket' {
  export default class WebSocket {
    constructor(url: string, protocols?: string | string[], options?: object);
    static readonly CONNECTING: 0;
    static readonly OPEN: 1;
    static readonly CLOSING: 2;
    static readonly CLOSED: 3;
    readonly readyState: number;
    onopen: (event: any) => void;
    onmessage: (event: any) => void;
    onclose: (event: any) => void;
    onerror: (event: any) => void;
    send(data: string | ArrayBuffer | Blob): void;
    close(code?: number, reason?: string): void;
  }
}