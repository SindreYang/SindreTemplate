# `sindrejs/general`

只用一个入口导入，不再有 `/node` 或 `/bun` 子入口。Node/Bun 的本地路径在调用时动态使用文件系统；浏览器使用 `File`、`Blob`、`Response`、HTTP(S) URL 或 File System Access 文件句柄。

## 历史与版本化存储

```ts
import { create_history, create_versioned_store } from "sindrejs/general";

const history = create_history(initialValue, { limit: 100 });
history.commit(nextValue);
history.replace(previewValue); // 拖拽/滑块预览，不新增一条历史
const previous = history.undo();

const store = create_versioned_store({ read, write });
const current = await store.read();
const result = await store.update(current.version, (value) => update(value));
```

`create_history()` 提供轻量的有界 Undo/Redo 栈；`commit()` 新增历史项，`replace()` 只替换当前项，适合拖拽或滑块的连续预览。调用方负责在提交可变对象前创建快照。`create_versioned_store()` 串行化更新，并在版本过期时返回 `{ ok: false, reason: "conflict" }`；`read` 和 `write` 由应用连接自己的 JSON、数据库或 API 存储。

`create_fixed_window_limiter()` 是单进程内存限流器，默认最多保留 10000 个 key，可用 `max_entries` 调整；适合本地后台或单实例服务，多实例部署应把相同接口接到共享存储。

`to_slug(text, fallback)` 将标题转换为不依赖第三方库的 URL slug，保留中文等 Unicode 字母和数字，连续标点会合并为一个连字符。

```ts
import { to_slug } from "sindrejs/general";
to_slug("SindreJS：后台 3D 编辑器"); // sindrejs-后台-3d-编辑器
```

浏览器导出普通文件可使用 `save_file_with_picker(value, { suggestedName, types })`；它复用 `save()` 的格式处理和文件句柄写入。不支持 File System Access 的浏览器会明确抛错。需要专用格式适配器时可传入第三个参数，例如 3D 模块的 `save`：

```ts
import { save_file_with_picker } from "sindrejs/general";
import { save as save3d } from "sindrejs/general/3d";

await save_file_with_picker(object3d, {
  suggestedName: "model.glb",
  types: [{ description: "GLB model", accept: { "model/gltf-binary": [".glb"] } }],
}, save3d);
```

## 自动读写

```ts
import { load, save, success, error } from "sindrejs/general";

const settings = await load<{ theme: string }>("settings.json");
await save({ theme: "dark" }, "settings.json");
await save("Hello", "notes.md");
const image = await load<Uint8Array>("photo.png");
await save(image, "copy.png");

const result = success(settings); // { success: true, value: settings }
const failed = error(new Error("failed")); // { success: false, error }
```

与 sindre 一致，`load(source)` 接收来源，`save(value, destination)` 先传数据再传目标。`.json` 或 JSON MIME 自动解析/序列化；常见文本扩展名和 `text/*` 自动读取为字符串。`load()` 还接受 `Response` 和 `File`，`save()` 接受文本、JSON 可序列化值、`Uint8Array`、`ArrayBuffer` 或 `Blob`。Node/Bun 的保存会创建父目录。浏览器字符串路径用于网络读取，本地保存需传入 `FileSystemFileHandle`。

| 扩展名 | `load` 默认返回 | `save` 对象输入 |
| --- | --- | --- |
| `.png/.jpg/.jpeg/.webp` | 支持 `createImageBitmap` 时为 `ImageBitmap`；Node 等环境为 `Uint8Array` | `ImageBitmap`、`HTMLCanvasElement`、`OffscreenCanvas` 或原始字节 |
| `.glb/.gltf` | 通过 `sindrejs/general/3d` 返回 Three.js `GLTF` 结果 | 通过 `sindrejs/general/3d` 保存 `Object3D`、`GLTF` 结果 |
| `.ply/.stl` | 通过 `sindrejs/general/3d` 返回 Three.js `BufferGeometry` | 通过 `sindrejs/general/3d` 保存 `Object3D`、`BufferGeometry` |
| `.obj` | 通过 `sindrejs/general/3d` 返回 Three.js `Object3D` | 通过 `sindrejs/general/3d` 保存 `Object3D`、`BufferGeometry` |
| `.onnx` | 原始 `Uint8Array`；推理请使用 `sindrejs/ai/onnx/node` 或 `sindrejs/ai/onnx/web` | 模型原始字节或 `Blob` |
| `.env`、`.env.local` 等 | `Record<string,string>` | 字符串/数字/布尔值组成的对象或原始文本 |
| 其他二进制 | `Uint8Array` | 原始字节或 `Blob` |

