import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownView, EmptyState } from "../src/utilsui/markdown.tsx";
import { MarkdownView as LiteMarkdownView } from "../src/utilsui/markdown/lite.tsx";
import { AsyncStatus, PageHeader, SindreUIProvider } from "../src/utilsui/react.tsx";
import { ToastHost, show_toast, dismiss_toast } from "../src/utilsui/toast/index.tsx";
import { Scene3D, Model3D, preload_model } from "../src/utils3d/react.tsx";
import { AvatarImage, CopyButton, DialogBox } from "../src/utilsui/widgets/index.tsx";
import { InfiniteScroll, PaginationControls } from "../src/utilsui/list/index.tsx";
import { ProgressHost, start_progress, set_progress, increment_progress, done_progress, track_progress } from "../src/utilsui/progress/index.tsx";
import { VideoPlayer } from "../src/utilsui/video/index.tsx";
import { SortableList } from "../src/utilsui/dnd/index.tsx";
import { Carousel } from "../src/utilsui/swiper/index.tsx";
import * as vision from "../src/ai/mediapipe.ts";
import * as audio from "../src/ai/mediapipe_audio.ts";
import * as text from "../src/ai/mediapipe_text.ts";
import * as genai from "../src/ai/mediapipe_genai.ts";

test("Markdown renders GFM and code while escaping raw HTML", () => {
  const html = renderToStaticMarkup(<MarkdownView source={'| 项目 | 值 |\n| --- | --- |\n| A | 1 |\n\n```ts\nconst a = 1\n```\n\n<script>alert(1)</script>'} />);
  expect(html).toContain("<table>");
  expect(html).toContain("const a = 1");
  expect(html).toContain("复制代码");
  expect(html).not.toContain("<script>");
  expect(renderToStaticMarkup(<EmptyState title="暂无数据" />)).toContain("暂无数据");
});

test("lightweight Markdown renders safe links without optional Markdown dependencies", () => {
  const html = renderToStaticMarkup(<LiteMarkdownView source="[内部](/articles/demo) [外部](https://example.com) [危险](javascript:alert(1))" />);
  expect(html).toContain('href="/articles/demo"');
  expect(html).toContain('target="_blank"');
  expect(html).toContain("javascript:alert(1)");
  expect(html).not.toContain('href="javascript:alert(1)"');
});

test("UI uses host-provided shadcn components", () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <section data-shadcn="yes">{children}</section>;
  const ui = { Button: Box, Alert: Box, AlertDescription: Box, AlertAction: Box, Empty: Box,
    EmptyHeader: Box, EmptyTitle: Box, EmptyDescription: Box, EmptyContent: Box, Skeleton: Box };
  const html = renderToStaticMarkup(<SindreUIProvider components={ui}>
    <EmptyState title="暂无数据" description="请添加内容" />
    <AsyncStatus busy loadingLabel="读取中">完成</AsyncStatus>
  </SindreUIProvider>);
  expect(html).toContain("data-shadcn");
  expect(html).toContain("暂无数据");
  expect(html).toContain('aria-label="读取中"');
});

test("PageHeader renders a semantic title and the supplied actions", () => {
  const html = renderToStaticMarkup(<PageHeader title="模型" description="浏览模型" eyebrow="工作区" back={{ label: "返回", onClick() {} }} actions={<button>上传</button>} />);
  expect(html).toContain("<header");
  expect(html).toContain("<h1");
  expect(html).toContain("浏览模型");
  expect(html).toContain("返回");
  expect(html).toContain("上传");
  expect(html).toContain("lucide-arrow-left");
});

test("Sonner and React 3D provide isolated React entries", () => {
  expect(renderToStaticMarkup(<ToastHost position="top-right" />)).toContain('aria-live="polite"');
  expect(typeof show_toast).toBe("function");
  expect(typeof dismiss_toast).toBe("function");
  expect(typeof Scene3D).toBe("function");
  expect(typeof Model3D).toBe("function");
  expect(typeof preload_model).toBe("function");
});

test("dialog, avatar and list controls render accessible server markup", () => {
  const html = renderToStaticMarkup(<>
    <DialogBox open title="确认操作" onOpenChange={() => {}} footer={<button>确定</button>}>正文</DialogBox>
    <AvatarImage src="/missing.png" alt="Ada Lovelace" />
    <CopyButton value="hello" />
    <InfiniteScroll hasMore loading={false} onLoadMore={() => {}}><p>项目</p></InfiniteScroll>
    <PaginationControls page={2} pageSize={20} total={50} hasMore onPageChange={() => {}} />
  </>);
  expect(html).toContain("<dialog");
  expect(html).toContain("确认操作");
  expect(html).toContain('aria-label="Ada Lovelace"');
  expect(html).toContain("AL");
  expect(html).toContain("加载更多");
  expect(html).toContain("2 / 3");
  expect(html).toContain("lucide-copy");
  expect(html).toContain("lucide-chevron-right");
});

test("progress host renders SSR styles and async tracking preserves results", async () => {
  expect(renderToStaticMarkup(<ProgressHost />)).toContain("data-sindre-progress");
  start_progress();
  set_progress(0.4);
  increment_progress(0.1);
  done_progress();
  expect(() => set_progress(Number.NaN)).toThrow(RangeError);
  expect(await Promise.all([track_progress(Promise.resolve(1)), track_progress(async () => 2)])).toEqual([1, 2]);
  await expect(track_progress(Promise.reject(new Error("failed")))).rejects.toThrow("failed");
});

test("VideoPlayer accepts a media URL and subtitle metadata in SSR", () => {
  const html = renderToStaticMarkup(<VideoPlayer src="/movie.mp4" title="示例视频" poster="/poster.jpg"
    tracks={[{ src: "/zh.vtt", kind: "subtitles", label: "中文", lang: "zh", default: true }]} />);
  expect(html).toContain("/movie.mp4");
  expect(html).toContain("vds-video-layout");
});

test("drag and carousel entries render their initial content on the server", () => {
  const sorted = renderToStaticMarkup(<SortableList items={[{ id: "a", label: "首项" }]}
    getId={(item) => item.id} renderItem={(item) => item.label} onReorder={() => {}} />);
  expect(sorted).toContain("首项");
  expect(sorted).toContain('aria-label="拖动排序: a"');
  const slides = renderToStaticMarkup(<Carousel items={[{ id: 1, label: "图片一" }]}
    getKey={(item) => item.id} renderSlide={(item) => item.label} />);
  expect(slides).toContain("图片一");
  expect(slides).toContain("swiper-slide");
});

test("all JS MediaPipe task classes have creators", () => {
  expect(vision.vision_task_kinds).toHaveLength(12);
  for (const kind of vision.vision_task_kinds) {
    const creator = `get_${kind.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}` as keyof typeof vision;
    expect(typeof vision[creator]).toBe("function");
  }
  expect(typeof audio.get_audio_classifier).toBe("function");
  for (const kind of text.text_task_kinds) {
    const creator = `get_${kind.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}` as keyof typeof text;
    expect(typeof text[creator]).toBe("function");
  }
  expect(typeof genai.get_llm_inference).toBe("function");
});
