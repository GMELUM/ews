import { CTX, Data, Events } from "../types";

function send<E extends Events, K extends keyof E, ER extends unknown>(
  this: CTX,
  event: K,
  data: E[K]["request"],
  callback: (data: Data<E, "response", ER>["data"]) => void
): void;

function send<E extends Events, K extends keyof E, ER extends unknown>(
  this: CTX,
  event: K,
  data: E[K]["request"],
  callbackOrOptions?: ((data: Data<E, "response", ER>["data"]) => void)
): Promise<Data<E, "response", ER>["data"]> | void {
  const ID = ++this.requestID;

  const isCallback = typeof callbackOrOptions === "function";
  const timeout = 10000;

  const cleanup = () => {
    this.callbackEmitter.delete(ID);
  };

  if (isCallback) {
    this.callbackEmitter.set(ID, (response) => {
      (callbackOrOptions as any)(response);
      cleanup();
    });

    this.client.postMessage([3, [ID, event, data, timeout]]);
    return;
  }

  return new Promise<Data<E, "response", ER>["data"]>((resolve) => {
    this.callbackEmitter.set(ID, (response) => {
      resolve(response);
      cleanup();
    });

    this.client.postMessage([3, [ID, event, data, timeout]]);
  });
}

export default send;
