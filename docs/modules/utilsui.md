# `src/utilsui`

`dialog/index.tsx` 提供按顺序处理确认和输入请求的 `DialogProvider/useDialog`，复用 `widgets` 中的 `DialogBox`。

React UI 以宿主应用安装的 **shadcn/ui + Tailwind CSS 4** 为核心：`react.tsx` 导出异步状态、`PageHeader` 与 `SindreUIProvider`；`toast/index.tsx` 导出 Sonner toast；`progress/index.tsx` 导出 NProgress 顶部进度条；`video/index.tsx` 导出 Vidstack 视频播放器；`widgets/index.tsx` 导出通用对话框、头像、复制按钮、状态 hooks；`list/index.tsx` 导出分页请求和无限滚动；`markdown.tsx` 导出 Markdown、代码块、空状态。`page_header.tsx` 是标题布局，`shadcn.tsx` 提供组件映射，`styles.ts` 提供 `cn()`。按钮图标从 `lucide-react` 按需导入。项目不复制宿主的 shadcn 源码或全局主题。

后台和轻量编辑器可以使用 `sindrejs/utilsui/markdown/lite`。它不解析 `react-markdown`、GFM 或原始 HTML，只提供标题、段落、列表、行内代码、加粗和 fenced code block，因此不会把完整 Markdown 生态带进只需要简单预览的应用。

```tsx
import { MarkdownView } from "sindrejs/utilsui/markdown";
<MarkdownView source={answer} className="studio-markdown" />
```

在 Studio 等宿主项目中先配置 Tailwind，并使用 shadcn CLI 安装 `button alert empty skeleton`。使用 `utilsui/react`、`utilsui/widgets`、`utilsui/list` 或 `utilsui/markdown` 时安装可选 peer `lucide-react`；然后把已安装组件交给库：

```tsx
import { SindreUIProvider, AsyncStatus } from "sindrejs/utilsui/react";
import { EmptyState, MarkdownView } from "sindrejs/utilsui/markdown";
import { Button } from "@/components/ui/button";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

const components = { Button, Alert, AlertAction, AlertDescription,
  Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, Skeleton };

<SindreUIProvider components={components}>
  <AsyncStatus busy={loading} error={errorMessage}>
    <MarkdownView source={answer} />
    <EmptyState title="暂无结果" />
  </AsyncStatus>
</SindreUIProvider>;
```

## 页面标题与操作通知

在宿主应用安装 `sonner`；在 React 根布局放一个 `ToastHost`。`show_toast` 可从事件处理器或其他浏览器侧代码调用，返回 id 供更新或关闭。

```tsx
import { PageHeader } from "sindrejs/utilsui/react";
import { ToastHost, show_toast, dismiss_toast } from "sindrejs/utilsui/toast";

function ModelsPage() {
  return <>
    <ToastHost />
    <PageHeader title="模型" description="管理模型资源" actions={<button onClick={saveModel}>保存</button>} />
    <button onClick={() => {
      const id = show_toast({
        title: "已保存模型", tone: "success", description: "可以继续编辑",
        action: { label: "查看", onClick: () => openModel() },
      });
      // 需要提前关闭时：dismiss_toast(id)
    }}>保存并提示</button>
  </>;
}
```

上例中的 `saveModel/openModel` 由宿主实现。`PageHeader` 还接受 `eyebrow`、`back: {label,onClick}`、`className`；标题用语义 `h1`，操作区可传入宿主 shadcn Button。Toast 有 `info/success/warning/error`、`duration` 和稳定的 `id`；点击操作后 Sonner 默认关闭通知，操作函数可调用 `event.preventDefault()` 保持显示。

## 顶部进度条

只在使用 `sindrejs/utilsui/progress` 的应用安装 `nprogress`。在 React 根布局挂载一次 `ProgressHost`，无需额外导入 NProgress 的 CSS。颜色默认继承 shadcn 的 `--primary`，高度默认 2px，默认不显示右上角 spinner；可传 `color`、`height`、`showSpinner`、`minimum` 和 `trickleSpeed`。

