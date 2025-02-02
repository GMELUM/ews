import { CTX } from "../types"

function connect(this: CTX) {
    this.client.postMessage([1]);
}

export default connect;
