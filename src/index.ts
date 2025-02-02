import { createSignal } from "solid-js";

import connect from "./methods/connect";
import disconnect from "./methods/disconnect";
import terminate from "./methods/terminate";
import send from "./methods/send";
import onEvents from "./hook/onEvent";

import Worker from "./worker?worker&inline";

import {
    CTX,
    Callback,
    Context,
    Events,
    Options,
} from "./types";

function init<E extends Events>(opt: Options): Context<E> {

    const [status, setStatus] = createSignal("disconnected");

    const ctx: CTX = {

        url: opt.url,
        autoConnect: opt.autoConnect,
        autoReconnect: opt.autoReconnect,

        status: status,
        setStatus: setStatus,

        client: new Worker(),
        requestID: 0,
        callbackEmitter: new Map<number, Callback<any, "response">>(),
        callbackEvents: new Set<Callback<any, "response">>(),

    }

    ctx.client.onmessage = (e: MessageEvent<any>) => {
        switch (e.data[1]) {
            case "connecting":
            case "open":
            case "close":
            case "abort":
                return setStatus(e.data[1]);
        }

        for (const clb of ctx.callbackEvents) {
            clb({ event: e.data[1], data: e.data[2] })
        }

        const emmiter = ctx.callbackEmitter.get(e.data[0]);
        if (emmiter) {
            emmiter(e.data[2]);
            ctx.callbackEmitter.delete(e.data[0]);
        }

    }

    ctx.client.postMessage([0, {
        url: ctx.url,
        autoConnect: ctx.autoConnect,
        autoReconnect: ctx.autoReconnect,
    }])

    return {
        status: ctx.status,
        connect: connect.bind(ctx) as typeof connect,
        disconnect: disconnect.bind(ctx) as typeof disconnect,
        terminate: terminate.bind(ctx) as typeof terminate,
        send: send.bind(ctx) as typeof send,
        onEvents: onEvents.bind(ctx) as typeof onEvents,
    } as Context<E>

}

export default init;
