/** Browser ONNX Runtime; configure WASM/WebGPU assets before creating a session. */
import * as ort from "onnxruntime-web";
import { createRunner } from "./runner.js";

export async function get_web_onnx_runner(
  model: string | Uint8Array,
  options?: ort.InferenceSession.SessionOptions,
) {
  // Separate calls preserve the runtime's string and byte-array overloads.
  const session = typeof model === "string"
    ? await ort.InferenceSession.create(model, options)
    : await ort.InferenceSession.create(model, options);
  return createRunner(session);
}
