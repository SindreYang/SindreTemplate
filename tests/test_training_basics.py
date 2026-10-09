from functools import partial
from pathlib import Path

import numpy as np
import torch

from src.datamodules.my_datamodule import MyDataset
from src.models.my_net import MyNet
from src.pipeline.my_pipeline import MyPipeline
from lightning.fabric.loggers import TensorBoardLogger


def _write_sample(root: Path, name: str) -> None:
    sources = root / "sources"
    targets = root / "targets"
    sources.mkdir(parents=True, exist_ok=True)
    targets.mkdir(parents=True, exist_ok=True)
    points = np.arange(48, dtype=np.float32).reshape(16, 3)
    labels = np.tile(np.array([1, 2, 3, 1], dtype=np.int64), 4)
    np.savetxt(sources / f"{name}.pts", points)
    np.savetxt(targets / f"{name}.seg", labels, fmt="%d")


def test_dataloader_supports_zero_workers(tmp_path: Path):
    for index in range(4):
        _write_sample(tmp_path, f"sample_{index}")
    dataset = MyDataset(
        data_dir=str(tmp_path),
        train_val_split=(0.75, 0.25),
        batch_size=1,
        num_workers=0,
        sample_size=8,
        augmentation=False,
    )
    points, labels = next(iter(dataset.train_dataloader()))
    assert points.shape == (1, 3, 8)
    assert labels.shape == (1, 8)
    assert points.dtype == torch.float32
    assert labels.dtype == torch.int64


def test_pointnet_supports_batch_size_one():
    model = MyNet(encoder_channel=3, hidden_size=64, output_class=3)
    output = model(torch.randn(1, 3, 16))
    assert output.shape == (1, 16, 3)
    assert torch.isfinite(output).all()


def test_pipeline_trains_validates_and_saves_checkpoint(tmp_path: Path):
    for index in range(4):
        _write_sample(tmp_path / "data", f"sample_{index}")
    train_data = MyDataset(
        data_dir=str(tmp_path / "data"),
        train_val_split=(0.75, 0.25),
        batch_size=2,
        num_workers=0,
        sample_size=16,
        augmentation=False,
    )
    val_data = MyDataset(
        data_dir=str(tmp_path / "data"),
        train_val_split=(0.75, 0.25),
        batch_size=2,
        num_workers=0,
        sample_size=16,
        augmentation=False,
        mode="val",
    )
    logger = TensorBoardLogger(root_dir=str(tmp_path / "logs"), name="test")
    pipeline = MyPipeline(
        net=MyNet(encoder_channel=3, hidden_size=64, output_class=3),
        loss=torch.nn.NLLLoss(),
        optimizer=partial(torch.optim.Adam, lr=1e-3),
        TensorBoardLog=logger,
        net_input_size=[2, 3, 16],
        num_classes=3,
        accelerator="cpu",
        devices=1,
        log_pointclouds=False,
    )
    train_acc, train_loss = pipeline.training(train_data.train_dataloader())
    val_acc, val_loss = pipeline.validation(val_data.val_dataloader())
    checkpoint = tmp_path / "checkpoint.pt"
    pipeline.save_model(checkpoint, val_loss, epoch=0, global_step=1)
    loaded = pipeline.load_model(checkpoint)
    assert 0 <= train_acc <= 1
    assert 0 <= val_acc <= 1
    assert train_loss >= 0
    assert val_loss >= 0
    assert loaded["epoch"] == 0
