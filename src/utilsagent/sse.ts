export type SseAgentEvent =
  | { type: "text"; text: string }
  | { type: "tool"; phase: "started" | "output" | "finished" | "error"; data: unknown }
  | { type: "progress"; data: unknown }
  | { type: "interrupt"; data: unknown }
  | { type: "done"; message: unknown; messages: readonly unknown[] };

/** Send normalized agent events to a browser using the Web Response/ReadableStream API. */
export function get_agent_sse(events: AsyncIterable<SseAgentEvent>, signal?: AbortSignal): Response {
  const encoder = new TextEncoder();
  const iterator = events[Symbol.asyncIterator]();
  let closed = false;
  const stop = () => { closed = true; void iterator.return?.().catch(() => undefined); };
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (signal?.aborted) {
        stop();
        controller.close();
        return;
      }
      let onAbort: (() => void) | undefined;
      try {
        const next = signal ? await Promise.race([
          iterator.next(),
          new Promise<"aborted">((resolve) => {
            onAbort = () => resolve("aborted");
            signal.addEventListener("abort", onAbort, { once: true });
            if (signal.aborted) onAbort();
          }),
        ]) : await iterator.next();
        if (next === "aborted") { stop(); controller.close(); return; }
        if (next.done) {
          closed = true;
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(`event: ${next.value.type}\ndata: ${JSON.stringify(next.value)}\n\n`));
      } catch (error) {
        closed = true;
        controller.error(error);
      } finally {
        if (onAbort) signal?.removeEventListener("abort", onAbort);
      }
    },
    async cancel() {
      if (!closed) stop();
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
