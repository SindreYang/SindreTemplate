import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage, type BaseMessage, type ContentBlock } from "@langchain/core/messages";
import { createAgent } from "langchain";

export type AgentInput = string | BaseMessage[];
export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool"; phase: "started" | "output" | "finished" | "error"; data: unknown }
  | { type: "progress"; data: unknown }
  | { type: "interrupt"; data: unknown }
  | { type: "done"; message: AIMessage; messages: BaseMessage[] };

export interface OpenAICompatibleAgentOptions {
  model: string;
  apiKey: string;
  /** Include /v1 if required by the provider. Must implement chat completions. */
  baseURL?: string;
  systemPrompt?: string;
  tools?: NonNullable<Parameters<typeof createAgent>[0]["tools"]>;
  temperature?: number;
}

function inputMessages(input: AgentInput): BaseMessage[] {
  return typeof input === "string" ? [new HumanMessage(input)] : input;
}

function lastAnswer(messages: BaseMessage[]): AIMessage {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (AIMessage.isInstance(messages[i])) return messages[i] as AIMessage;
  }
  throw new Error("Agent did not return an AI message");
}

/** Keep LangChain messages intact, including content blocks and tool metadata. */
export function get_openai_compatible_agent(options: OpenAICompatibleAgentOptions) {
  const model = new ChatOpenAI({
    model: options.model,
    apiKey: options.apiKey,
    temperature: options.temperature,
    streamUsage: false,
    ...(options.baseURL ? { configuration: { baseURL: options.baseURL } } : {}),
  });
  const agent = createAgent({ model, tools: options.tools ?? [], systemPrompt: options.systemPrompt });
  return {
    async run(input: AgentInput, config?: { signal?: AbortSignal }) {
      const result = await agent.invoke({ messages: inputMessages(input) }, config);
      return { message: lastAnswer(result.messages), messages: result.messages };
    },
    async *stream(input: AgentInput, config?: { signal?: AbortSignal }): AsyncGenerator<AgentEvent> {
      const events = await agent.streamEvents(
        { messages: inputMessages(input) },
        { version: "v3", signal: config?.signal },
      );
      for await (const event of events) {
        const data = event.params.data as Record<string, unknown>;
        if (event.method === "messages" && data.event === "content-block-delta") {
          const delta = data.delta as Record<string, unknown> | undefined;
          if (delta?.type === "text-delta" && typeof delta.text === "string") {
            yield { type: "text", text: delta.text };
          }
        } else if (event.method === "tools") {
          const phases: Record<string, "started" | "output" | "finished" | "error"> = {
            "tool-started": "started", "tool-output-delta": "output",
            "tool-finished": "finished", "tool-error": "error",
          };
          const phase = phases[String(data.event)];
          if (phase) yield { type: "tool", phase, data };
        } else if (event.method === "custom") {
          yield { type: "progress", data };
        } else if (event.method === "input") {
          yield { type: "interrupt", data };
        }
      }
      const result = await events.output;
      yield { type: "done", message: lastAnswer(result.messages), messages: result.messages };
    },
  };
}

/** Standard LangChain content blocks. Endpoint support varies by model/provider. */
export function get_user_message(...blocks: ContentBlock.Standard[]): HumanMessage {
  return new HumanMessage({ contentBlocks: blocks });
}

export function get_text_block(text: string): ContentBlock.Standard {
  return { type: "text", text };
}

export function get_image_block(url: string): ContentBlock.Standard {
  return { type: "image", url };
}

export function get_media_block(
  type: "image" | "audio" | "video" | "file",
  data: string,
  mimeType: string,
): ContentBlock.Standard {
  return { type, data, mimeType };
}

export { get_agent_sse } from "./sse.js";
