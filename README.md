# Flask Inference Service Template

一个带应用工厂、健康检查、文件上传、模型后端隔离和测试的 Flask 服务模板。
模型权重和具体推理实现不包含在模板中，缺少模型时服务仍可启动，推理请求
会返回明确的 `503`。

## 安装和运行

```powershell
uv sync
uv run pytest
uv run python app.py
```

检查服务：

```powershell
curl http://127.0.0.1:5000/health
```

## 目录

```text
app.py          应用工厂和启动入口
conf/           默认配置及模型映射
models/         推理实现和网格工具
routes/         HTTP 路由
services/       可选服务集成
tests/          隔离测试
resources/      运行时上传和结果缓存
pyproject.toml  uv 项目配置
```

上传接口默认限制网格文件类型和大小，每个任务使用独立缓存目录，避免并发
请求互相覆盖。生产部署时请通过配置设置 `CORS_ORIGINS`，并使用 WSGI/进程
管理器启动服务。
