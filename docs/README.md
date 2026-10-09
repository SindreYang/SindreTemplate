# 目录与文档导航

`src` 是唯一发布代码目录；`src/index.ts` 是全局惰性加载入口；`tests` 存放行为测试；`docs` 说明目录职责、输入输出和边界；`dist` 是构建产物，不修改或提交。每个功能只在所属模块实现，不将 Studio 的路由、鉴权、业务配置复制进库。

| 目录 | 职责 | 详细文档 |
| --- | --- | --- |
| `src/general` | 跨运行时读写、Axios HTTP、Pino 日志与文件适配器 | [general.md](modules/general.md) |
| `src/utils2d` | 原生 Canvas 2D 几何、标注绘制 | [utils2d.md](modules/utils2d.md) |
| `src/utils3d` | Three.js 加载、场景操作、局部网格编辑、清理 | [utils3d.md](modules/utils3d.md) |
| `src/ai` | MediaPipe、TF.js、ONNX 统一惰性入口及独立后端 | [ai.md](ai.md) |
| `src/utilsagent` | LangChain 消息、多模态 Agent 与 SSE 输出 | [utilsagent.md](modules/utilsagent.md) |
| `src/utilsui` | shadcn/ui + Tailwind 宿主组件适配与 Markdown | [utilsui.md](modules/utilsui.md) |

[architecture.md](architecture.md) 说明依赖与调用方式；[development.md](guides/development.md) 说明验证和发布门槛；[roadmap.md](guides/roadmap.md) 列出首版与后续范围。
常见调用参见 [examples.md](guides/examples.md)。每个目录最多 5 个直接文件；模块文档置于 `modules`，开发指南置于 `guides`。
