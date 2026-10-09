# 架构与依赖边界

这是一个 npm 包，使用具名子路径导入，例如 `sindrejs/utils3d`，JS/TS 中不使用 Python 式 `sindrejs.utils3d` 属性路径。根入口 `sindrejs` 只提供 `load_module()` 和 `lazy_module()`，不立即引入所有模块；需要同步工具时先 `await load_module("utils2d")`，获得模块后函数仍是同步的。

公共工具函数沿用 sindre 的下划线命名，`load(source)`、`save(value, destination)` 保持数据与路径顺序一致。React 组件用 PascalCase，hooks 用 `useXxx`；第三方类、参数对象和事件仍采用 JS/TS 原生名称。调用方在统一入口和独立后端入口使用同一组 `get_xxx` 名称。

- `general` 不导入 React、Three.js 或 AI 引擎；Axios 与 Pino 是通用基础依赖，`load/save` 位于 `io.ts`，压缩和传输位于 `transfer.ts`，在需要时才动态加载 Node/Bun 文件系统。公开入口只有 `sindrejs/general`。
- 浏览器的本地文件读取传入 `File/Blob`，本地保存传入 File System Access 句柄；URL 用 `fetch`。Node/Bun 的字符串路径代表本地文件，HTTP(S) 字符串代表远程资源。
- 2D 使用浏览器 Canvas 2D API。Three.js、React、AI 引擎是可选 peer dependency，使用对应入口才安装；前端单引擎场景应直接使用 `ai/onnx/web`、`ai/mediapipe` 等明确入口，避免使用聚合 `ai` 入口。
- Agent 的 SSE 传输层与 LangChain 运行时分离，纯 SSE Route Handler 使用 `utilsagent/sse`，只有需要 Agent 编排时才安装并导入 `utilsagent`。
- `utilsui` 通过宿主安装的 shadcn/ui 组件和 Tailwind 主题工作；Provider 注入宿主组件，不固定 Studio 的路径别名和全局 CSS。宿主应让 Tailwind 扫描本包的 UI 构建产物。
- `utilsui/markdown/lite` 是后台编辑器的无生态预览入口；需要 GFM、代码块复制和宿主 shadcn 映射时才使用完整的 `utilsui/markdown`，避免轻量页面被 Markdown 依赖树污染。
- 常规 React UI 按需导入 Lucide 图标。该包是可选 peer，只在 `react`、`widgets`、`list`、`markdown` 子入口使用；`general` 和播放器入口保持独立。
- `utils3d/react` 和 `utilsui/toast` 是独立 React 入口，分别按需加载 R3F/Drei 与 Sonner；通用 `general` 和普通 3D 工具不依赖 React。React App 可以同时消费它们。
- `utilsui/video` 单独加载 Vidstack。播放器只负责浏览器播放和 UI；不支持的编码需由宿主转码后提供可播放的 URL。`general` 的 base64 工具只处理原始字节，不引入播放器。
- `utilsui/dnd` 和 `utilsui/swiper` 是独立 React 入口；只有使用拖放或轮播的宿主才安装 `@dnd-kit/react` 或 `swiper`。轮播 CSS 由宿主引入。
- `utilsui/canvas` 只管理容器尺寸和 CSS 像素坐标；`utilsui/panel` 使用现有 DialogBox 在窄屏展示工具栏。两者不绑定 Next.js、Canvas 渲染器或 Studio 状态。
- AI 按引擎分别提供入口；浏览器 ONNX 为 `onnxruntime-web`，Node 原生 ONNX 为 `onnxruntime-node`。不要在浏览器代码中导入 Node 原生模块。
- `sindrejs/ai` 提供各后端创建器的统一入口，内部惰性导入；仅调用 Node ONNX 创建器时才加载其原生绑定。`lazy_module()` 缓存并发导入，导入失败后可重试。
- MediaPipe Vision、Audio、Text、GenAI 各有子路径，按需安装相应包；模型、WASM 资源由应用指定。
- 每个源代码和文档子目录最多 5 个直接文件。新增内容应先确认模块归属，避免随意拆分为重复入口。
- `utilsagent` 使用 LangChain.js 的 `createAgent` 和 `ChatOpenAI`；模型服务端支持 OpenAI Chat Completions 接口。Agent 请求在可信服务端发起，不在浏览器嵌入 API 密钥。LangChain 依赖仅在该子路径加载。
- Bun 用作包管理、测试和开发；构建产物为标准 ESM + `.d.ts`，核心 API 不需要 Bun。
- 对外暴露的对象要有明确生命周期：AI 推理、Three.js 场景、订阅/流都要能取消或释放。

SindreStudio 的 `api.ts`、`sse.ts`、Canvas 标注与 GLB 导入是需求来源；只有与 Studio 配置无关的能力可以抽取。具体端点、认证与通知文案由 Studio 决定。
