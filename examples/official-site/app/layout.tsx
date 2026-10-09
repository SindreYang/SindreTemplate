import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SindreJS — 把基础能力，组合成产品",
  description: "SindreJS 官方示例：通用工具、图像、3D、AI、UI 与 Agent 的 TypeScript 工具库。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
