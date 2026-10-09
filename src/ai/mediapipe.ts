/** MediaPipe Tasks Vision. Callers own model/WASM assets and must close each task. */
import {
  FilesetResolver, FaceDetector, FaceLandmarker, GestureRecognizer, HandLandmarker,
  HolisticLandmarker, ImageClassifier, ImageEmbedder, ImageSegmenter,
  InteractiveSegmenter, InteractiveSegmenterLegacy, ObjectDetector, PoseLandmarker,
} from "@mediapipe/tasks-vision";
import { lazy_keyed } from "../general/lazy.js";

export { FaceDetector, FaceLandmarker, GestureRecognizer, HandLandmarker,
  HolisticLandmarker, ImageClassifier, ImageEmbedder, ImageSegmenter,
  InteractiveSegmenter, InteractiveSegmenterLegacy, ObjectDetector, PoseLandmarker };

export const vision_task_kinds = [
  "faceDetector", "faceLandmarker", "gestureRecognizer", "handLandmarker",
  "holisticLandmarker", "imageClassifier", "imageEmbedder", "imageSegmenter",
  "interactiveSegmenter", "interactiveSegmenterLegacy", "objectDetector", "poseLandmarker",
] as const;

const visionFileset = lazy_keyed((wasmPath: string) => FilesetResolver.forVisionTasks(wasmPath));

export const get_face_detector = async (wasmPath: string, options: Parameters<typeof FaceDetector.createFromOptions>[1]) =>
  FaceDetector.createFromOptions(await visionFileset(wasmPath), options);
export const get_face_landmarker = async (wasmPath: string, options: Parameters<typeof FaceLandmarker.createFromOptions>[1]) =>
  FaceLandmarker.createFromOptions(await visionFileset(wasmPath), options);
export const get_gesture_recognizer = async (wasmPath: string, options: Parameters<typeof GestureRecognizer.createFromOptions>[1]) =>
  GestureRecognizer.createFromOptions(await visionFileset(wasmPath), options);
export const get_hand_landmarker = async (wasmPath: string, options: Parameters<typeof HandLandmarker.createFromOptions>[1]) =>
  HandLandmarker.createFromOptions(await visionFileset(wasmPath), options);
export const get_holistic_landmarker = async (wasmPath: string, options: Parameters<typeof HolisticLandmarker.createFromOptions>[1]) =>
  HolisticLandmarker.createFromOptions(await visionFileset(wasmPath), options);
export const get_image_classifier = async (wasmPath: string, options: Parameters<typeof ImageClassifier.createFromOptions>[1]) =>
  ImageClassifier.createFromOptions(await visionFileset(wasmPath), options);
export const get_image_embedder = async (wasmPath: string, options: Parameters<typeof ImageEmbedder.createFromOptions>[1]) =>
  ImageEmbedder.createFromOptions(await visionFileset(wasmPath), options);
export const get_image_segmenter = async (wasmPath: string, options: Parameters<typeof ImageSegmenter.createFromOptions>[1]) =>
  ImageSegmenter.createFromOptions(await visionFileset(wasmPath), options);
export const get_interactive_segmenter = async (wasmPath: string, options: Parameters<typeof InteractiveSegmenter.createFromOptions>[1]) =>
  InteractiveSegmenter.createFromOptions(await visionFileset(wasmPath), options);
export const get_interactive_segmenter_legacy = async (wasmPath: string, options: Parameters<typeof InteractiveSegmenterLegacy.createFromOptions>[1]) =>
  InteractiveSegmenterLegacy.createFromOptions(await visionFileset(wasmPath), options);
export const get_object_detector = async (wasmPath: string, options: Parameters<typeof ObjectDetector.createFromOptions>[1]) =>
  ObjectDetector.createFromOptions(await visionFileset(wasmPath), options);
export const get_pose_landmarker = async (wasmPath: string, options: Parameters<typeof PoseLandmarker.createFromOptions>[1]) =>
  PoseLandmarker.createFromOptions(await visionFileset(wasmPath), options);
