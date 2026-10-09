# Python Project Template

最小的可测试 Python 项目模板，适合作为业务库、命令行工具或新项目的起点。

## 开始使用

```powershell
uv sync
uv run pytest
uv run sindre-project
```

## 目录

```text
src/project_template/  包源码
tests/                 测试
pyproject.toml         项目、依赖和命令行配置
```

模板不包含开发机路径、全局依赖、构建产物或旧式 `setup.py`。
