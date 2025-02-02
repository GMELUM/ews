import { Accessor, Setter } from "solid-js";

export type Events = Record<string, Record<"request" | "response" | string, any>>

export type Data<E extends Events, T extends "request" | "response"> = {
    [K in keyof E]: { event: K, data: E[K][T] }
}[keyof E]

export type Callback<E extends Events, T extends "request" | "response"> = (data: Data<E, T>) => void;

export type CTX = {

    url: string;
    autoConnect: boolean;
    autoReconnect: boolean;

    status: Accessor<string>;
    setStatus: Setter<string>;

    client: Worker;
    requestID: number;
    callbackEmitter: Map<number, Callback<any, "response">>;
    callbackEvents: Set<Callback<any, "response">>;

}

export type Context<E extends Events> = {
    status: Accessor<string>,
    connect: () => void;
    disconnect: () => void;
    terminate: () => void;
    send: {
        <K extends keyof E>(event: K, data: E[K]["request"]): Promise<E[K]["response"]>
        <K extends keyof E>(event: K, data: E[K]["request"]): Promise<E[K]["response"]>
        <K extends keyof E>(event: K, data: E[K]["request"], callback: (data: E[K]["response"]) => void): void
        <K extends keyof E>(event: K, data: E[K]["request"], callback: (data: E[K]["response"]) => void): void
    };
    onEvents: (callback: Callback<E, "response">) => void;
};

export type Options = {
    url: string;
    autoConnect: boolean;
    autoReconnect: boolean;
}