```ts
import { load as load3d, save as save3d } from "sindrejs/general/3d";
const model = await load3d("model.glb"); // GLTF，使用后释放场景资源
await save3d(model, "copy.glb");
const geometry = await load3d("shape.ply"); // BufferGeometry
await save3d(geometry, "shape.stl");
const original = await load<Uint8Array>("model.onnx");
// 将 original 传给 sindrejs/ai/onnx/web 或 sindrejs/ai/onnx/node 的 runner
await save(original, "model-copy.onnx");
const config = await load<Record<string, string>>(".env.local");
await save({ API_URL: "https://example.com", DEBUG: false }, ".env.generated");
```

`.env` 解析支持 `KEY=value`、`export KEY=value`、注释和引号中的空格或换行；返回的值都是字符串。`load()` **不会**修改 `process.env`。浏览器可读取用户提供的 `File`；应用不应把服务端密钥文件发布到静态资源目录。

`{ as: "bytes" }` 跳过解析，适用于复制、上传和自定义格式。ONNX runner 不包含可导出的模型原文件，保存时传原始模型字节。GLTF 带外部纹理/缓冲区时可指定 `{ resourcePath }`；URL 默认取所在目录。浏览器需要安装所用后端、部署 WASM/模型，且对资源满足 CORS；Node 中带外部资源的 GLTF 和依赖 DOM 的贴图导出应在目标环境验证。PLY/STL 不保存完整材质、动画，OBJ 也不自动生成关联 `.mtl`。不通过扩展名猜测 CSV、YAML 等内部结构，只返回原文本。

根入口的 `load_module()` 可按需加载 `general`、`utils2d`、`utils3d`、`utils3d_react`、`utilsui_react`、`utilsui_toast`、`utilsui_progress`、`utilsui_video`、`utilsui_widgets`、`utilsui_dialog`、`utilsui_canvas`、`utilsui_panel`、`utilsui_list`、`utilsui_markdown`、`utilsui_dnd`、`utilsui_swiper`、`utilsagent` 或 `ai`。`lazy_module(() => import("..."))` 可包装自定义模块，缓存成功结果，并在失败后允许重试。

`Result` 的辅助函数现在是 `success(value)` 和 `error(reason)`；判别字段为 `result.success`。`safe_parse_json()` 也返回这种结构。旧 `ok/err`、`loadText/loadJSON/saveText/saveJSON` 和显式文件适配器已移除。

`save()` 只接受字符串写入文本格式（包括 `.env`）；图片、模型及其他二进制格式需要原始字节、`Blob` 或相应的图像/Three.js 对象。它不会校验传入的原始字节是否真的属于目标扩展名。Node/Bun 写入本地路径时使用临时文件原子替换，同一路径的并发保存会排队，适合保存后台 JSON 状态。`lazy_keyed(load)` 可按键共享并发资源加载，失败后允许重试；MediaPipe 按 WASM 路径复用 fileset。

## 下载与上传

```ts
import { download_file, download_files, upload_file, zip_folder, upload_zip, save } from "sindrejs/general";

const file = await download_file("https://example.com/report.pdf");
await save(file.data, `/tmp/${file.name}`); // Node/Bun
const many = await download_files(urls, { concurrency: 3, signal });
await upload_file("https://example.com/upload", fileInput.files![0]);
const archive = await zip_folder("./assets"); // Node/Bun 目录，或浏览器 File[]
await upload_zip("https://example.com/upload", "./assets", { filename: "assets.zip" });
```

