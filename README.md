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

## 适合谁？

如果你要把 Python 算法包装成 HTTP 服务，或者需要一个可以持续扩展的 Flask 后端，可以从这个模板开始。

## 开始使用

```powershell
git clone --branch template/flask --single-branch https://github.com/SindreYang/SindreTemplate.git my-service
cd my-service
uv sync
uv run pytest
uv run python app.py
```

服务启动后访问：

```powershell
curl http://127.0.0.1:5000/health
```

预期响应：

```json
{"status":"ok"}
```

## 模型不存在时会怎样？

模板不会因为模型文件缺失而启动失败：

- /health 仍返回 200。
- 推理接口返回 503。
- 响应会说明后端暂不可用。
- 不会把内部 traceback 直接返回给客户端。

## 目录结构

```text
app.py          应用工厂和本地启动入口
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
