import { onCleanup, onMount } from "solid-js";
import { CTX, Callback, Events } from "../types";

function onEvents<E extends Events, ER extends unknown>(this: CTX, callback: Callback<E, "response", ER>) {
  onMount(() => this.callbackEvents.add(callback));
  onCleanup(() => this.callbackEvents.delete(callback));
}

export default onEvents;
