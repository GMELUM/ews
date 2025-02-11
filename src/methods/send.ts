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
    const timeoutId = setupTimeout(this, ID, callback);
    this.callbackEmitter.set(ID, (response) => {
      clearTimeout(timeoutId);
      callback(response);
      this.callbackEmitter.delete(ID);
    });
    this.client.postMessage([3, [ID, event, data]]);
    return;
  }

  return new Promise<Data<E, "response", ER>["data"]>((resolve) => {
    const timeoutId = setupTimeout(this, ID, resolve);

    this.callbackEmitter.set(ID, (response) => {
      clearTimeout(timeoutId);
      resolve(response);
      this.callbackEmitter.delete(ID);
    });

    this.client.postMessage([3, [ID, event, data]]);
  });
};

function setupTimeout<E extends Events, ER>(
  ctx: CTX,
  id: number,
  resolve: (data: Data<E, "response", ER>["data"]) => void
) {
  return setTimeout(() => {
    ctx.callbackEmitter.delete(id);
    resolve({
      error: {
        code: 1001,
        message: "Request rejected due to timeout duration",
        critical: true,
      },
    } as unknown as Data<E, "response", ER>["data"]);
  }, 10000);
}

export default send;
