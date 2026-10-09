# SindreTemplate

SindreTemplate 是一个按 Git 分支组织的开发模板仓库。每个模板保持独立
的目录结构、依赖和验证流程；本仓库的 `main` 分支只保存模板索引、统一
规范和工作树管理工具。

## 模板分支

| 模板 | 分支 | 用途 |
| --- | --- | --- |
| PyTorch Hydra | `template/pytorch-hydra` | PyTorch、Hydra、Fabric 实验和训练 |
| CMake | `template/cmake` | 跨平台 C++/CMake 项目 |
| Flask | `template/flask` | 可测试的 Flask 推理服务 |
| Project | `template/project` | 最小 Python 项目 |

完整信息见 [`templates.yaml`](templates.yaml)。

## 使用模板

```powershell
git clone https://github.com/SindreYang/SindreTemplate.git
cd SindreTemplate
git worktree add ..\SindreTemplate-pytorch template/pytorch-hydra
```

也可以直接检出某个模板分支：

```powershell
git clone --branch template/pytorch-hydra https://github.com/SindreYang/SindreTemplate.git my-project
```

列出模板和创建工作树：

```powershell
.\tools\list-templates.ps1
.\tools\worktree.ps1 add pytorch-hydra ..\SindreTemplate-pytorch
```

## 统一约定

- Python 项目使用 `uv` 管理环境和锁文件，不主动修改全局 Python 环境。
- C++ 项目使用 CMake，构建目录放在源码树外。
- 模板必须能从全新克隆目录完成安装、测试和最小启动验证。
- 开发机路径、私有模型、凭据和大体积构建产物不得进入模板。
- 每个模板分支的 README 必须说明安装、运行、测试和目录结构。