```tsx
import { ProgressHost, start_progress, set_progress, increment_progress, done_progress, remove_progress, track_progress } from "sindrejs/utilsui/progress";

function App() {
  return <>
    <ProgressHost />
    <button onClick={async () => {
      try { await track_progress(() => fetch("/api/items")); }
      catch (error) { console.error(error); }
    }}>加载</button>
  </>;
}

// 也可手动控制：
start_progress();
set_progress(0.35); // 0～1
increment_progress(0.1);
done_progress();
// 立即移除：remove_progress()
```

`track_progress()` 同时跟踪多个异步任务，最后一个结束后才完成进度；默认延后 120ms 启动，避免短任务闪烁，第二个参数可以调整延时。任务抛错时仍会清理进度，错误继续抛给调用者。手动 API 与 `track_progress()` 共享同一条全局进度条，不要同时控制同一任务。SSR 的手动调用不会访问 DOM。路由跳转可由宿主在开始和结束事件中调用，不绑定特定路由库。

## 统一视频播放器

在宿主项目安装 `@vidstack/react@^1.15.6`。在应用的全局样式入口导入官方布局 CSS：

```ts
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
```

```tsx
import { VideoPlayer } from "sindrejs/utilsui/video";

<VideoPlayer
  src="/videos/demo.mp4" title="演示" poster="/videos/poster.jpg"
  tracks={[{ src: "/videos/zh.vtt", kind: "subtitles", label: "中文", lang: "zh", default: true }]}
  thumbnails="/videos/thumbnails.vtt"
  onError={(error) => console.error(error)}
/>;

// 同一入口可传 m3u8、mpd、YouTube/Vimeo URL、File/Blob、ArrayBuffer、Uint8Array，
// 或 data:video/mp4;base64,...；传原始字节时提供 mimeType，例如 video/webm。
<VideoPlayer src={file} title="本地视频" />;
<VideoPlayer src={bytes} title="字节视频" mimeType="video/webm" />;
```

组件提供 `ref` 获取 Vidstack `MediaPlayerInstance`，其他播放器属性与事件透传。可传 `layoutProps` 调整默认控制区，字幕 `tracks` 使用 Vidstack Track 属性。对象 URL 由组件创建并在源变化/卸载时回收。对于无法在浏览器解码的文件，可用 `resolveSource(input, signal)` 调用宿主转码服务并返回可播放 URL；输入读取失败调用 `onInputError`，播放失败由 `onError` 处理。**任意文件可以读写或转换成 base64，但不能保证任意视频编码直接播放**；可播格式取决于浏览器、Vidstack provider 和已部署的转码能力。Vidstack 默认控制区仍使用其自带图标；宿主可通过 `layoutProps.icons` 自定义。

## 画布与窄屏工具面板

`CanvasViewport` 监听容器尺寸和设备像素比例。`size.width/height` 是 CSS 像素，`pixelWidth/pixelHeight` 适合作为 2D Canvas 的后备画布尺寸；`get_point(event)` 返回相对于容器左上角的 CSS 像素坐标，未挂载时返回 `null`。已有容器可直接调用 `useCanvasViewport()` 并将 `ref` 绑定到元素。调整 Canvas 的 `width/height` 会清空绘图状态，应用需在尺寸变化后重绘；WebGL/R3F 可以只使用容器尺寸，由渲染器管理内部画布。

```tsx
import { CanvasViewport } from "sindrejs/utilsui/canvas";

<CanvasViewport className="h-[50vh] w-full">
  {({ size, get_point }) => <canvas
    width={size.pixelWidth} height={size.pixelHeight}
    className="h-full w-full touch-none"
    onPointerDown={(event) => {
      const point = get_point(event);
      if (point) selectAt(point.x, point.y);
    }}
  />}
</CanvasViewport>;
```

`AdaptivePanel` 在桌面展示侧栏，宽度小于 1024 CSS 像素时复用 `DialogBox` 展示同一份工具内容；窄屏由按钮打开，桌面切换时会关闭对话框。桌面与窄屏切换会重新挂载内容，长时间编辑的值应由宿主保存在面板之外。宿主映射 shadcn Dialog 时沿用其焦点行为，否则使用原生模态对话框。

