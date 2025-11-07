import { CTX } from "../types";

function terminate(this: CTX) {
    this.client.postMessage([3]);
}

export default terminate;