`download_file()` 返回 `{ name, data, contentType }`，不会自动覆盖磁盘文件；`download_files()` 按输入顺序返回，默认最多三个并发。`upload_file()` 使用 Axios 的 `multipart/form-data`，可传 `File`、`Blob`、字节或本地路径，并接受 `fieldName`、`filename`、`fields`、`headers`、`signal`、Axios `client` 或 `adapter`。本地路径按原始字节上传。不要自己设置 multipart 的 `Content-Type` 边界。`upload_zip()` 可直接上传现成 `.zip` 文件、`Blob`，或先压缩目录、`File[]` 再上传；服务器必须提供相应上传端点。`zip_folder()` 保留相对路径、跳过符号链接。压缩包与下载内容当前都在内存中，大文件应改用流式方案。

## 加解密

```ts
import { encrypt, decrypt, save, load } from "sindrejs/general";

await save(await encrypt("秘密", password), "secret.enc");
const plain = new TextDecoder().decode(await decrypt(await load<Uint8Array>("secret.enc"), password));
```

使用 Web Crypto 的 PBKDF2-SHA-256（210000 次）从密码派生 AES-256-GCM 密钥，每次随机生成 16 字节 salt 和 12 字节 IV。文件头为 `SJS1`，随后是 salt、IV、密文与认证标签。密码错误或数据损坏会抛错；解密返回 `Uint8Array`。应用自行保管密码。浏览器 Web Crypto 需要安全上下文。

## 日志

```ts
import { get_logger, get_file_logger } from "sindrejs/general";

const app = get_logger("Studio", { level: "debug" });
const component = get_logger("ImageCanvas", { parent: app });
component.success({ imageId: 1 }, "渲染完成");
component.warning("纹理尺寸较大");

// Node/Bun 中按需建立文件日志，由调用方负责关闭。
const { logger, close } = await get_file_logger("Studio", { log_dir: "logs", console_output: false });
logger.error({ err: new Error("failed") }, "处理失败");
await close();
```

Pino 提供结构化日志和组件子 logger；默认级别 `debug`，`success` 位于 info 与 warn 之间，`warning/critical` 分别映射到 `warn/fatal`。默认遮盖 `password/token/apiKey/authorization` 等字段，不能依靠它遮盖任意位置的秘密，调用方仍应避免记录凭据。`get_logger("组件名", { parent })` 不会改动宿主 Pino 配置。文件日志显式开启：运行日志按天轮转，错误日志达到 10 MB 时轮转；每个活跃文件之外最多保留当前进程生成的 30 个轮转文件，关闭前完成刷新。浏览器只使用 `get_logger`。不会自动重定向 `console.log` 或接管宿主全局输出。

## Axios 请求

```ts
import { get_http_client, get_logger } from "sindrejs/general";

const http = get_http_client({
  baseURL: "https://example.com/api/",
  timeout: 10_000,
  logger: get_logger("API"),
  onError: (error) => { if (error.status === 401) console.log("需要重新登录"); },
});
const item = await http.get<{ id: number }>("items/1");
await http.post("items", { name: "test" });
http.instance.interceptors.request.use((config) => config);
```

`request/get/post` 返回响应数据；`post` 的 body 可省略，适合登出或触发型接口；非 2xx 响应抛 `HttpError`（含 `status`、`body`，原 AxiosError 在 `cause`），网络中断和取消保留 Axios 原始错误。`onError` 只观察已转换的 `HttpError`，不会改变默认抛错行为。`instance` 是 Axios 实例，可设置拦截器、超时、认证、`signal` 和 adapter。旧 `fetch` 选项改为 Axios `adapter`；上传下载也接受 `client`/`adapter`。请求日志只记录方法、路径、状态，不主动写入请求体和鉴权头。不会自动重试写请求。

## 其他功能

