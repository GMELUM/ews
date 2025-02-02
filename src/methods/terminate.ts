import { CTX } from "../types"

function terminate(this: CTX) {
    this.client.terminate();
}
export default terminate;
