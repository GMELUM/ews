import { setter } from "elum-state/solid";
import { CTX } from "../types"

function terminate(this: CTX) {
    this.client.terminate();
}
export default terminate;