`sleep()`、`retry()` 支持 `AbortSignal`；`SSEDecoder` 和 `read_sse_stream()` 处理流式 UTF-8、CRLF、多行 `data:` 和取消。Agent 使用的 `read_sse_stream` 保持 Fetch `Response` 输入；URL 上传下载受服务端鉴权与浏览器 CORS 配置约束。

流式任务的超时与状态可独立于 SSE 格式管理：

```ts
import { get_stream_lifecycle, read_sse_stream } from "sindrejs/general";

const controller = new AbortController();
const lifecycle = get_stream_lifecycle({
  first_timeout_ms: 30_000, idle_timeout_ms: 60_000,
  on_change: (phase) => console.log(phase),
  on_timeout: () => controller.abort(),
});
try {
  lifecycle.start();
  const response = await fetch("/api/stream", { signal: controller.signal });
  for await (const event of read_sse_stream(response)) {
    lifecycle.activity();
    if (event.event === "approval") lifecycle.wait();
  }
  lifecycle.done();
} catch (error) {
  lifecycle.fail();
  throw error;
} finally {
  lifecycle.dispose();
}
```

状态为 `idle/connecting/active/waiting/success/error/timeout/cancelled`；`start()` 可启动新一轮，`done/fail/cancel` 结束当前轮。超时先进入 `timeout` 再调用 `on_timeout`，此时后续 `fail()` 不会覆盖超时状态。`dispose()` 清理计时器；由调用方中止网络请求。

`runtime/algorithms.ts` 集中放置不依赖 UI 的通用算法，`runtime/index.ts` 导出，并由 `sindrejs/general` 统一公开：

```ts
import { debounce, throttle, copy_text, get_network_status, subscribe_network_status, get_system_status, get_battery_status, subscribe_system_status } from "sindrejs/general";

const search = debounce((query: string) => requestSearch(query), 250);
const scroll = throttle(() => updatePosition(), 100);
search("模型"); // 组件卸载时 search.cancel()；需要立即执行则 search.flush()
const stop = subscribe_network_status((network) => console.log(network.online));
const stopSystem = subscribe_system_status((system) => console.log(system.visibility, system.colorScheme));
const battery = await get_battery_status(); // 不支持或被禁止时为 null
// 按钮点击时：await copy_text("要复制的文本");
// 组件卸载时：stop(); stopSystem(); scroll.cancel();
```

浏览器 `online` 只是连接提示，不代表 API 可达；网络质量信息是可选字段。系统状态包括页面可见性、深浅色、减少动画偏好，以及浏览器可提供的语言、逻辑核心数、设备内存。电池信息是可选异步读取，电量 `level` 为 0～1。SSR 返回 `unknown`/`null`，不触碰 DOM。`copy_text` 需要 HTTPS 或 localhost 等安全上下文及用户手势，失败会抛错。示例中的 `requestSearch/updatePosition` 由宿主实现。

## 任意文件与 base64

```ts
import { file_to_base64, base64_to_file, base64_to_blob, base64_to_bytes, bytes_to_base64, save } from "sindrejs/general";

const encoded = await file_to_base64(file); // File、Blob、Response、文件句柄、字节、路径或 HTTP URL
const dataUrl = await file_to_base64(file, { dataUrl: true });
const restored = base64_to_file(dataUrl, "copy.bin"); // 浏览器或支持 File 的运行时
const raw = base64_to_bytes(encoded);
await save(raw, "copy.bin"); // Node/Bun
const blob = base64_to_blob(dataUrl); // MIME 默认取 data URL
const again = bytes_to_base64(raw);
```

函数按原始字节处理，适用于任何文件格式；不会把视频、图片等内容重新编码。`file_to_base64` 默认返回纯 base64，`{ dataUrl: true, mimeType }` 返回带 MIME 的 data URL。`base64_to_bytes` 接受纯 base64、URL-safe base64 或 data URL，非法输入抛错。`base64_to_file` 需要运行时提供 `File`；否则用字节或 Blob 再交给 `save`。大文件转换会在内存中保留完整内容，宜改为流式处理。
