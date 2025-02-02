import { CTX } from "../types"

function disconnect(this: CTX) {
    this.client.postMessage([2]);
}

export default disconnect;
