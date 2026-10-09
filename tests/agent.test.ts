import { afterAll, expect, test } from "bun:test";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import {
  get_agent_sse, get_openai_compatible_agent, get_image_block, get_text_block, get_user_message,
} from "../src/utilsagent/index.ts";
import { read_sse_stream } from "../src/general/index.ts";

let request: Record<string, unknown> | undefined;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (req, init) => {
    if (!String(req).startsWith("https://mock.example/v1/")) return originalFetch(req, init);
    request = JSON.parse(String(init?.body)) as Record<string, unknown>;
    if (request.stream) {
      const chunks = [
        { id: "chatcmpl-test", object: "chat.completion.chunk", created: 1, model: "mock", choices: [{ index: 0, delta: { role: "assistant", content: "你好" }, finish_reason: null }] },
        { id: "chatcmpl-test", object: "chat.completion.chunk", created: 1, model: "mock", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
      ];
      return new Response(chunks.map((x) => `data: ${JSON.stringify(x)}\n\n`).join("") + "data: [DONE]\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    }
    return Response.json({ id: "chatcmpl-test", object: "chat.completion", created: 1, model: "mock", choices: [{ index: 0, message: { role: "assistant", content: "你好" }, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } });
};
afterAll(() => { globalThis.fetch = originalFetch; });

const agent = get_openai_compatible_agent({ model: "mock", apiKey: "test", baseURL: "https://mock.example/v1" });

test("LangChain message keeps image block and uses chat completions", async () => {
  const input = get_user_message(get_text_block("描述图片"), get_image_block("https://example.com/a.png"));
  expect(input).toBeInstanceOf(HumanMessage);
  const result = await agent.run([input]);
  expect(result.message).toBeInstanceOf(AIMessage);
  expect(result.message.text).toBe("你好");
  const messages = request?.messages as Array<{ content: unknown }>;
  expect(messages[0]?.content).toContainEqual({ type: "image_url", image_url: { url: "https://example.com/a.png" } });
});

test("stream emits text and final answer", async () => {
  const events = [];
  for await (const event of agent.stream("你好")) events.push(event);
  expect(events.filter((e) => e.type === "text").map((e) => e.text).join("")).toBe("你好");
  expect(events.at(-1)?.type).toBe("done");
});

test("SSE output round trips through general reader", async () => {
  async function* events() {
    yield { type: "text" as const, text: "你好" };
    yield { type: "done" as const, message: new AIMessage("你好"), messages: [] };
  }
  const response = get_agent_sse(events());
  const decoded = [];
  for await (const event of read_sse_stream(response)) decoded.push(event);
  expect(decoded.map((e) => e.event)).toEqual(["text", "done"]);
  expect(JSON.parse(decoded[0]!.data).text).toBe("你好");
});
