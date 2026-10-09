"use client";

import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type ImgHTMLAttributes } from "react";
import { Check, Copy, TriangleAlert, X } from "lucide-react";
import { copy_text, get_network_status, get_system_status, subscribe_network_status, subscribe_system_status, type NetworkStatus, type SystemStatus } from "../../general/runtime/index.js";
import { useShadcnComponents } from "../shadcn.js";
import { cn } from "../styles.js";

export interface DialogBoxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  className?: string;
}

/** Controlled dialog using the host shadcn primitives, or a native modal fallback. */
export function DialogBox({ open, onOpenChange, title, description, children, footer, closeLabel = "关闭", className }: DialogBoxProps) {
  const ui = useShadcnComponents();
  const dialog = useRef<HTMLDialogElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  const openRef = useRef(open);
  onOpenChangeRef.current = onOpenChange;
  openRef.current = open;
  useEffect(() => {
    if (ui?.Dialog && ui.DialogContent) return;
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open, ui]);

  if (ui?.Dialog && ui.DialogContent && ui.DialogHeader && ui.DialogTitle) {
    return <ui.Dialog open={open} onOpenChange={onOpenChange}>
      <ui.DialogContent className={className}>
        <ui.DialogHeader>
          <ui.DialogTitle>{title}</ui.DialogTitle>
          {description && (ui.DialogDescription ? <ui.DialogDescription>{description}</ui.DialogDescription> : <p>{description}</p>)}
        </ui.DialogHeader>
        {children}
        {footer && (ui.DialogFooter ? <ui.DialogFooter>{footer}</ui.DialogFooter> : <div>{footer}</div>)}
      </ui.DialogContent>
    </ui.Dialog>;
  }
  return <dialog ref={dialog} onClose={() => { if (openRef.current) onOpenChangeRef.current(false); }} className={cn("w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/50", className)} aria-label={title}>
    <div className="mb-4 flex items-start justify-between gap-4">
      <div><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>
      <button type="button" onClick={() => onOpenChange(false)} aria-label={closeLabel} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><X size={18} aria-hidden="true" /></button>
    </div>
    {children}
    {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
  </dialog>;
}

export interface AvatarImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  src?: string | null;
  alt: string;
  fallback?: ReactNode;
  size?: number;
}

/** A circular image with initials on load failure; changing src retries the image. */
export function AvatarImage({ src, alt, fallback, size = 40, className, onError, onLoad, ...props }: AvatarImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;
  const initials = alt.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
  return <span role="img" aria-label={alt} className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium text-muted-foreground", className)} style={{ width: size, height: size }}>
    {(failed || loadedSrc !== src) && (fallback ?? initials)}
    {!failed && <img {...props} src={src} alt="" className={cn("absolute inset-0 h-full w-full object-cover", loadedSrc === src ? "opacity-100" : "opacity-0")} onLoad={(event) => { setLoadedSrc(src); onLoad?.(event); }} onError={(event) => { setFailedSrc(src); onError?.(event); }} />}
  </span>;
}

export interface CopyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  label?: string;
  copiedLabel?: string;
  errorLabel?: string;
  onCopied?: () => void;
  onCopyError?: (error: unknown) => void;
}

/** Copy text on a user gesture; errors remain visible to callers. */
export function CopyButton({ value, label = "复制", copiedLabel = "已复制", errorLabel = "复制失败", onCopied, onCopyError, className, disabled, onClick, ...props }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { if (timer.current !== undefined) clearTimeout(timer.current); }, []);
  return <button {...props} type="button" disabled={disabled || busy} className={cn("inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50", className)} onClick={async (event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    setBusy(true);
    try {
      await copy_text(value);
      setCopied(true);
      setFailed(false);
      onCopied?.();
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) { setCopied(false); setFailed(true); onCopyError?.(error); }
    finally { setBusy(false); }
  }}>{copied ? <Check size={16} aria-hidden="true" /> : failed ? <TriangleAlert size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? copiedLabel : failed ? errorLabel : label}</button>;
}

/** Reactive browser signals. Server rendering starts from an unknown state. */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({ online: null });
  useEffect(() => subscribe_network_status(setStatus), []);
  return status;
}

export function useSystemStatus(): SystemStatus {
  const [status, setStatus] = useState<SystemStatus>({ visibility: "unknown", reducedMotion: null, colorScheme: "unknown" });
  useEffect(() => subscribe_system_status(setStatus), []);
  return status;
}

export { get_network_status, get_system_status };
