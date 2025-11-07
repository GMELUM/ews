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

  if (isCallback) {
    this.callbackEmitter.set(ID, (response) => {
      (callbackOrOptions as any)(response);
      this.callbackEmitter.delete(ID);
    });

    this.client.postMessage([4, [ID, event, data, timeout]]);
    return;
  }

  return new Promise<Data<E, "response", ER>["data"]>((resolve) => {
    this.callbackEmitter.set(ID, (response) => {
      resolve(response);
      this.callbackEmitter.delete(ID);
    });

    this.client.postMessage([4, [ID, event, data, timeout]]);
  });
}

export default send;
