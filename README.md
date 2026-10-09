# SindreTemplate

SindreTemplate 是一组可以直接拿来开始开发的项目模板。

你不需要先搭建目录、配置测试、编写 CI 或猜测启动命令；选择一个模板、创建分支工作树，然后按对应 README 操作即可。

## 我应该选哪个模板？

| 模板 | 适合做什么 | 分支 |
| --- | --- | --- |
| PyTorch Hydra | 深度学习训练、实验管理、多 GPU、混合精度和 TensorBoard | `template/pytorch-hydra` |
| CMake C++ | 跨平台 C++ 库、命令行工具和可选第三方能力 | `template/cmake` |
| Flask | 带健康检查、上传接口和模型后端的 Python 服务 | `template/flask` |
| Python Project | 普通 Python 库、命令行工具和业务项目 | `template/project` |
| PyQt | Windows/Linux 桌面 GUI、Dock 窗口和插件系统 | `template/pyqt` |

完整清单见 [`templates.yaml`](templates.yaml)。每个模板分支都有独立的 README、依赖和验证命令。

## 最简单的用法：直接创建项目

如果你只想开始一个新项目，直接克隆目标分支：

```powershell
git clone --branch template/project --single-branch https://github.com/SindreYang/SindreTemplate.git my-project
cd my-project
uv sync
uv run pytest
```

把 `template/project` 换成你需要的分支即可。

## 开发模板本身：使用 Git worktree

如果你要同时维护多个模板，推荐使用独立工作树：

```powershell
git clone https://github.com/SindreYang/SindreTemplate.git SindreTemplate
cd SindreTemplate
git worktree add ..\SindreTemplate-pyqt template/pyqt
git worktree add ..\SindreTemplate-cmake template/cmake
```

这样每个模板有独立目录和分支，但共享同一个 Git 历史，不会互相覆盖文件。

也可以使用管理脚本：

```powershell
.\tools\list-templates.ps1
.\tools\worktree.ps1 add pyqt ..\SindreTemplate-pyqt
```

## 统一约定

- Python 模板使用 `uv`，不要求把依赖安装到全局 Python。
- C++ 模板使用 CMake，构建目录与源码逻辑分离。
- 每个模板都必须能从全新克隆完成安装、测试和最小启动验证。
- README 必须说明安装、运行、测试和常见错误处理。
- 真实数据、模型权重、凭据、开发机绝对路径和构建产物不进入模板。

## 常见问题

### `uv` 找不到

先安装 uv，然后重新打开终端：

```powershell
irm https://astral.sh/uv/install.ps1 | iex
```

### 我只想复制模板，不想保留模板分支

使用目标分支克隆即可。项目创建后，可以按自己的需求修改 README、项目名和包名。

### 模板能不能混用？

可以，但不要把多个模板目录直接合并。建议选择一个模板作为根项目，再按需复制其中的配置或组件。

## 许可证

各模板沿用本仓库的 MIT 许可，具体以分支中的许可证文件为准。
