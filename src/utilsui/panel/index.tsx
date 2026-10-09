"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanelLeft } from "lucide-react";
import { DialogBox } from "../widgets/index.js";
import { useShadcnComponents } from "../shadcn.js";
import { cn } from "../styles.js";

export interface AdaptivePanelProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  triggerLabel?: string;
  className?: string;
  dialogClassName?: string;
}

/** Desktop sidebar; the same content is shown in a modal dialog below 1024 CSS pixels. */
export function AdaptivePanel({ title, open, onOpenChange, children, triggerLabel, className, dialogClassName }: AdaptivePanelProps) {
  const ui = useShadcnComponents();
  const [mobile, setMobile] = useState(false);
  const onOpenChangeRef = useRef(onOpenChange);
  const openRef = useRef(open);
  onOpenChangeRef.current = onOpenChange;
  openRef.current = open;
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => { setMobile(query.matches); if (!query.matches && openRef.current) onOpenChangeRef.current(false); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const Button = ui?.Button ?? "button";
  return <>
    <Button type="button" {...(ui?.Button ? { variant: "outline" } : {})}
      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm lg:hidden"
      style={{ display: mobile ? "inline-flex" : "none" }}
      data-adaptive-panel-trigger="true"
      aria-haspopup="dialog" aria-expanded={mobile && open} onClick={() => onOpenChange(true)}>
      <PanelLeft size={18} aria-hidden="true" />{triggerLabel ?? title}
    </Button>
    {mobile ? <DialogBox open={open} onOpenChange={onOpenChange} title={title}
      className={cn("max-h-[calc(100dvh-2rem)] overflow-y-auto", dialogClassName)}>{children}</DialogBox>
      : <aside className={cn("hidden h-full w-72 shrink-0 overflow-y-auto border-r border-border bg-background p-4 lg:block", className)}
        style={{ display: mobile ? "none" : "block" }} data-adaptive-panel="desktop" aria-label={title}>
        <h2 className="mb-4 text-base font-semibold">{title}</h2>{children}
      </aside>}
  </>;
}
