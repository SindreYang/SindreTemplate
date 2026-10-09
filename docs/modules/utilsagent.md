# utilsagent：多模态 Agent

`src/utilsagent/index.ts` 是独立的服务端 Agent 入口。使用 LangChain.js `createAgent`、`@langchain/core` Message 和 `@langchain/openai` `ChatOpenAI`。模型服务可配置 OpenAI 兼容的 `baseURL`（通常包含 `/v1`），需要支持 Chat Completions。Bun 与 Node.js 可调用，浏览器只消费服务端输出；不要把 API 密钥放进前端。只需要 SSE 响应时使用不加载 LangChain 的 `sindrejs/utilsagent/sse`。

## 调用

```ts
import {
  get_openai_compatible_agent, get_user_message, get_text_block, get_image_block, get_agent_sse,
} from "sindrejs/utilsagent";

const agent = get_openai_compatible_agent({
  baseURL: process.env.MODEL_BASE_URL,
  apiKey: process.env.MODEL_API_KEY!,
  model: "your-model",
  systemPrompt: "请简洁回答。",
});

const input = get_user_message(
  get_text_block("描述这张图"),
  get_image_block("https://example.com/photo.png"),
);
const { message, messages } = await agent.run([input]);
console.log(message.text);

// 在 HTTP handler 中：
return get_agent_sse(agent.stream([input], { signal: request.signal }), request.signal);
```

`run()` 返回最后一条 `AIMessage` 与完整的 LangChain Message 历史；`stream()` 返回 `text`、`tool`、`progress`、`interrupt`、`done` 事件。直接 `for await` 可用于命令行，`get_agent_sse()` 转为 Web `Response`，前端使用 `sindrejs/general` 的 `read_sse_stream(response)` 读取。给 `run`/`stream` 传 `AbortSignal` 可取消模型请求；SSE 等待下一事件时也会立即结束读取。应将同一个信号传给上游 Agent 流，以便终止正在执行的模型或工具请求。

`get_user_message()` 接受标准 LangChain ContentBlock。`get_text_block`、`get_image_block` 提供常用写法；`get_media_block(type, base64, mimeType)` 接收图片、音频、视频或文件的 base64 内容。完整会话可以直接传入 `SystemMessage`、`HumanMessage`、`AIMessage`、`ToolMessage` 等 LangChain 消息，保留工具调用与元数据，不先压成字符串。

## 边界和注意事项

- **OpenAI 兼容接口并不等于所有多模态能力都可用。** 图片、音频、视频、文件分别取决于模型、服务商和接口实现；尤其音频/视频/文件可能需要供应商专有格式。先用目标服务验证，错误直接传给调用方。
- 默认走 Chat Completions，不自动启用 OpenAI Responses API 特性。并非所有兼容服务支持流式 usage，因此关闭 `streamUsage`。
- 工具通过 LangChain tool 对象传给 `tools`。工具执行可能产生外部影响，调用方负责权限、超时和工具输入校验；不要把服务端密钥或内部工具直接暴露到浏览器。
- SSE 事件按帧发送 JSON；网络断开后重连不会自动恢复 Agent 上下文。持久化会话、人工审批后续跑和复杂工作流属于未来的 LangGraph 专用入口。
- Agent 入口的 SSE 使用 Web `ReadableStream` 和 `Response`，安装 Agent 所需依赖：`langchain`、`@langchain/core`、`@langchain/openai` 和 `zod`。纯 SSE Route Handler 可改为 `import { get_agent_sse } from "sindrejs/utilsagent/sse"`，无需安装 LangChain。
