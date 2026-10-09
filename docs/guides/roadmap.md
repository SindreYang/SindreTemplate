# 分阶段范围

## 首版

通用、2D、3D、AI、UI 五个基础模块和惰性引擎入口、TypeScript 类型、运行时适配器、关键行为测试、Studio 使用示例。2D 先做纯几何与绘制；3D 支持 GLTF/GLB、PLY、STL、OBJ 加载与保存及场景工具；AI 先做加载、执行、释放的薄层；UI 先做小型可复用组件。独立 `utilsagent` 提供 LangChain Message、多模态输入、OpenAI 兼容模型调用与 SSE 输出。

## 下一阶段（以实际使用决定）

2D 标注格式互转、mask 与撤销重做；3D 更多格式与带纹理/外部资源模型的跨平台验证；MediaPipe 的分割/手势等统一输出；ONNX 图像前后处理；UI 的图像/模型查看器；Agent 的持久会话与 LangGraph 复杂工作流；针对 Bun 原生文件系统的原子保存与大文件流；在 SindreStudio 按模块逐步接入。

不会在首版复制 SindreStudio 2D/3D 工作室整页，也不把模型权重包含进 npm 包。
