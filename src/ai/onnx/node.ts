/** Native Node ONNX Runtime; not assumed to work under Bun without validation. */
import * as ort from "onnxruntime-node";
import { createRunner } from "./runner.js";

export async function get_node_onnx_runner(
  model: string | Uint8Array,
  options?: ort.InferenceSession.SessionOptions,
) {
  // Separate calls preserve the runtime's string and byte-array overloads.
  const session = typeof model === "string"
    ? await ort.InferenceSession.create(model, options)
    : await ort.InferenceSession.create(model, options);
  return createRunner(session);
}
