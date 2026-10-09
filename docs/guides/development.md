# 开发与验证

1. 安装 Bun 与项目依赖：`bun install`。
2. 类型检查：`bun run check`；隔离消费者检查：`bun run check:isolated`；行为测试：`bun test`；构建：`bun run build`。

`check:isolated` 使用一个只导入 `sindrejs/general` 和 `sindrejs/utilsagent/sse` 的最小消费者作为回归门槛。它验证常用入口不会把 3D、ONNX、LangChain 或其他可选依赖带进消费者的类型解析；需要完整适配器测试时，才安装对应的可选 peer dependency。
3. 执行 `bun run test:node` 验证构建产物中的核心 API、3D 场景及 UI 服务端渲染；在 Node.js 中至少导入 `dist/general/index.js` 与 `dist/utils2d/index.js`。
4. 在浏览器构建工具（Studio）中按入口导入，确认通用入口可构建、文件系统动态分支不在浏览器执行，且未使用的 AI/3D 依赖没有混入。
5. 分别对 ONNX Web、ONNX Node、MediaPipe、TF.js 和 Three.js 运行小模型/小场景集成验证；无模型测试不能声称推理结果正确。

提交时文档和代码一起更新。依赖只放在实际模块中。发布前需要确认版本、许可证和兼容目标，并使用 `npm pack --dry-run` 检查包内容。
