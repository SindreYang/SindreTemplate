# 首版调用示例

```ts
import { load, get_http_client, read_sse_stream } from "sindrejs/general";
import { get_image_point, show_annotation } from "sindrejs/utils2d";
import { set_camera_to_object } from "sindrejs/utils3d";
import { get_face_landmarker, get_web_onnx_runner } from "sindrejs/ai";

const settings = await load<Settings>("settings.json");
const http = get_http_client({ baseURL: "https://example.com/api/" });
const result = await http.get<Result>("items");

const point = get_image_point({ x: 80, y: 50 }, { scale: 2, offsetX: 10, offsetY: 10 });
show_annotation(ctx, { kind: "keypoint", ...point }, { scale: 2, offsetX: 10, offsetY: 10 });

import { load as load3d } from "sindrejs/general/3d";
const gltf = await load3d("/model.glb");
scene.add(gltf.scene);
set_camera_to_object(camera, gltf.scene);

const face = await get_face_landmarker("/mediapipe/wasm", {
  baseOptions: { modelAssetPath: "/models/face.task" },
});
try { console.log(face.detect(image)); } finally { face.close(); }

const onnx = await get_web_onnx_runner("/models/detector.onnx");
try { console.log(await onnx.run({ input: tensor })); } finally { await onnx.release(); }
```

示例中的 `Settings`、`Result`、`ctx`、`scene`、`camera`、`image` 与 `tensor` 由调用方提供。模型输入、输出名称、预处理和后处理以该模型的文档为准。Web 模型/WASM 的静态路径需要应用部署，不能假设包自动提供。
