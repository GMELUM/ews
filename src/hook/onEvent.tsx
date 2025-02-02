import { onCleanup, onMount } from "solid-js";
import { CTX, Callback, Events } from "../types";

function onEvents<E extends Events>(this: CTX, callback: Callback<E, "response">) {
    onMount(() => this.callbackEvents.add(callback))
    onCleanup(() => this.callbackEvents.delete(callback))
};

export default onEvents;
