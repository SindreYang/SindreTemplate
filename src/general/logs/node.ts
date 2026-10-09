import pino, { type DestinationStream } from "pino";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { defaultRedact, type FileLoggerOptions, type SindreLogger } from "./index.js";

export async function createFileLogger(name: string, options: FileLoggerOptions = {}) {
  const directory = options.log_dir ?? "logs";
  await mkdir(directory, { recursive: true });
  const rollPath = "pino-roll";
  const { default: roll } = await import(rollPath) as { default: (options: {
    file: string; frequency?: string; size?: string; limit?: { count: number }; mkdir: boolean;
  }) => Promise<ReturnType<typeof pino.destination>> };
  const run = await roll({ file: join(directory, "run.log"), frequency: "daily", limit: { count: 30 }, mkdir: true });
  const errors = await roll({ file: join(directory, "error.log"), size: "10m", limit: { count: 30 }, mkdir: true });
  const streams: { level?: string; stream: DestinationStream }[] = [
    { stream: run }, { level: "error", stream: errors },
  ];
  if (options.console_output ?? true) streams.push({ stream: process.stderr });
  const base = pino({ name, level: options.level ?? "debug", enabled: options.enabled ?? true,
    customLevels: { success: 35 }, redact: options.redact ?? defaultRedact }, pino.multistream(streams));
  const logger = base as unknown as SindreLogger;
  logger.warning = base.warn.bind(base);
  logger.critical = base.fatal.bind(base);
  return {
    logger,
    async close(): Promise<void> {
      await Promise.all([run, errors].map((stream) => new Promise<void>((resolve, reject) => {
        stream.once("finish", resolve);
        stream.once("error", reject);
        stream.end();
      })));
    },
  };
}
