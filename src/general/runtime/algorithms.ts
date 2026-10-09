export interface TimedFunction<T extends (...args: any[]) => void> {
  (...args: Parameters<T>): void;
  cancel(): void;
  flush(): void;
}

function validateDelay(delayMs: number) {
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new RangeError("delayMs must be finite and nonnegative");
}

/** Run after the last call; cancel drops the pending call and flush runs it now. */
export function debounce<T extends (...args: any[]) => void>(callback: T, delayMs: number): TimedFunction<T> {
  validateDelay(delayMs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: { args: Parameters<T>; context: unknown } | undefined;
  const run = () => {
    timer = undefined;
    const call = latest;
    latest = undefined;
    if (call) callback.apply(call.context, call.args);
  };
  const wrapped = function (this: unknown, ...args: Parameters<T>) {
    latest = { args, context: this };
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(run, delayMs);
  } as TimedFunction<T>;
  wrapped.cancel = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; latest = undefined; };
  wrapped.flush = () => { if (timer !== undefined) { clearTimeout(timer); run(); } };
  return wrapped;
}

/** Run at most once per interval, using the first call and the latest trailing call. */
export function throttle<T extends (...args: any[]) => void>(callback: T, delayMs: number): TimedFunction<T> {
  validateDelay(delayMs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: { args: Parameters<T>; context: unknown } | undefined;
  const trailing = () => {
    timer = undefined;
    const call = latest;
    latest = undefined;
    if (call) {
      callback.apply(call.context, call.args);
      timer = setTimeout(trailing, delayMs);
    }
  };
  const wrapped = function (this: unknown, ...args: Parameters<T>) {
    if (timer === undefined) {
      callback.apply(this, args);
      timer = setTimeout(trailing, delayMs);
    } else latest = { args, context: this };
  } as TimedFunction<T>;
  wrapped.cancel = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; latest = undefined; };
  wrapped.flush = () => {
    if (!latest) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    trailing();
  };
  return wrapped;
}

/** Clipboard writes require a secure browser context and often a user gesture. */
export async function copy_text(value: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard is unavailable; use a secure browser context");
  }
  await navigator.clipboard.writeText(value);
}

interface ConnectionInfo extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}
interface NavigatorWithConnection extends Navigator { connection?: ConnectionInfo }

export interface NetworkStatus {
  online: boolean | null;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

/** Browser signal only: `online` does not prove that a server is reachable. */
export function get_network_status(): NetworkStatus {
  if (typeof navigator === "undefined") return { online: null };
  const connection = (navigator as NavigatorWithConnection).connection;
  return {
    online: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
    ...(connection?.effectiveType ? { effectiveType: connection.effectiveType } : {}),
    ...(connection?.downlink !== undefined ? { downlink: connection.downlink } : {}),
    ...(connection?.rtt !== undefined ? { rtt: connection.rtt } : {}),
    ...(connection?.saveData !== undefined ? { saveData: connection.saveData } : {}),
  };
}

export function subscribe_network_status(listener: (status: NetworkStatus) => void): () => void {
  if (typeof window === "undefined" || typeof navigator === "undefined") return () => {};
  const notify = () => listener(get_network_status());
  const connection = (navigator as NavigatorWithConnection).connection;
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  connection?.addEventListener("change", notify);
  notify();
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
    connection?.removeEventListener("change", notify);
  };
}

export interface SystemStatus {
  visibility: DocumentVisibilityState | "unknown";
  reducedMotion: boolean | null;
  colorScheme: "light" | "dark" | "unknown";
  language?: string;
  hardwareConcurrency?: number;
  deviceMemoryGB?: number;
}

interface BatteryInfo { level: number; charging: boolean }
interface NavigatorWithSystemInfo extends Navigator {
  deviceMemory?: number;
  getBattery?: () => Promise<BatteryInfo>;
}

/** Read non-sensitive browser and display state, returning unknown values during SSR. */
export function get_system_status(): SystemStatus {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { visibility: "unknown", reducedMotion: null, colorScheme: "unknown" };
  }
  const media = typeof window.matchMedia === "function";
  return {
    visibility: document.visibilityState,
    reducedMotion: media ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : null,
    colorScheme: media ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : "unknown",
    ...(typeof navigator !== "undefined" && navigator.language ? { language: navigator.language } : {}),
    ...(typeof navigator !== "undefined" && navigator.hardwareConcurrency ? { hardwareConcurrency: navigator.hardwareConcurrency } : {}),
    ...(typeof navigator !== "undefined" && (navigator as NavigatorWithSystemInfo).deviceMemory ? { deviceMemoryGB: (navigator as NavigatorWithSystemInfo).deviceMemory } : {}),
  };
}

/** Battery is optional and can be blocked by browser policy. */
export async function get_battery_status(): Promise<BatteryInfo | null> {
  if (typeof navigator === "undefined" || !(navigator as NavigatorWithSystemInfo).getBattery) return null;
  try {
    const { level, charging } = await (navigator as NavigatorWithSystemInfo).getBattery!();
    return { level, charging };
  } catch { return null; }
}

export function subscribe_system_status(listener: (status: SystemStatus) => void): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  const notify = () => listener(get_system_status());
  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const color = window.matchMedia?.("(prefers-color-scheme: dark)");
  document.addEventListener("visibilitychange", notify);
  motion?.addEventListener("change", notify);
  color?.addEventListener("change", notify);
  notify();
  return () => {
    document.removeEventListener("visibilitychange", notify);
    motion?.removeEventListener("change", notify);
    color?.removeEventListener("change", notify);
  };
}
