"use client";

import type { MouseEvent } from "react";
import { Toaster, toast, type ToasterProps } from "sonner";
import { cn } from "../styles.js";

export interface ToastAction {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

export interface ToastMessage {
  title: string;
  description?: string;
  tone?: "info" | "success" | "warning" | "error";
  action?: ToastAction;
  duration?: number;
  id?: string | number;
}

/** Mount once in the React app; classes use shadcn/Tailwind semantic colors. */
export function ToastHost({ position = "bottom-right", toastOptions, ...props }: ToasterProps) {
  return <Toaster
    position={position}
    theme="system"
    closeButton
    toastOptions={{
      ...toastOptions,
      classNames: {
        ...toastOptions?.classNames,
        toast: cn("rounded-xl border border-border bg-background text-foreground shadow-md", toastOptions?.classNames?.toast),
        title: cn("font-medium text-foreground", toastOptions?.classNames?.title),
        description: cn("text-muted-foreground", toastOptions?.classNames?.description),
        actionButton: cn("rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90", toastOptions?.classNames?.actionButton),
      },
    }}
    {...props}
  />;
}

/** Display a toast with an optional action. A stable id updates an existing toast. */
export function show_toast({ title, description, tone = "info", action, duration, id }: ToastMessage): string | number {
  return toast[tone](title, { description, action, duration, id });
}

/** Dismiss one toast by id, or all toasts when the id is omitted. */
export function dismiss_toast(id?: string | number): void { toast.dismiss(id); }
