import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  outputFileTracingRoot: resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
};
export default nextConfig;
