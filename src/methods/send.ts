import { CTX, Data, Events, Result } from "../types";

type SendOptions = {
  signal?: AbortSignal;
  timeout?: number;
};

const ErrorAborted = {
  error: {
    key: "REQUEST_ABORTED",
    message: "Request was aborted before sending"
  }
};

function send<E extends Events, K extends keyof E, ER extends unknown>(
  this: CTX,
  event: K,
  data: E[K]["request"],
  options?: SendOptions
): Promise<Result<ER, E[K]["response"]>>;

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
  callbackOrOptions?: ((data: Data<E, "response", ER>["data"]) => void) | SendOptions
): Promise<Data<E, "response", ER>["data"]> | void {
  const ID = ++this.requestID;

  const isCallback = typeof callbackOrOptions === "function";
  const signal = !isCallback ? callbackOrOptions?.signal : undefined;
  const timeout = !isCallback ? callbackOrOptions?.timeout ?? 10000 : 10000;

  if (signal?.aborted) {
    if (isCallback) (callbackOrOptions as any)(ErrorAborted);
    return Promise.resolve(ErrorAborted as any);
  }

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

    if (signal) {
      const abortHandler = () => {
        this.callbackEmitter.delete(ID);
        this.client.postMessage([4, ID]);
        resolve(ErrorAborted as unknown as Data<E, "response", ER>["data"]);
        signal.removeEventListener("abort", abortHandler);
      };
      signal.addEventListener("abort", abortHandler);
    }
  });
}

export default send;
