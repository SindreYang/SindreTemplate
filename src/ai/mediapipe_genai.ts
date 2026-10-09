import { FilesetResolver, LlmInference } from "@mediapipe/tasks-genai";
import { lazy_keyed } from "../general/lazy.js";

export { LlmInference };
const genaiFileset = lazy_keyed((wasmPath: string) => FilesetResolver.forGenAiTasks(wasmPath));

/** Browser on-device LLM. This model is not an OpenAI-compatible remote endpoint. */
export async function get_llm_inference(
  wasmPath: string, options: Parameters<typeof LlmInference.createFromOptions>[1],
): Promise<LlmInference> {
  return LlmInference.createFromOptions(await genaiFileset(wasmPath), options);
}
