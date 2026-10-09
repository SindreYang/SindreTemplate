"use client";

import { isValidElement, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { useShadcnComponents } from "./shadcn.js";
import { cn } from "./styles.js";

/** Untrusted Markdown is rendered as React elements; raw HTML is not enabled. */
export function MarkdownView({ source, className }: { source: string; className?: string }) {
  return <div className={cn("min-w-0 text-foreground [&_a]:text-primary [&_pre]:overflow-x-auto [&_table]:w-full [&_th]:border-b [&_th]:border-border [&_th]:p-2 [&_td]:border-b [&_td]:border-border [&_td]:p-2 [&_h1]:text-2xl [&_h2]:text-xl", className)}>
    <Markdown remarkPlugins={[remarkGfm]} components={{
      pre({ children }) {
        if (!isValidElement<{ className?: string; children?: ReactNode }>(children)) return <pre>{children}</pre>;
        const language = children.props.className?.replace(/^language-/, "");
        return <CodeBlock code={String(children.props.children ?? "").replace(/\n$/, "")} language={language} />;
      },
    }}>{source}</Markdown>
  </div>;
}

export function CodeBlock({ code, language, className, copyLabel = "复制代码" }: {
  code: string; language?: string; className?: string; copyLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const ui = useShadcnComponents();
  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  }
  return <div className={cn("min-w-0 rounded-md border border-border bg-muted text-foreground", className)}>
    <div className="flex items-center justify-between gap-2 border-b border-border p-2">{language && <span>{language}</span>}
      {ui ? <ui.Button type="button" variant="ghost" size="sm" onClick={copy} aria-label={copyLabel}>{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? "已复制" : copyLabel}</ui.Button> :
        <button type="button" onClick={copy} aria-label={copyLabel} className="inline-flex items-center gap-2">{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? "已复制" : copyLabel}</button>}
    </div>
    <pre className="overflow-x-auto p-3"><code>{code}</code></pre>
  </div>;
}

export function EmptyState({ title, description, action, className }: {
  title: string; description?: string; action?: ReactNode; className?: string;
}) {
  const ui = useShadcnComponents();
  if (ui) return <ui.Empty className={className} role="status">
    <ui.EmptyHeader><ui.EmptyTitle>{title}</ui.EmptyTitle>
      {description && <ui.EmptyDescription>{description}</ui.EmptyDescription>}</ui.EmptyHeader>
    {action && <ui.EmptyContent>{action}</ui.EmptyContent>}
  </ui.Empty>;
  return <div className={cn("flex flex-col gap-2 text-muted-foreground", className)} role="status">
    <strong>{title}</strong>
    {description && <p>{description}</p>}
    {action}
  </div>;
}
