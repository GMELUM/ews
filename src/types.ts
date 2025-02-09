import { Accessor, Setter } from "solid-js";

export enum Status {
  CONNECTING,
  OPEN,
  CLOSE,
  ABORT,
  USER_CLOSED,
}

export type Events = Record<string, Record<"request" | "response" | string, any>>;

export type Data<E extends Events, T extends "request" | "response", ER extends unknown> = {
  [K in keyof E]: {
    event: K;
    data: Result<ER, E[K][T]>;
  };
}[keyof E];

export type Callback<E extends Events, T extends "request" | "response", ER extends unknown> = (
  data: Data<E, T, ER>,
) => void;

export type CallbackEmitter<E extends Events, T extends "request" | "response", ER extends unknown> = (
  data: Data<E, T, ER>["data"],
) => void;

export type CTX = {
  url: string;
  autoConnect: boolean;
  autoReconnect: boolean;

  status: Accessor<Status>;
  setStatus: Setter<Status>;

  client: Worker;
  requestID: number;
  callbackEmitter: Map<number, CallbackEmitter<any, "response", any>>;
  callbackEvents: Set<Callback<any, "response", any>>;
};

export type Context<E extends Events, ER extends unknown> = {
  status: Accessor<Status>;
  connect: () => void;
  disconnect: () => void;
  terminate: () => void;
  send: {
    <K extends keyof E>(event: K, data: E[K]["request"]): Promise<Result<ER, E[K]["response"]>>;
    <K extends keyof E>(event: K, data: E[K]["request"]): Promise<Result<ER, E[K]["response"]>>;
    <K extends keyof E>(event: K, data: E[K]["request"], callback: (data: Result<ER, E[K]["response"]>) => void): void;
    <K extends keyof E>(event: K, data: E[K]["request"], callback: (data: Result<ER, E[K]["response"]>) => void): void;
  };
  onEvents: (callback: Callback<E, "response", ER>) => void;
};

export type Options = {
  url: string;
  autoConnect: boolean;
  autoReconnect: boolean;
};

export type Result<E, R> = {
  error: E;
  response: R;
};
