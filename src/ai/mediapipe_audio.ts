import { AudioClassifier, FilesetResolver } from "@mediapipe/tasks-audio";
import { lazy_keyed } from "../general/lazy.js";

export { AudioClassifier };
const audioFileset = lazy_keyed((wasmPath: string) => FilesetResolver.forAudioTasks(wasmPath));

/** MediaPipe Tasks Audio currently exposes AudioClassifier in the JS package. */
export async function get_audio_classifier(
  wasmPath: string,
  options: Parameters<typeof AudioClassifier.createFromOptions>[1],
): Promise<AudioClassifier> {
  const fileset = await audioFileset(wasmPath);
  return AudioClassifier.createFromOptions(fileset, options);
}
