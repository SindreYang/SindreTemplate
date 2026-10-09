# SindreGui PyQt 模板

基于 PyQt5、Qt Designer 和插件入口点的通用桌面应用模板，属于
[`SindreTemplate`](https://github.com/SindreYang/SindreTemplate) 的
`template/pyqt` 分支。

## 快速开始

```bash
uv sync --extra dev
uv run sindre-gui
```

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

## 验证

```bash
uv run ruff check .
uv run pytest
uv run python -m build
```
