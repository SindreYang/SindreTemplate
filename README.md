# PyTorch Hydra Template

一个使用 Hydra 管理实验配置、Lightning Fabric 支持多设备训练的 PyTorch
项目模板。业务代码可从 `src/` 开始替换。

## 环境

```powershell
uv sync
uv run pytest
uv run python main.py
```

GPU、混合精度和多卡参数在 `configs/my_envs/default.yaml` 中配置：

```powershell
uv run python main.py my_envs=default my_envs.train.epochs=20
uv run tensorboard --logdir logs
```

## 目录

```text
configs/       Hydra 配置
datasets/      数据目录，仅保留目录占位文件
src/           数据模块、模型、训练流程和工具
scripts/       可选批处理脚本
tests/         模块导入和基础测试
main.py        训练入口
pyproject.toml uv 项目配置
```

模型权重、真实数据集、日志和构建结果不提交到仓库。
