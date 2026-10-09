# SindreJS Template

这是 `SindreTemplate` 的 `template/sindrejs` 分支：一个可直接复用的
SindreJS TypeScript/Bun 库与 Next.js 官方网站模板。它保留库源码、测试、
文档和 `examples/official-site`，新项目可以从这个分支开始开发自己的库和官网。

模板初始化：

```sh
bun install
bun run check
bun test
bun run build
cd examples/official-site
npm install
npm run check
npm run build
```

网站中的管理后台、文章、3D 页面和 API 路由是示例能力；部署前请替换站点
名称、鉴权密钥、存储配置和示例数据。不要提交 `.env*`、`.next`、`dist` 或
本地依赖目录。

面向浏览器、Node.js 和 Bun 的 TypeScript 工具库。Bun 用于开发和测试；`general` 根据扩展名和运行环境选择读写器。

| 入口 | 用途 |
| --- | --- |
| `sindrejs` | `load_module()` 全局惰性加载器、`lazy_module()` 与 `lazy_keyed()` 包装器 |
| `sindrejs/general` | 自动读写（含 `.env`）、Axios 请求与传输、Pino 日志、ZIP、加解密、SSE、流式任务生命周期与异步工具；不主动加载 3D/ONNX |
| `sindrejs/general/3d` | 显式启用 Three.js 的 GLB/GLTF/PLY/STL/OBJ 读写，避免普通 Webpack 入口扫描 3D 依赖 |
| `sindrejs/utils2d` | Canvas 2D 标注几何与绘制 |
| `sindrejs/utils3d` | Three.js 模型/场景工具、样条、表面路径与局部塑形 |
| `sindrejs/utils3d/react` | React Three Fiber 场景和 Drei 模型、控制器、辅助组件 |
| `sindrejs/ai` | AI 聚合入口；前端按单一引擎使用时优先选择下面的明确子入口 |
| `sindrejs/ai/mediapipe` | MediaPipe Tasks Vision |
| `sindrejs/ai/mediapipe/audio` | MediaPipe Tasks Audio |
| `sindrejs/ai/mediapipe/text` | MediaPipe Tasks Text |
| `sindrejs/ai/mediapipe/genai` | MediaPipe Tasks GenAI |
| `sindrejs/ai/tfjs` | TensorFlow.js 推理 |
| `sindrejs/ai/onnx/web`、`sindrejs/ai/onnx/node` | ONNX Runtime Web / Node |
| `sindrejs/utilsui/react` | shadcn/ui Provider、React 通知与状态组件 |
| `sindrejs/utilsui/toast` | Sonner 操作通知 |
| `sindrejs/utilsui/progress` | NProgress 顶部进度条与异步任务跟踪 |
| `sindrejs/utilsui/video` | Vidstack 统一视频播放器，字幕、封面和流媒体 |
| `sindrejs/utilsui/widgets` | 对话框、圆形容错头像、复制按钮与状态 hooks |
| `sindrejs/utilsui/dialog` | 复用对话框的确认与输入请求队列 |
| `sindrejs/utilsui/canvas` | Canvas/WebGL 容器尺寸、像素比例和指针坐标 |
| `sindrejs/utilsui/panel` | 桌面侧栏与窄屏对话框切换 |
| `sindrejs/utilsui/list` | 分页请求、无限滚动与分页控件 |
| `sindrejs/utilsui/markdown` | Tailwind Markdown、代码块与空状态组件 |
| `sindrejs/utilsui/markdown/lite` | 不依赖 Markdown 生态的轻量预览，适合后台和日志 |
| `sindrejs/utilsui/dnd` | dnd-kit 可排序列表和底层拖放 API |
| `sindrejs/utilsui/swiper` | Swiper React 轮播、导航、分页与响应式布局 |
| `sindrejs/utilsagent` | LangChain 消息、多模态 Agent、流式与 SSE |
| `sindrejs/utilsagent/sse` | 不依赖 LangChain 的 SSE 响应封装 |

先读 [docs/README.md](docs/README.md) 了解目录分工、运行环境和限制。安装并检查：

可运行的 Next.js 前后端官网示例见 [examples/official-site](examples/official-site/README.md)。

```sh
bun install
bun run check
bun run check:isolated
bun test
bun run build
```

当前最小安装有 6 个运行时直接依赖：`axios`、`clsx`、`fflate`、`pino`、`pino-roll`、`tailwind-merge`。React、Lucide、Three.js、Sonner、Vidstack、AI 引擎等是可选 peer dependency，只安装实际使用的入口。例如使用常规 React UI 组件安装 `lucide-react`，使用 3D 入口安装 `three`，浏览器 ONNX 安装 `onnxruntime-web`。

前端项目请优先直接导入明确入口，例如 `sindrejs/general`、`sindrejs/general/3d`、`sindrejs/ai/onnx/web` 或 `sindrejs/utilsui/panel`；`sindrejs/ai` 是聚合 API，适合需要多个 AI 后端的应用，不应作为普通单引擎页面的默认入口。

安装：

```sh
npm install sindrejs
```

```ts
import { load_module } from "sindrejs";
const { get_canvas_point } = await load_module("utils2d");
const { get_face_detector } = await load_module("ai");
```
