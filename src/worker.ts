import { AuthData, Status } from "./types";
import {
    encode as msgpackEncode,
    decode as msgpackDecode,
} from "@msgpack/msgpack";

const ErrorConnection = {
    error: {
        key: "NOT_CONNECTED",
        message: "Unable to connect to the server. Please check your network connection."
    }
};

const ErrorDuplicateConnection = {
    error: {
        key: "DUPLICATE_CONNECTION",
        message: "Unable to connect to the server. Please check your network connection."
    }
};

const ErrorTimeout = {
    error: {
        key: "REQUEST_TIMEOUT",
        message: "Request timed out in worker"
    }
};

class Client {
    private client?: WebSocket;
    private status: Status = Status.CLOSE;
    private isAuthorized = false;

    private lastMessage = Date.now();
    private timeoutIndexMax = 5;
    private timeoutIndex = 0;
    private timeout: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;

    private pendingQueue: [number, string, any, number?][] = [];
    private activeTimeouts: Map<number, NodeJS.Timeout> = new Map();

    constructor(
        private url: string,
        autoConnect: boolean,
        private autoReconnect: boolean,
        private authData: AuthData,
    ) {
        if (autoConnect) this.connect();
    }

    public removeFromQueue = (requestID: number) => {
        this.pendingQueue = this.pendingQueue.filter(([id]) => id !== requestID);
        const timeout = this.activeTimeouts.get(requestID);
        if (timeout) {
            clearTimeout(timeout);
            this.activeTimeouts.delete(requestID);
        }
    };

    private authorize = () => {
        console.log(this.authData)
        this.send([0, this.authData.event, this.authData.data]);
    };

    private onAuthorized = () => {
        this.isAuthorized = true;
        this.flushQueue();
    };

    private flushQueue = () => {
        while (this.pendingQueue.length) {
            const [id, event, data, timeout] = this.pendingQueue.shift()!;
            this.send([id, event, data, timeout]);
        }
    };

    public send = (data: [number, string, any, number?]) => {

        if (!this.isAuthorized && !data[1].startsWith("auth.")) {
            this.pendingQueue.push(data);
            return;
        }

        try {
            if (this.client?.readyState === WebSocket.OPEN) {
                const [id, event, payload, timeout] = data;

                if (typeof timeout === "number") {
                    const to = setTimeout(() => {
                        this.activeTimeouts.delete(id);
                        postMessage([id, event, ErrorTimeout]);
                    }, timeout);
                    this.activeTimeouts.set(id, to);
                }

                const encoded = msgpackEncode([id, event, payload]);

                const obfuscated = this.xor(encoded, 77);
                return this.client.send(obfuscated);
            } else {
                return postMessage([data[0], data[1], ErrorConnection]);
            }
        } catch {
            return postMessage([data[0], data[1], ErrorConnection]);
        }
    };

    private handlerMessage = (e: MessageEvent) => {
        try {

            this.lastMessage = Date.now();

            const obfuscated = new Uint8Array(e.data);
            const decodedBytes = this.xor(obfuscated, 77);

            if (
                decodedBytes.length === 3 &&
                decodedBytes[0] === 0xE2 &&
                decodedBytes[1] === 0x80 &&
                decodedBytes[2] === 0xA2
            ) {
                return;
            }

            const decoded = msgpackDecode(decodedBytes) as [number | null, string | null, any | null];
            const [id, event] = decoded;

            if (event === "•") return;

            if (typeof id === "number") {
                const timeout = this.activeTimeouts.get(id);
                if (timeout) {
                    clearTimeout(timeout);
                    this.activeTimeouts.delete(id);
                }
            }

            if (event === "􁠲") {
                this.onAuthorized();
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
        this.isAuthorized = false;
        this.startPingInterval();
        postMessage([0, Status.OPEN, ""]);
        this.authorize();
    };

    private handlerClose = (ev: CloseEvent) => {

        console.log(ev.code)

        if (ev.code === 4001) {
            this.client = undefined;
            this.stopPingInterval();
            this.closeTimeout();
            this.status = Status.ABORT;
            postMessage([0, Status.ABORT, ""]);
            return postMessage([0, "connection.duplicated", ErrorDuplicateConnection]);
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
        this.closeTimeout();
        postMessage([0, Status.CLOSE, ""]);
    };

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

        const pingLoop = () => {
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
                this.client.send(new Uint8Array([0xAF, 0xD4, 0xEB]));
                this.pingInterval = setTimeout(pingLoop, 5000); // ⏱ задержка после ping
            } else {
                this.pingInterval = setTimeout(pingLoop, 1000); // обычная проверка
            }
        };

        this.pingInterval = setTimeout(pingLoop, 1000);
    };

    private stopPingInterval = () => {
        if (this.pingInterval) {
            clearTimeout(this.pingInterval);
            this.pingInterval = null;
        }
    };

    private xor = (buf: Uint8Array, key: number): Uint8Array => {
        const out = new Uint8Array(buf.length);
        for (let i = 0; i < buf.length; i++) {
            out[i] = buf[i] ^ key;
        }
        return out;
    };
}

// Singleton client instance
let client: Client | null = null;

// Handle messages from main thread
onmessage = (e) => {
    switch (e.data[0]) {
        case 0:
            client = new Client(e.data[1].url, e.data[1].autoConnect, e.data[1].autoReconnect, e.data[1].authData);
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
        case 4:
            client?.removeFromQueue(e.data[1]);
            break;
        default:
            console.warn("Unhandled message:", e.data);
    }
};

export default {} as typeof Worker & { new(): Worker };
