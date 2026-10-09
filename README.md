# Python Project Template

一个最小、现代、可测试的 Python 项目模板。适合创建：

- Python 库
- 命令行工具
- 数据处理项目
- 内部业务服务

它已经包含 src/ 布局、测试、Ruff、uv 锁文件和命令行入口，不需要再从零搭建工程结构。

## 适合谁？

如果你只是想写 Python 代码，不需要 Flask、PyTorch 或 Qt，这个模板通常是最好的起点。

## 开始使用

```powershell
git clone --branch template/project --single-branch https://github.com/SindreYang/SindreTemplate.git my-project
cd my-project
uv sync
uv run pytest
uv run sindre-project
```

预期输出：

```text
8
```

## 目录结构

```text
src/project_template/
├── __init__.py
├── cli.py       # 命令行入口
└── math.py      # 示例业务函数

tests/
└── test_math.py

pyproject.toml   # 项目、依赖、命令和工具配置
uv.lock          # 可复现依赖版本
```

## 开发自己的代码

把业务代码放到 src/project_template/，把测试放到 tests/。

```powershell
uv run ruff check .
uv run pytest
uv run python -m build
```

## 添加依赖

不要直接使用全局 pip install。使用 uv：

```powershell
uv add requests
uv add --dev pytest-cov
```

uv 会同步修改 pyproject.toml 和 uv.lock。

## 为什么使用这个模板？

- src/ 布局可以避免测试时误用源码目录。
- uv 创建隔离环境并锁定依赖。
- 测试和代码结构开箱即用。
- 可直接扩展为 Python 包或 CLI。
- 没有旧式 setup.py 和开发机路径。
