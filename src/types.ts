import { type Accessor, type Setter } from "solid-js";

export enum Status {
  CONNECTING,    // 0 — Начато подключение
  OPEN,          // 1 — Соединение установлено
  CLOSE,         // 2 — Соединение закрыто (сервером, сетью, по таймауту)
  ABORT,         // 3 — Не удалось переподключиться
  USER_CLOSED,   // 4 — Пользователь вызвал disconnect()
  DUPLICATED,    // 5 — Сервер закрыл из-за дубликата
  TERMINATED,    // 6 — Worker принудительно завершён
}

type StaticMethods = {
  "connection.duplicated": {
    "request": undefined,
    "response": {
      code: 0,
      message: "connection duplicated",
      critical: true,
    }
  },
}

type SendOptions = {
  signal?: AbortSignal;
  timeout?: number;
};

export type Events = Record<string, Record<"request" | "response" | "event" | string, any>>;

export type Data<E extends Events, T extends "request" | "response" | "event", ER extends unknown> = {
  [K in keyof E]: {
    event: K;
    data: Result<ER, E[K][T]>;
  };
}[keyof E];

export type Callback<E extends Events, T extends "request" | "response" | "event", ER extends unknown> = (
  data: Data<E, T, ER>,
) => void;

export type CallbackEmitter<E extends Events, T extends "request" | "response" | "event", ER extends unknown> = (
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
    <K extends keyof E>(event: K, data: E[K]["request"], options?: SendOptions): Promise<Result<ER, E[K]["response"]>>;
    <K extends keyof E>(event: K, data: E[K]["request"], callback: (data: Result<ER, E[K]["response"]> | SendOptions) => void): void;
  };
  onEvents: (callback: Callback<E & StaticMethods, "event", ER>) => void;
};

export type Options = {
  url: string;
  autoConnect: boolean;
  autoReconnect: boolean;
};

export type Result<E, R> =
  | {
    error?: undefined;
    response: R;
  }
  | {
    error: E;
    response?: undefined;
  };
