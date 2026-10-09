import { FilesetResolver, LanguageDetector, TextClassifier, TextEmbedder } from "@mediapipe/tasks-text";
import { lazy_keyed } from "../general/lazy.js";

export { LanguageDetector, TextClassifier, TextEmbedder };

export const text_task_kinds = ["languageDetector", "textClassifier", "textEmbedder"] as const;
const textFileset = lazy_keyed((wasmPath: string) => FilesetResolver.forTextTasks(wasmPath));

export async function get_language_detector(
  wasmPath: string, options: Parameters<typeof LanguageDetector.createFromOptions>[1],
): Promise<LanguageDetector> {
  return LanguageDetector.createFromOptions(await textFileset(wasmPath), options);
}
export async function get_text_classifier(
  wasmPath: string, options: Parameters<typeof TextClassifier.createFromOptions>[1],
): Promise<TextClassifier> {
  return TextClassifier.createFromOptions(await textFileset(wasmPath), options);
}
export async function get_text_embedder(
  wasmPath: string, options: Parameters<typeof TextEmbedder.createFromOptions>[1],
): Promise<TextEmbedder> {
  return TextEmbedder.createFromOptions(await textFileset(wasmPath), options);
}
