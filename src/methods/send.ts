import { CTX, Data, Events, Result } from "../types";

function send<E extends Events, K extends keyof E, ER extends unknown>(
  this: CTX,
  event: K,
  data: E[K]["request"],
): Promise<Result<ER, E[K]["response"]>>;

function send<E extends Events, K extends keyof E, ER extends unknown>(
  this: CTX,
  event: K,
  data: E[K]["request"],
): Promise<Result<ER, E[K]["response"]>>;

function send<E extends Events, K extends keyof E, ER extends unknown>(
  this: CTX,
  event: K,
  data: E[K]["request"],
  callback: (data: Data<E, "response", ER>["data"]) => void,
): void;

function send<E extends Events, K extends keyof E, ER extends unknown>(
  this: CTX,
  event: K,
  data: E[K]["request"],
): void;

function send<E extends Events, K extends keyof E, ER extends unknown>(
  this: CTX,
  event: K,
  data: Data<E, "response", ER>,
  callback?: (data: Data<E, "response", ER>["data"]) => void,
): Promise<Data<E, "response", ER>["data"]> | void {
  const ID = ++this.requestID;

  if (typeof callback === "function") {
    this.callbackEmitter.set(ID, callback);
    this.client.postMessage([3, [ID, event, data]]);
    return;
  }

  return new Promise<Data<E, "response", ER>["data"]>((resolve) => {
    this.callbackEmitter.set(ID, resolve);
    this.client.postMessage([3, [ID, event, data]]);
  });
}

export default send;