```tsx
import { useState } from "react";
import { AdaptivePanel } from "sindrejs/utilsui/panel";

function Tools() {
  const [open, setOpen] = useState(false);
  return <AdaptivePanel title="标注工具" open={open} onOpenChange={setOpen}>
    <ToolOptions />
  </AdaptivePanel>;
}
```

两个入口只依赖 React 和现有可选 UI peer。组件的显示/隐藏由自身状态直接保证；如果希望获得默认间距、边框和颜色，还应让 Tailwind 扫描 `dist/utilsui`。断点用于显示方式，不用屏幕宽度推断设备类型。画布组件不自动解释图像缩放或 3D 射线，图像坐标继续用 `utils2d/get_image_point`，3D 点选继续用 `utils3d/get_picked_object`。

## 通用组件和加载

```tsx
import { useState } from "react";
import { DialogBox, AvatarImage, CopyButton, useNetworkStatus, useSystemStatus } from "sindrejs/utilsui/widgets";
import { usePageLoader, InfiniteScroll, PaginationControls } from "sindrejs/utilsui/list";

function Example() {
  const [open, setOpen] = useState(false);
  const network = useNetworkStatus();
  const system = useSystemStatus();
  const list = usePageLoader({
    mode: "append", pageSize: 20,
    loadPage: async (page, pageSize, signal) => {
      const response = await fetch(`/api/items?page=${page}&size=${pageSize}`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json() as { items: { id: string; name: string }[]; total: number };
    },
  });
  return <>
    <AvatarImage src="/avatar.png" alt="Ada Lovelace" />
    <CopyButton value="要复制的内容" onCopyError={console.error} />
    <button onClick={() => setOpen(true)}>打开</button>
    <DialogBox open={open} onOpenChange={setOpen} title="确认操作" footer={<button onClick={() => setOpen(false)}>确定</button>}>
      请检查信息。
    </DialogBox>
    <p>网络：{network.online === null ? "未知" : network.online ? "在线" : "离线"}；页面：{system.visibility}</p>
    <InfiniteScroll hasMore={list.hasMore} loading={list.loading} error={list.error} onRetry={list.retry} onLoadMore={list.load_more}>
      {list.items.map((item) => <p key={item.id}>{item.name}</p>)}
    </InfiniteScroll>
  </>;
}
```

常规分页把 `mode` 改为 `"replace"`（默认），使用 `<PaginationControls page={list.page} pageSize={20} total={list.total} hasMore={list.hasMore} loading={list.loading} onPageChange={list.set_page} />`。`usePageLoader` 每页从 1 起；返回 `items/page/total/hasMore/loading/error/set_page/load_more/retry/reset`。`loadPage` 接收 `AbortSignal`，请求函数应将它传给 fetch/Axios；`hasMore` 优先采用服务端返回值，其次用 `total`，最后按满页推断。追加模式对当前页 `retry()` 会替换该页已有数据，连续触发 `load_more()` 只请求一次。变更筛选条件后调用 `reset()`。`InfiniteScroll` 使用 IntersectionObserver 并保留“加载更多”按钮。

宿主可在 `SindreUIProvider` 映射中额外提供 `Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter`（shadcn/ui 的 dialog 组件）；没有映射时 `DialogBox` 使用浏览器原生模态 `<dialog>`。头像加载中显示圆形文字占位，失败保留占位，更换 `src` 重试。`CopyButton` 在用户点击时复制，失败显示文字并调用 `onCopyError`。系统与网络 hooks 在 SSR 时从未知状态开始，挂载后订阅浏览器事件。

需要从事件处理器等待用户确认或输入时，将 `DialogProvider` 放在应用子树中，子组件通过 `useDialog()` 调用。它沿用上述 `DialogBox` 与宿主 shadcn 组件，按顺序显示请求；取消返回 `false` 或 `null`，Provider 卸载时所有待处理请求也会返回取消值。无需挂载全局事件监听器。

```tsx
import { DialogProvider, useDialog } from "sindrejs/utilsui/dialog";

function RenameButton() {
  const dialog = useDialog();
  return <button onClick={async () => {
    const name = await dialog.prompt({ title: "重命名", default_value: "草稿" });
    if (name !== null && await dialog.confirm({ title: `保存 ${name}？` })) {
      // 调用宿主自己的保存逻辑
    }
  }}>重命名</button>;
}

<DialogProvider><RenameButton /></DialogProvider>;
```

