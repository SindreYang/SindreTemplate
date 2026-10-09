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

## 适合谁？

如果你需要反复进行实验、保存配置、切换数据集和模型，并希望同一套代码支持 CPU、GPU、多 GPU 或混合精度，这个模板可以作为训练项目起点。

## 第一次运行前要改什么？

默认配置使用示例数据集类和示例模型。开始真实训练前，通常需要修改：

- `configs/experiment.yaml`：实验名称、数据目录和日志目录。
- `configs/my_envs/default.yaml`：数据模块、模型、epoch 和设备。
- `src/datamodules/`：替换为自己的数据集。
- `src/models/`：替换为自己的网络和损失函数。
- `src/pipeline/`：调整训练、验证和保存逻辑。

没有真实数据和 checkpoint 时，不要把 `uv run python main.py` 当作安装测试；先运行导入测试：

```powershell
uv run pytest
```

## 常用实验命令

修改 epoch：

```powershell
uv run python main.py my_envs.train.epochs=20
```

切换设备和精度：

```powershell
uv run python main.py my_envs.pipeline.devices=1 my_envs.pipeline.precision=16-mixed
```

启动 Hydra 多组实验：

```powershell
uv run python main.py --multirun my_envs.train.epochs=10,20
```

查看 TensorBoard：

```powershell
uv run tensorboard --logdir logs
```

## 为什么使用这个模板？

- 配置和代码分离，实验参数不用反复改 Python 文件。
- 每次运行都有独立日志目录，方便复现和比较。
- Lightning Fabric 统一处理设备、混合精度和多卡入口。
- Hydra 支持命令行覆盖参数和批量实验。
- uv 锁定依赖，减少“换机器就不能运行”的问题。
