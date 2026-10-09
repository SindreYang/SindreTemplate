"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useShadcnComponents } from "./shadcn.js";
import { cn } from "./styles.js";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  back?: { label: string; onClick: () => void };
  className?: string;
}

/** A page heading with a compact back action and a responsive action slot. */
export function PageHeader({ title, description, eyebrow, actions, back, className }: PageHeaderProps) {
  const ui = useShadcnComponents();
  const backButton = back && (ui
    ? <ui.Button type="button" variant="ghost" size="sm" onClick={back.onClick}><ArrowLeft size={16} aria-hidden="true" />{back.label}</ui.Button>
    : <button type="button" onClick={back.onClick} className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ArrowLeft size={16} aria-hidden="true" />{back.label}</button>);

  return <header className={cn("flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between", className)}>
    <div className="min-w-0 space-y-2">
      {backButton}
      {eyebrow && <p className="text-xs font-medium tracking-wide text-muted-foreground">{eyebrow}</p>}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
      {description && <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>;
}
