import { lazy_module } from "../general/lazy.js";
/** One AI entry. Backends are imported only when their function is called. */
const vision = lazy_module(() => import("./mediapipe.js"));
const audio = lazy_module(() => import("./mediapipe_audio.js"));
const language = lazy_module(() => import("./mediapipe_text.js"));
const genai = lazy_module(() => import("./mediapipe_genai.js"));
const tfjs = lazy_module(() => import("./tfjs/index.js"));
const onnx_web = lazy_module(() => import("./onnx/web.js"));
// Keep native bindings outside browser bundler traversal. Node resolves this
// package-relative module only when the Node-specific helper is called.
const onnx_node = lazy_module(() => import(/* webpackIgnore: true */ "./onnx/node.js") as Promise<typeof import("./onnx/node.js")>);
export const get_face_detector: typeof import("./mediapipe.js").get_face_detector = async (...args) => (await vision()).get_face_detector(...args);
export const get_face_landmarker: typeof import("./mediapipe.js").get_face_landmarker = async (...args) => (await vision()).get_face_landmarker(...args);
export const get_gesture_recognizer: typeof import("./mediapipe.js").get_gesture_recognizer = async (...args) => (await vision()).get_gesture_recognizer(...args);
export const get_hand_landmarker: typeof import("./mediapipe.js").get_hand_landmarker = async (...args) => (await vision()).get_hand_landmarker(...args);
export const get_holistic_landmarker: typeof import("./mediapipe.js").get_holistic_landmarker = async (...args) => (await vision()).get_holistic_landmarker(...args);
export const get_image_classifier: typeof import("./mediapipe.js").get_image_classifier = async (...args) => (await vision()).get_image_classifier(...args);
export const get_image_embedder: typeof import("./mediapipe.js").get_image_embedder = async (...args) => (await vision()).get_image_embedder(...args);
export const get_image_segmenter: typeof import("./mediapipe.js").get_image_segmenter = async (...args) => (await vision()).get_image_segmenter(...args);
export const get_interactive_segmenter: typeof import("./mediapipe.js").get_interactive_segmenter = async (...args) => (await vision()).get_interactive_segmenter(...args);
export const get_interactive_segmenter_legacy: typeof import("./mediapipe.js").get_interactive_segmenter_legacy = async (...args) => (await vision()).get_interactive_segmenter_legacy(...args);
export const get_object_detector: typeof import("./mediapipe.js").get_object_detector = async (...args) => (await vision()).get_object_detector(...args);
export const get_pose_landmarker: typeof import("./mediapipe.js").get_pose_landmarker = async (...args) => (await vision()).get_pose_landmarker(...args);
export const get_audio_classifier: typeof import("./mediapipe_audio.js").get_audio_classifier = async (...args) => (await audio()).get_audio_classifier(...args);
export const get_language_detector: typeof import("./mediapipe_text.js").get_language_detector = async (...args) => (await language()).get_language_detector(...args);
export const get_text_classifier: typeof import("./mediapipe_text.js").get_text_classifier = async (...args) => (await language()).get_text_classifier(...args);
export const get_text_embedder: typeof import("./mediapipe_text.js").get_text_embedder = async (...args) => (await language()).get_text_embedder(...args);
export const get_llm_inference: typeof import("./mediapipe_genai.js").get_llm_inference = async (...args) => (await genai()).get_llm_inference(...args);
export const get_graph_runner: typeof import("./tfjs/index.js").get_graph_runner = async (...args) => (await tfjs()).get_graph_runner(...args);
export const dispose_graph_output: (output: Parameters<typeof import("./tfjs/index.js").dispose_graph_output>[0]) => Promise<void> = async (output) => { (await tfjs()).dispose_graph_output(output); };
export const get_web_onnx_runner: typeof import("./onnx/web.js").get_web_onnx_runner = async (...args) => (await onnx_web()).get_web_onnx_runner(...args);
export const get_node_onnx_runner: typeof import("./onnx/node.js").get_node_onnx_runner = async (...args) => (await onnx_node()).get_node_onnx_runner(...args);
