import { Status } from "./types"

import {
    encode as msgpackEncode,
    decode as msgpackDecode,
} from "@msgpack/msgpack";

const ErrorConnection = {
    error: {
        code: 0,
        message: "Unable to connect to the server. Please check your network connection.",
        critical: true
    }
}

const ErrorDublicateConnection = {
    error: {
        code: 1,
        message: "Unable to connect to the server. Please check your network connection.",
        critical: true
    }
}
class Client {
    private client?: WebSocket;
    private status: Status = Status.CLOSE;
    private lastMessage: number = Date.now();
    private timeoutIndexMax: number = 5;
    private timeoutIndex: number = 0;
    private timeout: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;

    constructor(
        private url: string,
        autoConnect: boolean,
        private autoReconnect: boolean,
    ) {
        if (autoConnect) this.connect();
    }

    private closeTimeout = () => {
        if (this.timeout) clearTimeout(this.timeout);
        this.timeoutIndex = 0;
        this.timeout = null;
    };

    private startTimeout = (callback: () => void, error: () => void) => {
        if (this.timeout) clearTimeout(this.timeout);

        const timeouts = [1000, 2000, 5000, 10000];
        this.timeout = setTimeout(() => {
            this.timeoutIndex++;
            this.timeoutIndex >= this.timeoutIndexMax ? error() : callback();
        }, timeouts[Math.min(this.timeoutIndex, timeouts.length - 1)]);
    };

    private startPingInterval = () => {
        this.stopPingInterval();
        this.pingInterval = setInterval(() => {
            if (!this.client || this.client.readyState !== WebSocket.OPEN) {
                this.stopPingInterval();
                return;
            }

            const diff = Date.now() - this.lastMessage;

            if (diff > 20000) {
                this.status = Status.CLOSE;
                this.client.close();
                postMessage([0, Status.CLOSE, ""]);
                return;
            }

            if (diff > 15000) {
                this.send([0, "♦", ""]);
            }
        }, 1000);
    };

    private stopPingInterval = () => {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    };

    private handlerMessage = (e: MessageEvent) => {
        try {
            this.lastMessage = Date.now();
            const decoded = msgpackDecode(new Uint8Array(e.data)) as [number | null, string | null, any | null];
            if (decoded[1] === "•") {
                return;
            }
            postMessage(decoded);
        } catch {
            postMessage(["error", "decode_failed", null]);
        }
    };

    private handlerOpen = () => {
        this.status = Status.OPEN;
        this.lastMessage = Date.now();
        this.timeoutIndex = 0;
        this.startPingInterval();
        postMessage([0, Status.OPEN, ""]);
    };

    private handlerClose = (ev: CloseEvent) => {

        console.log(ev.code)

        if (ev.code == 4001) {

            this.client = undefined;
            this.stopPingInterval();
            this.closeTimeout();
            this.status = Status.ABORT;
            postMessage([0, Status.ABORT, ""]);

            return postMessage([0, "connection.duplicated", ErrorDublicateConnection]);
        }

        if (this.status === Status.USER_CLOSED) return;

        this.status = Status.CLOSE;
        this.client = undefined;
        this.stopPingInterval();

        if (!this.autoReconnect) {
            postMessage([0, Status.ABORT, ""]);
            return;
        }

        postMessage([0, Status.CLOSE, ""]);
        this.startTimeout(() => this.connect(), () => {
            this.closeTimeout();
            this.status = Status.ABORT;
            postMessage([0, Status.ABORT, ""]);
        });
    };

    public connect = () => {
        this.status = Status.CONNECTING;
        postMessage([0, Status.CONNECTING, ""]);
        this.client = new WebSocket(this.url);
        this.client.binaryType = "arraybuffer";
        this.client.onopen = this.handlerOpen.bind(this);
        this.client.onclose = this.handlerClose.bind(this);
        this.client.onerror = this.handlerClose.bind(this);
        this.client.onmessage = this.handlerMessage.bind(this);
    };

    public disconnect = () => {
        if (this.client) {
            this.client.onopen = null;
            this.client.onclose = null;
            this.client.onerror = null;
            this.client.onmessage = null;
            this.client.close(1000);
            this.client = undefined;
        }
        this.status = Status.USER_CLOSED;
        this.stopPingInterval();
        postMessage([0, Status.CLOSE, ""]);
        this.closeTimeout();
    };

    public send = (data: [number, string, unknown]) => {
        try {
            if (this.client?.readyState === WebSocket.OPEN) {
                return this.client.send(msgpackEncode(data));
            } else {
                return postMessage([data[0], data[1], ErrorConnection]);
            }
        } catch {
            return postMessage([data[0], data[1], ErrorConnection]);
        }
    };
}

let client: Client | null;

onmessage = (e) => {
    switch (e.data[0]) {
        case 0:
            client = new Client(e.data[1].url, e.data[1].autoConnect, e.data[1].autoReconnect);
            break;
        case 1:
            client?.connect();
            break;
        case 2:
            client?.disconnect();
            break;
        case 3:
            client?.send(e.data[1]);
            break;
        default:
            console.warn("Unhandled message:", e.data);
    }
};

export default {} as typeof Worker & { new(): Worker };
