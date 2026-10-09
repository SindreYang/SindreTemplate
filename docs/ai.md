# `src/ai`

统一入口 `sindrejs/ai`，也提供各后端独立入口。统一入口内创建器惰性导入对应后端；命名采用 `get_face_detector`、`get_web_onnx_runner` 等下划线形式。直接使用任务类（如 `FaceDetector`）时从对应的 MediaPipe 子路径导入。首版只封装加载、推理和释放的稳定流程，不承诺模型结构、输入尺寸、颜色顺序和输出标签一致。

| 文件 | 后端 | 首版能力 |
| --- | --- | --- |
| `index.ts` | 各 AI 后端 | 统一惰性加载与 `get_xxx` 创建器 |
| `mediapipe.ts` | `@mediapipe/tasks-vision` | 12 个公开 Vision Task 类的创建器和原生结果/方法 |
| `mediapipe_audio.ts` | `@mediapipe/tasks-audio` | AudioClassifier |
| `mediapipe_text.ts` | `@mediapipe/tasks-text` | LanguageDetector、TextClassifier、TextEmbedder |
| `mediapipe_genai.ts` | `@mediapipe/tasks-genai` | LlmInference，浏览器本地生成 |
| `tfjs/index.ts` | `@tensorflow/tfjs` | GraphModel 加载、推理、输入张量与输出释放 |
| `onnx/web.ts` | `onnxruntime-web` | Web ONNX 会话、执行与资源释放 |
| `onnx/node.ts` | `onnxruntime-node` | Node 原生 ONNX 会话、执行与资源释放 |

## 注意

MediaPipe Vision 的创建器覆盖 `FaceDetector`、`FaceLandmarker`、`GestureRecognizer`、`HandLandmarker`、`HolisticLandmarker`、`ImageClassifier`、`ImageEmbedder`、`ImageSegmenter`、`InteractiveSegmenter`、`InteractiveSegmenterLegacy`、`ObjectDetector`、`PoseLandmarker`。Audio JS 包当前公开 AudioClassifier；Text 包公开三种任务；GenAI 包公开 LlmInference。每个创建器接受原生 options，输出原生任务实例；检测、分类、分割、嵌入、生成时直接调用实例方法并在结束时 `close()`。

四类任务分别按 WASM 路径共享 fileset 初始化；相同路径的并发调用共用一个 Promise，加载失败后下次调用可以重试。模型任务实例仍由每次创建器调用独立创建和关闭。

```ts
import { get_gesture_recognizer } from "sindrejs/ai";
const task = await get_gesture_recognizer("/wasm/vision", {
  baseOptions: { modelAssetPath: "/models/gesture.task" },
  runningMode: "VIDEO",
});
try { console.log(task.recognizeForVideo(video, performance.now())); }
finally { task.close(); }
```

Audio、Text 与 GenAI 分别从 `sindrejs/ai/mediapipe/audio`、`.../text`、`.../genai` 导入。`InteractiveSegmenter` 的新接口需先 `setImage()` 再 `segment(strokes)`；旧版 `InteractiveSegmenterLegacy` 使用 ROI。部分任务只适用于图片，具体可用方法以实例类型为准，不把所有任务强行统一为 `detect()`。

- 模型路径、WASM 文件地址与 WebGPU 等执行配置由调用者提供；不从第三方 CDN 隐式下载模型。
- MediaPipe 视频任务的帧时间戳必须单调；实时识别需要在 UI 性能允许时使用 Worker。不能假设其同步推理不会阻塞主线程。
- TF.js 推理中创建的张量必须回收；不要回收调用者传入或仍在使用的张量。
- ONNX Web 与 Node 是不同的安装包。会话可释放，输入输出 tensor 的所有权在 API 文档与实现中保持明确。
- Bun 对 `onnxruntime-node` 原生绑定的适配不能从 Node 兼容性推断，必须单独运行验证。
