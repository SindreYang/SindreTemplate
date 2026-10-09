/** Cross-runtime entry: local file access is loaded only when needed. */
import { HttpError } from "./http/index.js";
export { load, save } from "./io.js";
export type { LoadSource, SaveDestination } from "./io.js";
export { upload_file, upload_zip, download_file, download_files, zip_folder } from "./transfer.js";
export type { DownloadedFile, TransferOptions, FileInput } from "./transfer.js";
export { encrypt, decrypt } from "./crypto.js";
export { lazy_module, lazy_keyed } from "./lazy.js";
export { bytes_to_base64, base64_to_bytes, base64_to_blob, base64_to_file, file_to_base64 } from "./base64/index.js";
export type { BinaryInput, Base64FileInput, Base64Options } from "./base64/index.js";
export { debounce, throttle, copy_text, get_network_status, subscribe_network_status, get_system_status, get_battery_status, subscribe_system_status } from "./runtime/index.js";
export type { TimedFunction, NetworkStatus, SystemStatus } from "./runtime/index.js";
export { get_stream_lifecycle } from "./runtime/index.js";
export type { StreamPhase, StreamLifecycleOptions } from "./runtime/index.js";
export { create_history } from "./history.js";
export type { History, HistoryOptions } from "./history.js";
export { create_versioned_store } from "./store.js";
export type { StoreUpdate, VersionedStore, VersionedStoreOptions, VersionedValue } from "./store.js";
export { create_fixed_window_limiter } from "./limiter.js";
export { to_slug } from "./text.js";
export type { FixedWindowLimit, FixedWindowLimiter, FixedWindowLimiterOptions } from "./limiter.js";
export { save_file_with_picker } from "./picker.js";
export type { FilePickerType, SaveFileWriter, SavePickerOptions } from "./picker.js";
export type { LoadOptions } from "./io.js";
export { get_logger, get_file_logger } from "./logs/index.js";
export type { LoggerOptions, FileLoggerOptions, SindreLogger } from "./logs/index.js";
export { get_http_client, HttpError } from "./http/index.js";
export type { HttpClientOptions } from "./http/index.js";

export type Result<T, E = Error> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: E };

export const success = <T>(value: T): Result<T, never> => ({ success: true, value });
export const error = <E>(reason: E): Result<never, E> => ({ success: false, error: reason });

export function safe_parse_json<T = unknown>(source: string): Result<T, SyntaxError> {
  try { return success(JSON.parse(source) as T); }
  catch (reason) { return error(reason as SyntaxError); }
}

export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  factor?: number;
  signal?: AbortSignal;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new RangeError("milliseconds must be finite and nonnegative");
  }
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); reject(signal?.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

export async function retry<T>(
  operation: (attempt: number) => Promise<T> | T,
  { attempts = 3, delayMs = 100, factor = 2, signal, shouldRetry }: RetryOptions = {},
): Promise<T> {
  if (!Number.isSafeInteger(attempts) || attempts < 1) throw new RangeError("attempts must be positive");
  if (!Number.isFinite(delayMs) || delayMs < 0 || !Number.isFinite(factor) || factor < 1) {
    throw new RangeError("delayMs must be nonnegative and factor >= 1");
  }
  for (let attempt = 1; attempt <= attempts; attempt++) {
    signal?.throwIfAborted();
    try { return await operation(attempt); }
    catch (error) {
      signal?.throwIfAborted();
      if (attempt === attempts || shouldRetry?.(error, attempt) === false) throw error;
      await sleep(delayMs * factor ** (attempt - 1), signal);
    }
  }
  throw new Error("unreachable");
}

export interface SSEEvent { data: string; event?: string; id?: string; retry?: number }

/** Incremental Event Stream parser: handles split UTF-8, CRLF, multiline data and trailing frames. */
export class SSEDecoder {
  private decoder = new TextDecoder();
  private buffer = "";
  private data: string[] = [];
  private event?: string;
  private id?: string;
  private retryMs?: number;

  push(chunk: Uint8Array, final = false): SSEEvent[] {
    this.buffer += this.decoder.decode(chunk, { stream: !final });
    const output: SSEEvent[] = [];
    let offset = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      if (this.buffer[i] !== "\n" && this.buffer[i] !== "\r") continue;
      if (this.buffer[i] === "\r" && i === this.buffer.length - 1 && !final) break;
      const line = this.buffer.slice(offset, i);
      if (this.buffer[i] === "\r" && this.buffer[i + 1] === "\n") i++;
      offset = i + 1;
      this.line(line, output);
    }
    this.buffer = this.buffer.slice(offset);
    if (final) {
      if (this.buffer) this.line(this.buffer, output);
      this.line("", output);
      this.buffer = "";
    }
    return output;
  }

  private line(line: string, output: SSEEvent[]) {
    if (line === "") {
      if (this.data.length) {
        output.push({ data: this.data.join("\n"), ...(this.event ? { event: this.event } : {}),
          ...(this.id !== undefined ? { id: this.id } : {}),
          ...(this.retryMs !== undefined ? { retry: this.retryMs } : {}) });
      }
      this.data = []; this.event = undefined; this.retryMs = undefined;
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const name = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (name === "data") this.data.push(value);
    else if (name === "event") this.event = value;
    else if (name === "id" && !value.includes("\0")) this.id = value;
    else if (name === "retry" && /^\d+$/.test(value)) this.retryMs = Number(value);
  }
}

export async function* read_sse_stream(response: Response): AsyncGenerator<SSEEvent> {
  if (!response.ok) throw new HttpError(response.status, await response.text());
  if (!response.body) throw new Error("response has no stream body");
  const reader = response.body.getReader();
  const decoder = new SSEDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      for (const event of decoder.push(value ?? new Uint8Array(), done)) yield event;
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
