# Flask Inference Service Template

一个可直接启动的 Flask 服务模板，适合文件上传、模型推理、数据处理和内部 API 服务。

它已经包含：

- 应用工厂
- /health 健康检查
- 路由和服务分层
- 上传文件隔离
- 缺少模型时仍能启动
- 缺少模型时返回明确的 503
- Flask 测试配置
- CORS 配置入口
- 统一的 success/error JSON 响应
- GET、POST、图片流、视频流和文件流示例
- 根目录滚动日志 `log/app.log`
- 可选 MCP 适配层
- 结果缓存自动过期和手动删除

## 适合谁？

如果你要把 Python 算法包装成 HTTP 服务，或者需要一个可以持续扩展的 Flask 后端，可以从这个模板开始。

## 开始使用

```powershell
git clone --branch template/flask --single-branch https://github.com/SindreYang/SindreTemplate.git my-service
cd my-service
uv sync
uv sync --extra prod
uv run pytest
uv run python app.py
```

`app.py` 适合本地调试。生产环境使用 WSGI 入口：

```powershell
# Linux/macOS
gunicorn --workers 2 --bind 127.0.0.1:5000 wsgi:app

# Windows 示例
waitress-serve --listen=127.0.0.1:5000 wsgi:app
```

服务启动后访问：

```powershell
curl http://127.0.0.1:5000/health
```

预期响应：

```json
{"success":true,"message":"ok","data":{"status":"ok"}}
```

## 请求和文件流示例

JSON 接口统一使用以下格式：

```json
{"success":true,"message":"ok","data":{}}
{"success":false,"message":"说明","code":"错误码"}
```

```powershell
# GET
curl "http://127.0.0.1:5000/api/examples/hello?name=Sindre"

# POST JSON
curl -X POST http://127.0.0.1:5000/api/examples/echo `
  -H "Content-Type: application/json" -d '{"message":"hello"}'

# POST 返回文件流
curl -X POST http://127.0.0.1:5000/api/examples/file `
  -H "Content-Type: application/json" `
  -d '{"filename":"result.txt","content":"hello"}' `
  -o result.txt
```

图片和视频接口直接返回二进制流，不套 JSON：

```powershell
$env:EXAMPLE_IMAGE_PATH = "D:\data\example.png"
$env:EXAMPLE_VIDEO_PATH = "D:\data\example.mp4"
curl http://127.0.0.1:5000/api/examples/image -o example.png
curl http://127.0.0.1:5000/api/examples/video -o example.mp4
```

默认图片路径是项目根目录 `img.png`，视频路径是 `resources/example.mp4`；文件不存在时返回明确的 404 JSON 错误。

## 上传和下载示例

`/split` 使用 multipart 上传网格文件。成功后，响应 `data.downloads` 会提供结果下载地址：

```powershell
# 上传 PLY/OBJ/STL 文件
curl.exe -X POST http://127.0.0.1:5000/split `
  -F "model=上颌" `
  -F "constraints=200000" `
  -F "refine_switch=1" `
  -F "file=@D:\data\teeth.ply"
```

成功响应示例：

```json
{
  "success": true,
  "message": "ok",
  "data": {
    "job_id": "任务 ID",
    "downloads": {
      "ply": "/split/download/任务 ID/ply",
      "obj": "/split/download/任务 ID/obj",
      "mtl": "/split/download/任务 ID/mtl"
    }
  }
}
```

下载结果文件：

```powershell
curl.exe -L http://127.0.0.1:5000/split/download/<job_id>/ply -o result.ply
curl.exe -L http://127.0.0.1:5000/split/download/<job_id>/obj -o result.obj
curl.exe -L http://127.0.0.1:5000/split/download/<job_id>/mtl -o result.obj.mtl
```

任务完成后可以删除服务端缓存：

```powershell
curl.exe -X DELETE http://127.0.0.1:5000/split/jobs/<job_id>
```

## 模型不存在时会怎样？

模板不会因为模型文件缺失而启动失败：

- /health 仍返回 200。
- 推理接口返回 503。
- 响应会说明后端暂不可用。
- 不会把内部 traceback 直接返回给客户端。

## 配置环境变量

```powershell
# 默认允许所有来源；生产环境可按需收紧
$env:CORS_ORIGINS = "*"
$env:MAX_CONTENT_LENGTH = "104857600"
$env:SPLIT_CACHE_TTL_SECONDS = "86400"
$env:FLASK_HOST = "127.0.0.1"
$env:FLASK_PORT = "5000"
$env:LOG_DIR = "$(Get-Location)\log"
$env:LOG_LEVEL = "INFO"
```

推理结果默认保留 24 小时，服务启动时会清理过期目录。客户端也可以在任务完成后主动释放结果：

```powershell
curl -X DELETE http://127.0.0.1:5000/split/jobs/<job_id>
```

上传超限、路由不存在、方法错误和内部异常都会返回 JSON，而不是 HTML 错误页面。

所有应用日志统一写入 `log/app.log`，单文件 10 MB、保留 5 个滚动备份。日志目录由 `LOG_DIR` 覆盖；不要把运行日志提交到 Git。

## 一键启用 MCP

MCP 是可选能力，不会进入默认运行依赖。安装并启动本地 stdio MCP：

```powershell
uv sync --extra mcp
uv run flask-template-mcp
```

也可以使用官方 MCP CLI 启动 Streamable HTTP：

```powershell
uv run mcp run mcp_server.py --transport streamable-http
```

模板提供 `health`、`echo` 工具和 `config://service` 资源。MCP 只暴露非敏感的模板能力，不会自动暴露任意文件、模型路径或内部异常。

## 目录结构

```text
app.py          应用工厂和本地启动入口
wsgi.py         Gunicorn/Waitress 生产入口
conf/           配置和模型映射
routes/         HTTP 路由
services/       可选服务集成
models/         推理实现和网格工具
tests/          单元测试
resources/      上传文件和结果缓存
pyproject.toml  依赖和工具配置
uv.lock         可复现依赖版本
```

## 生产部署前检查

- 关闭 DEBUG。
- 将 CORS_ORIGINS 限制为实际前端来源。
- 设置上传文件大小和类型限制。
- 定期清理临时文件和结果缓存。
- 使用 WSGI/进程管理器，不使用 Flask 开发服务器。
- 通过反向代理提供 HTTPS。

模板默认对应用、路由、服务和测试执行 Ruff 检查。`models/` 是按你的模型
框架替换的领域代码，可能包含第三方推理库和兼容性导入；它不作为通用服务
框架的 lint 门槛，但必须通过实际接口测试后再部署。
