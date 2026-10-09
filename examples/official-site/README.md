# SindreJS 官网示例

一个可本地运行的 Bun + React + Next.js 全栈示例。页面介绍 SindreJS 模块，在线演示通过 `get_http_client` 请求 `/api/inspect`；后台工作台通过 `general`、`utilsui` 的真实 API 和组件管理模块状态、JSON 校验、运行记录、文章与 3D 路径。后台使用签名 Cookie 登录，文章、运行记录和 3D 场景使用 `general.load/save` 写入系统临时目录，重启开发服务器后仍可恢复。演示无需 API 密钥或外部服务。

## 运行

从仓库根目录先构建 SindreJS（需要 Bun）：

```sh
bun install
bun run build
cd examples/official-site
bun install
bun run dev -- --port 5000
```

打开 <http://localhost:5000>，后台地址为 <http://localhost:5000/admin>，开发环境默认账号为 `admin / sindrejs-dev`。生产环境不会接受默认配置，必须同时设置 `SINDREJS_ADMIN_PASSWORD` 和独立的 `SINDREJS_ADMIN_SECRET`；登录失败过多时会按来源临时限流。也可以在仓库根目录用 `bun run build` 构建库，然后运行示例。由于 `sindrejs` 使用本地 `file:../..` 依赖，每次改动库源码后都需要重新构建库并重启开发服务器。

## 目录

| 路径 | 用途 |
| --- | --- |
| `app/page.tsx` | 官网首屏、模块列表、页脚 |
| `app/components/playground.tsx` | 可交互的 API 演示 |
| `app/api/inspect/route.ts` | 服务端 JSON 解析接口 |
| `app/admin/page.tsx` | 后台工作台页面 |
| `app/admin/login/page.tsx` | 后台登录 |
| `app/admin/articles/page.tsx` | Markdown 文章编辑与预览 |
| `app/admin/3d/page.tsx` | utils3d 曲线、表面路径、控制点编辑与模型导入工作台 |
| `app/admin/settings/page.tsx` | 登录配置与本地持久化状态 |
| `app/api/admin/` | 登录、概览、运行记录、文章、3D 场景与设置 API |
| `app/articles/` | 已发布文章列表与详情 |
| `app/components/admin-dashboard.tsx` | 复用 SindreJS UI、请求、分页组件的后台界面 |
| `app/globals.css` | 布局、颜色与响应式样式 |

`POST /api/inspect` 接受 `{ "source": "{\"name\":\"SindreJS\"}" }`，成功返回 `success: true`、`data`、`meta`；输入不合法时返回 `success: false`、`error` 与 400/422 状态。输入限制为 20,000 个字符。示例接口不提供认证或持久化；如用于公开服务，请按实际部署环境配置访问控制和限流。
