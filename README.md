# SindreGui PyQt 模板

基于 PyQt5、Qt Designer 和插件入口点的通用桌面应用模板，属于
[`SindreTemplate`](https://github.com/SindreYang/SindreTemplate) 的
`template/pyqt` 分支。

## 快速开始

```bash
uv sync --extra dev
uv run sindre-gui
```

如果你只想验证环境而不打开窗口，可以运行测试：

```powershell
uv run pytest
```

第一次使用 PyQt 时，程序会创建 Qt 应用环境。Windows 用户不需要额外安装 Qt Designer 才能运行模板；仓库已经提交了 Designer 源文件和生成后的 Python 文件。

无界面环境运行测试：

```powershell
$env:QT_QPA_PLATFORM = "offscreen"
uv run pytest
```

## 项目结构

- `src/sindre_gui`：应用、Dock 管理、插件运行时和通用组件。
- `src/sindre_gui/ui/forms`：Qt Designer 源文件。
- `src/sindre_gui/ui/generated`：提交到仓库的 Qt Python 绑定。
- `plugins/examples`：最小外部插件示例。
- `tests`：导入、Qt 窗口和插件运行时测试。

## 生成 Qt 界面代码

修改 `.ui` 文件后执行：

```bash
uv run python -m sindre_gui.ui.generate
```

`.ui` 和生成的 `.py` 文件都保留，确保没有 Qt Designer 的环境也可以运行。

## 插件

插件通过 `sindre_gui.plugins` 入口组发现。完整接口和示例见
[`docs/plugin-development.md`](docs/plugin-development.md)。

主窗口的“视图 → 插件管理”提供发现、加载、卸载和错误诊断。插件加载失败会回滚已经创建的 Dock；刷新插件不会直接丢失已加载实例。

VTK、LMDB、REST 等业务功能不属于核心模板，应作为独立插件安装。

## 什么时候需要独立进程？

普通菜单、表单和轻量业务插件使用进程内模式即可，结构简单、交互直接。VTK、模型推理、大型 LMDB 数据处理或包含不稳定 C/C++ 扩展的插件，建议放到独立插件进程中，通过 IPC 与主窗口通信。核心模板不强制所有插件使用独立进程，避免简单项目承担不必要的复杂度。

### 异常保护

插件运行时由宿主统一管理：

- 加载失败会显示错误提示、保存 traceback，并清理已创建的 Dock。
- 插件回调失败会自动停用插件、卸载其 Dock，并提示用户。
- 卸载异常不会阻止其他资源继续清理。
- 后台线程错误可以通过 Qt 信号转回主线程显示。
- 未捕获的应用异常会显示提示并写入日志。

插件连接 Qt 信号时，应使用宿主提供的 `guard` 包装回调：

```python
button.clicked.connect(
    context.guard(self.on_clicked, "button click")
)
```

Python 层无法隔离 C/C++ 扩展的访问违规、`os._exit()` 或进程级终止。高风险插件应使用独立进程运行。

## 验证

```bash
uv run ruff check .
uv run pytest
uv run python -m build
```
