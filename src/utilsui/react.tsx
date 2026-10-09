"use client";

import type { ReactNode } from "react";
import { useShadcnComponents } from "./shadcn.js";

export { SindreUIProvider } from "./shadcn.js";
export type { ShadcnComponents } from "./shadcn.js";
export { PageHeader } from "./page_header.js";
export type { PageHeaderProps } from "./page_header.js";

export function AsyncStatus({ busy, error, children, loadingLabel = "Loading…" }: {
  busy: boolean; error?: string | null; children: ReactNode; loadingLabel?: string;
}) {
  const ui = useShadcnComponents();
  if (busy) return <div role="status" aria-busy="true" aria-label={loadingLabel}>
    {ui ? <ui.Skeleton className="h-6 w-full" /> : loadingLabel}
  </div>;
  if (error) return ui ? <ui.Alert variant="destructive" role="alert"><ui.AlertDescription>{error}</ui.AlertDescription></ui.Alert> : <div role="alert">{error}</div>;
  return <>{children}</>;
}
