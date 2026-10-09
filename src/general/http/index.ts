import axios, { AxiosError, type AxiosAdapter, type AxiosInstance, type AxiosRequestConfig } from "axios";
import type { Logger } from "pino";

export class HttpError extends Error {
  constructor(readonly status: number, readonly body: string, options?: ErrorOptions) {
    super(`HTTP ${status}`, options);
    this.name = "HttpError";
  }
}

export interface HttpClientOptions {
  baseURL: string;
  headers?: AxiosRequestConfig["headers"];
  timeout?: number;
  adapter?: AxiosAdapter;
  logger?: Pick<Logger, "debug" | "error">;
  onError?: (error: HttpError) => void | Promise<void>;
}

/** Axios instance plus data-only helpers; instance exposes interceptors and Axios configuration. */
export function get_http_client({ baseURL, headers, timeout, adapter, logger, onError }: HttpClientOptions) {
  const instance: AxiosInstance = axios.create({ baseURL, headers, timeout, adapter });
  const request = async <T>(path: string, config: AxiosRequestConfig = {}): Promise<T> => {
    const logPath = path.split(/[?#]/, 1)[0];
    try {
      const response = await instance.request<T>({ ...config, url: path });
      logger?.debug({ method: config.method ?? "GET", path: logPath, status: response.status }, "HTTP request completed");
      return response.status === 204 ? undefined as T : response.data;
    } catch (reason) {
      if (reason instanceof AxiosError && reason.response) {
        const body = typeof reason.response.data === "string" ? reason.response.data : JSON.stringify(reason.response.data);
        logger?.error({ method: config.method ?? "GET", path: logPath, status: reason.response.status }, "HTTP request failed");
        const error = new HttpError(reason.response.status, body ?? "", { cause: reason });
        try { await onError?.(error); }
        catch (callbackError) { logger?.error({ method: config.method ?? "GET", path: logPath, callbackError }, "HTTP error callback failed"); }
        throw error;
      }
      logger?.error({ method: config.method ?? "GET", path: logPath,
        code: reason instanceof AxiosError ? reason.code : undefined }, "HTTP request failed");
      throw reason;
    }
  };
  return {
    instance,
    request,
    get: <T>(path: string, config?: AxiosRequestConfig) => request<T>(path, { ...config, method: "GET" }),
    post: <T>(path: string, value?: unknown, config?: AxiosRequestConfig) =>
      request<T>(path, { ...config, method: "POST", data: value }),
    delete: <T>(path: string, config?: AxiosRequestConfig) => request<T>(path, { ...config, method: "DELETE" }),
  };
}