`confirm/prompt` 可指定 `description`、`confirm_label` 和 `cancel_label`，`prompt` 还支持 `placeholder`。`useDialog()` 必须在 Provider 下调用，服务端渲染时不要发起交互请求。

上例的 `@/` 是宿主项目的路径别名，应使用该项目 `components.json` 中的真实别名。Tailwind 4 的宿主样式文件中显式添加 `@source "../node_modules/sindrejs/dist/utilsui";`（按 CSS 文件所在目录调整相对路径），才能生成依赖包里的工具类。主题颜色使用 shadcn 的 `background/foreground/muted/border/primary` 等语义变量。无 Provider 时保留基础标记作为兼容回退。

## 注意

### 拖放与排序

需要拖放的应用安装 `@dnd-kit/react@^0.5` 和 `lucide-react`。`SortableList` 是受控组件：释放后通过 `onReorder` 返回新顺序，由应用更新状态；每项的 ID 必须唯一且稳定。手柄可聚焦，支持 dnd-kit 的键盘排序。

```tsx
import { useState } from "react";
import { SortableList } from "sindrejs/utilsui/dnd";

function Tasks() {
  const [tasks, setTasks] = useState([{ id: "a", title: "准备" }, { id: "b", title: "提交" }]);
  return <SortableList items={tasks} getId={(task) => task.id}
    renderItem={(task) => <span>{task.title}</span>} onReorder={setTasks} />;
}

```

自定义多容器排序或画布拖放时，从同一入口导入 dnd-kit 的 `DragDropProvider`、`DragOverlay`、`useDraggable`、`useDroppable`、`useSortable`、`isSortable`。在 `onDragEnd` 中检查 `canceled`，再用 `operation.source?.id` 与 `operation.target?.id` 更新宿主数据。`SortableList` 自带 Provider，勿在同一拖放场景外再嵌套一层。

### 轮播

需要轮播的应用安装 `swiper@^14.3`，并在宿主的全局样式入口导入：

```ts
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
```

```tsx
import { Carousel } from "sindrejs/utilsui/swiper";

<Carousel items={photos} getKey={(photo) => photo.id}
  renderSlide={(photo) => <img src={photo.url} alt={photo.alt} />}
  slidesPerView={1} spaceBetween={16}
  breakpoints={{ 768: { slidesPerView: 2 }, 1200: { slidesPerView: 3 } }}
  autoplay={{ delay: 5000, disableOnInteraction: true }} />;
```

默认启用导航、可点击分页、键盘操作与无障碍模块；自动播放需显式配置。可透传 Swiper 的 `loop`、`onSlideChange`、`breakpoints` 等属性。复杂布局可从同一入口导入原生 `Swiper` 和 `SwiperSlide`。全局 CSS 由宿主引入一次；服务端渲染输出初始幻灯片，交互在客户端挂载后启动。

## 其他注意

- 不读取 Studio 路由、令牌或全局单例状态。
- SSR 中不要在模块顶层访问 `window`、`document` 或 Canvas；交互事件由组件处理。
- 组件提供标签、角色与键盘行为，CSS 不污染宿主全局样式。
- Markdown 不执行原始 HTML；不要打开 `rehype-raw`。代码复制由用户点击触发，需安全上下文的 Clipboard API。Markdown 样式由宿主的 `className` 提供。
- React 和 Tailwind CSS 是 UI 宿主依赖；`general` 不加载 React。shadcn/ui 的 Button、Alert、Empty、Skeleton 源文件由宿主项目的 CLI 安装，库通过 Provider 组合使用。
- Lucide 仅由常规 React UI 组件按图标具名导入；`general`、AI 和独立的视频入口不加载 Lucide。图标与文字一起显示时将 SVG 标记为装饰；只有图标的关闭按钮提供 `aria-label`。
- Sonner 只由 `sindrejs/utilsui/toast` 引入；在应用根部挂载一次 `ToastHost`，服务端渲染时不调用 `show_toast`。
- NProgress 只由 `sindrejs/utilsui/progress` 引入；全局仅挂载一个 `ProgressHost`，卸载时会还原它设置的 CSS 变量。
