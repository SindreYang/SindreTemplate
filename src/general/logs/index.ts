import pino, { type Logger, type LevelWithSilent, type LoggerOptions as PinoOptions } from "pino";

export type SindreLogger = Logger & {
  success: Logger["info"];
  warning: Logger["warn"];
  critical: Logger["fatal"];
};

export interface LoggerOptions {
  level?: LevelWithSilent | "success";
  parent?: Logger;
  redact?: PinoOptions["redact"];
  enabled?: boolean;
}

export interface FileLoggerOptions extends LoggerOptions {
  log_dir?: string;
  console_output?: boolean;
}

export const defaultRedact = {
  paths: ["password", "token", "apiKey", "authorization", "headers.authorization",
    "*.password", "*.token", "*.apiKey"],
  censor: "[Redacted]",
};

function withAliases(logger: Logger): SindreLogger {
  const named = logger as unknown as SindreLogger;
  named.success ??= logger.info.bind(logger);
  named.warning = logger.warn.bind(logger);
  named.critical = logger.fatal.bind(logger);
  return named;
}

/** Component-named logger. A parent logger is never reconfigured. */
export function get_logger(name = "SindreLogger", options: LoggerOptions = {}): SindreLogger {
  if (options.parent) return withAliases(options.parent.child({ component: name }));
  const logger = pino({
    name,
    level: options.level ?? "debug",
    enabled: options.enabled ?? true,
    customLevels: { success: 35 },
    redact: options.redact ?? defaultRedact,
  });
  return withAliases(logger as unknown as Logger);
}

/** Explicit Node/Bun file logging; returns a close method for owned streams. */
export async function get_file_logger(name: string, options: FileLoggerOptions = {}) {
  const path = "./node.js";
  const { createFileLogger } = await import(/* webpackIgnore: true */ path) as typeof import("./node.js");
  return createFileLogger(name, options);
}
