import { Status } from "./types";
import {
  encode as msgpackEncode,
  decode as msgpackDecode,
} from "@msgpack/msgpack";

const ErrorConnection = { error: { key: "CONNECTION" } };
const ErrorTimeout = { error: { key: "TIMEOUT" } }

const PingBytes = 0xAA
const PongBytes = 0xAB
const DuplicateBytes = 0xAC

class Client {
  private client?: WebSocket;
  private status: Status = Status.CLOSE;

  private lastMessage = Date.now();
  private timeoutIndexMax = 5;
  private timeoutIndex = 0;
  private timeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  private activeTimeouts: Map<number, NodeJS.Timeout> = new Map();

  constructor(
    private url: string,
    autoConnect: boolean,
    private autoReconnect: boolean,
  ) {
    if (autoConnect) this.connect();
  }

  public send = (data: [number, string, any, number?]) => {
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

      switch (obfuscated[0]) {
        case PingBytes:
          return;
        case PongBytes:
          return;
        case DuplicateBytes:
          if (this.client) {
            this.client?.close(1000)
          }

          this.client = undefined;
          this.stopPingInterval();
          this.closeTimeout();
          this.status = Status.DUPLICATED;
          postMessage([0, Status.DUPLICATED, ""]);
          return
      }

      const decodedBytes = this.xor(obfuscated, 77);

      const decoded = msgpackDecode(decodedBytes) as [number | null, string | null, any | null];
      if (typeof decoded[0] === "number") {
        const timeout = this.activeTimeouts.get(decoded[0]);
        if (timeout) {
          clearTimeout(timeout);
          this.activeTimeouts.delete(decoded[0]);
        }
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

    if (
      this.status === Status.DUPLICATED
    ) {
      this.client = undefined;
      this.stopPingInterval();
      this.closeTimeout();
      this.status = Status.DUPLICATED;
      postMessage([0, Status.DUPLICATED, ""]);
      return
    };

    this.client = undefined;
    this.stopPingInterval();

    this.status = Status.CLOSE;
    postMessage([0, Status.CLOSE, ""]);

    if (this.autoReconnect) {
      this.startTimeout(
        () => this.connect(),
        () => {
          this.closeTimeout();
          this.status = Status.ABORT;
          postMessage([0, Status.ABORT, ""]);
        });
    }

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

  public terminated = () => {
    if (this.client) {
      this.client.onopen = null;
      this.client.onclose = null;
      this.client.onmessage = null;
      this.client.close(1000);
      this.client = undefined;
    }
    this.status = Status.TERMINATED;
    this.stopPingInterval();
    this.closeTimeout();
    postMessage([0, Status.TERMINATED, ""]);
  };

  public disconnect = () => {
    if (this.client) {
      this.client.onopen = null;
      this.client.onclose = null;
      this.client.onmessage = null;
      this.client.close(1000);
      this.client = undefined;
    }
    this.status = Status.USER_CLOSED;
    this.stopPingInterval();
    this.closeTimeout();
    postMessage([0, Status.USER_CLOSED, ""]);
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

        const encoded = new Uint8Array([PingBytes])
        const obfuscated = this.xor(encoded, 77);

        this.client.send(obfuscated);
        this.pingInterval = setTimeout(pingLoop, 5000);
      } else {
        this.pingInterval = setTimeout(pingLoop, 1000);
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
      client = new Client(e.data[1].url, e.data[1].autoConnect, e.data[1].autoReconnect);
      break;
    case 1:
      client?.connect();
      break;
    case 2:
      client?.disconnect();
      break;
    case 3:
      client?.terminated();
      client = null;
      close();
      break;
    case 4:
      client?.send(e.data[1]);
      break;
    default:
      console.warn("Unhandled message:", e.data);
  }
};

export default {} as typeof Worker & { new(): Worker };
