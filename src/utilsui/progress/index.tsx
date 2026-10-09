"use client";

import { useEffect } from "react";
import NProgress from "nprogress";

export interface ProgressHostProps {
  color?: string;
  height?: number;
  showSpinner?: boolean;
  minimum?: number;
  trickleSpeed?: number;
}

const progressCSS = `
#nprogress{pointer-events:none}
#nprogress .bar{background:var(--sindre-progress-color,var(--primary,#2563eb));position:fixed;z-index:9999;top:0;left:0;width:100%;height:var(--sindre-progress-height,2px)}
#nprogress .peg{display:block;position:absolute;right:0;width:100px;height:100%;box-shadow:0 0 10px var(--sindre-progress-color,var(--primary,#2563eb)),0 0 5px var(--sindre-progress-color,var(--primary,#2563eb));transform:rotate(3deg) translate(0,-4px)}
#nprogress .spinner{display:block;position:fixed;z-index:9999;top:14px;right:14px}
#nprogress .spinner-icon{width:18px;height:18px;box-sizing:border-box;border:2px solid transparent;border-top-color:var(--sindre-progress-color,var(--primary,#2563eb));border-left-color:var(--sindre-progress-color,var(--primary,#2563eb));border-radius:50%;animation:sindre-progress-spin .6s linear infinite}
@keyframes sindre-progress-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){#nprogress .spinner-icon{animation:none}}
`;

/** Mount once near the React root. It styles only NProgress's own DOM elements. */
export function ProgressHost({ color, height = 2, showSpinner = false, minimum = 0.08, trickleSpeed = 800 }: ProgressHostProps) {
  useEffect(() => {
    const root = document.documentElement.style;
    const oldColor = root.getPropertyValue("--sindre-progress-color");
    const oldHeight = root.getPropertyValue("--sindre-progress-height");
    if (color) root.setProperty("--sindre-progress-color", color);
    root.setProperty("--sindre-progress-height", `${height}px`);
    NProgress.configure({ showSpinner, minimum, trickleSpeed });
    return () => {
      if (color) oldColor ? root.setProperty("--sindre-progress-color", oldColor) : root.removeProperty("--sindre-progress-color");
      oldHeight ? root.setProperty("--sindre-progress-height", oldHeight) : root.removeProperty("--sindre-progress-height");
    };
  }, [color, height, showSpinner, minimum, trickleSpeed]);
  return <style data-sindre-progress>{progressCSS}</style>;
}

function available() { return typeof document !== "undefined"; }

export function start_progress(): void { if (available()) NProgress.start(); }

/** Use a fraction between 0 and 1. */
export function set_progress(fraction: number): void {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new RangeError("progress must be between 0 and 1");
  if (available()) NProgress.set(fraction);
}

export function increment_progress(amount?: number): void {
  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0 || amount > 1)) throw new RangeError("amount must be between 0 and 1");
  if (available()) NProgress.inc(amount);
}

export function done_progress(): void { if (available()) NProgress.done(); }
export function remove_progress(): void { if (available()) NProgress.remove(); }

let pendingTasks = 0;
let startTimer: ReturnType<typeof setTimeout> | undefined;

/** Track overlapping promises as one progress session; fast tasks do not flash the bar. */
export async function track_progress<T>(task: Promise<T> | (() => Promise<T>), delayMs = 120): Promise<T> {
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new RangeError("delayMs must be finite and nonnegative");
  if (++pendingTasks === 1 && available()) {
    startTimer = setTimeout(() => { startTimer = undefined; if (pendingTasks > 0) start_progress(); }, delayMs);
  }
  try { return await (typeof task === "function" ? task() : task); }
  finally {
    if (--pendingTasks === 0) {
      if (startTimer !== undefined) { clearTimeout(startTimer); startTimer = undefined; }
      done_progress();
    }
  }
}
