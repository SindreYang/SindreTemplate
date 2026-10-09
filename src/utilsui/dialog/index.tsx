"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DialogBox } from "../widgets/index.js";
import { useShadcnComponents } from "../shadcn.js";

export interface DialogOptions {
  title: string;
  description?: string;
  confirm_label?: string;
  cancel_label?: string;
}
export interface PromptOptions extends DialogOptions {
  default_value?: string;
  placeholder?: string;
}
export interface DialogActions {
  confirm(options: DialogOptions): Promise<boolean>;
  prompt(options: PromptOptions): Promise<string | null>;
}

type Request = { kind: "confirm" | "prompt"; options: PromptOptions; resolve: (value: any) => void };
const Context = createContext<DialogActions | null>(null);

/** Queues imperative dialogs within a React subtree; all pending promises settle on unmount. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const ui = useShadcnComponents();
  const pending = useRef<Request[]>([]);
  const current = useRef<Request | null>(null);
  const mounted = useRef(true);
  const [active, setActive] = useState<Request | null>(null);
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const enqueue = useCallback((request: Request) => {
    if (!mounted.current) { request.resolve(request.kind === "confirm" ? false : null); return; }
    if (!current.current) {
      current.current = request;
      setValue(request.options.default_value ?? "");
      setActive(request);
    } else pending.current.push(request);
  }, []);
  const settle = useCallback((answer: boolean | string | null) => {
    const request = current.current;
    if (!request) return;
    const next = pending.current.shift() ?? null;
    current.current = next;
    setValue(next?.options.default_value ?? "");
    setActive(next);
    request.resolve(answer);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
    mounted.current = false;
    const requests = [current.current, ...pending.current];
    current.current = null;
    pending.current = [];
    for (const request of requests) request?.resolve(request.kind === "confirm" ? false : null);
    };
  }, []);
  useEffect(() => { if (active?.kind === "prompt") input.current?.focus(); }, [active]);

  const confirm = useCallback((options: DialogOptions) => new Promise<boolean>((resolve) =>
    enqueue({ kind: "confirm", options, resolve })), [enqueue]);
  const prompt = useCallback((options: PromptOptions) => new Promise<string | null>((resolve) =>
    enqueue({ kind: "prompt", options, resolve })), [enqueue]);
  const actions = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);
  const Button = ui?.Button ?? "button";
  return <Context.Provider value={actions}>
    {children}
    <DialogBox open={active !== null} onOpenChange={(open) => { if (!open) settle(active?.kind === "confirm" ? false : null); }}
      title={active?.options.title ?? ""} description={active?.options.description}
      footer={active && <>
        <Button type="button" {...(ui?.Button ? { variant: "outline" } : { className: "rounded-md border border-input px-3 py-2" })}
          onClick={() => settle(active.kind === "confirm" ? false : null)}>{active.options.cancel_label ?? "取消"}</Button>
        <Button type="button" {...(!ui?.Button ? { className: "rounded-md bg-primary px-3 py-2 text-primary-foreground" } : {})}
          onClick={() => settle(active.kind === "confirm" ? true : value)}>{active.options.confirm_label ?? "确定"}</Button>
      </>}>
      {active?.kind === "prompt" && <form onSubmit={(event) => { event.preventDefault(); settle(value); }}>
        <input ref={input} type="text" value={value} onChange={(event) => setValue(event.target.value)}
          placeholder={active.options.placeholder} aria-label={active.options.title}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring" />
      </form>}
    </DialogBox>
  </Context.Provider>;
}

export function useDialog(): DialogActions {
  const actions = useContext(Context);
  if (!actions) throw new Error("useDialog requires DialogProvider");
  return actions;
}
