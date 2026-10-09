export type StreamPhase = "idle" | "connecting" | "active" | "waiting" | "success" | "error" | "timeout" | "cancelled";

export interface StreamLifecycleOptions {
  first_timeout_ms?: number;
  idle_timeout_ms?: number;
  on_change?: (phase: StreamPhase) => void;
  on_timeout?: (stage: "first" | "idle") => void;
}

/** Tracks a stream's first event and subsequent idle periods without owning the transport. */
export function get_stream_lifecycle({ first_timeout_ms = 30_000, idle_timeout_ms = 60_000, on_change, on_timeout }: StreamLifecycleOptions = {}) {
  for (const [name, value] of [["first_timeout_ms", first_timeout_ms], ["idle_timeout_ms", idle_timeout_ms]] as const) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive and finite`);
  }
  let phase: StreamPhase = "idle";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const change = (next: StreamPhase) => {
    if (phase === next) return;
    phase = next;
    on_change?.(next);
  };
  const terminal = () => phase === "success" || phase === "error" || phase === "timeout" || phase === "cancelled";
  const arm = (stage: "first" | "idle") => {
    clear();
    timer = setTimeout(() => {
      timer = undefined;
      if (terminal()) return;
      change("timeout");
      on_timeout?.(stage);
    }, stage === "first" ? first_timeout_ms : idle_timeout_ms);
  };
  const finish = (next: "success" | "error" | "cancelled") => {
    if (phase === "idle" || terminal()) return;
    clear(); change(next);
  };
  return {
    get phase() { return phase; },
    start() { clear(); change("connecting"); if (!terminal()) arm("first"); },
    activity() { if (phase === "idle" || terminal()) return; change("active"); if (!terminal()) arm("idle"); },
    wait() { if (phase === "idle" || terminal()) return; change("waiting"); if (!terminal()) arm("idle"); },
    done() { finish("success"); },
    fail() { finish("error"); },
    cancel() { finish("cancelled"); },
    dispose() { clear(); if (!terminal()) phase = "cancelled"; },
  };
}
