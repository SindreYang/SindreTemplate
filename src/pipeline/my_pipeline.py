"""Fabric-based training, validation, logging, and checkpoint management."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import torch
from lightning.fabric import Fabric
from lightning.fabric.loggers import TensorBoardLogger
from torch import nn
from torchmetrics import Accuracy
from tqdm import tqdm

from src.utils import get_logger

log = get_logger(__name__)


class MyPipeline:
    """Run a point-cloud segmentation model with safe metrics and checkpoints."""

    def __init__(
        self,
        net: torch.nn.Module,
        loss: torch.nn.Module,
        optimizer: torch.optim.Optimizer,
        TensorBoardLog: TensorBoardLogger,
        net_input_size: list[int],
        num_classes: int,
        accelerator: str = "auto",
        strategy: str = "auto",
        devices: int | list[int] = 1,
        precision: str = "32",
        log_graph: bool = False,
        log_pointclouds: bool = True,
        max_visualization_batches: int = 1,
    ) -> None:
        if num_classes < 2:
            raise ValueError("num_classes must be at least 2")
        if len(net_input_size) != 3:
            raise ValueError("net_input_size must be [batch, channels, points]")

        self.fabric = Fabric(
            accelerator=accelerator,
            strategy=strategy,
            devices=devices,
            precision=precision,
        )
        self.fabric.launch()

        self.num_classes = num_classes
        self.net = net
        self.loss = loss
        self.optim = optimizer(params=self.net.parameters())
        self.net, self.optim = self.fabric.setup(self.net, self.optim)

        metric_device = self.fabric.device
        self.train_acc = Accuracy(task="multiclass", num_classes=num_classes, top_k=1).to(metric_device)
        self.val_acc = Accuracy(task="multiclass", num_classes=num_classes, top_k=1).to(metric_device)
        self.tb_log = TensorBoardLog
        self.tb_native_log = TensorBoardLog.experiment
        self.log_pointclouds = log_pointclouds
        self.max_visualization_batches = max(0, max_visualization_batches)
        self._prepared_loaders: dict[str, Any] = {}

        if log_graph:
            self._log_graph(net_input_size)

    def _log_graph(self, net_input_size: list[int]) -> None:
        """Write a graph without changing the model's training state."""
        if not hasattr(self.tb_log, "log_graph"):
            return
        was_training = self.net.training
        try:
            self.net.eval()
            sample = torch.randn(net_input_size, device=self.fabric.device)
            with torch.no_grad():
                self.tb_log.log_graph(self.net, sample)
        except Exception as exc:  # Graph logging must never stop training.
            log.warning("TensorBoard graph logging skipped: %s", exc)
        finally:
            self.net.train(was_training)

    def _prepare_loader(self, loader: Any, name: str) -> Any:
        if name not in self._prepared_loaders:
            self._prepared_loaders[name] = self.fabric.setup_dataloaders(loader)
        return self._prepared_loaders[name]

    def step(self, batch: tuple[torch.Tensor, torch.Tensor]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        x, y = batch
        pred = self.net(x)
        targets = y.reshape(-1).long()
        pred = pred.reshape(-1, self.num_classes)
        loss = self.loss(pred, targets)
        return loss, pred, targets

    def training(self, dataset_loader: Any) -> tuple[float, float]:
        loader = self._prepare_loader(dataset_loader, "train")
        if len(loader) == 0:
            raise ValueError("Training DataLoader is empty")
        self.net.train()
        total_loss = 0.0
        self.train_acc.reset()
        for batch in tqdm(loader, desc="训练", colour="blue", leave=False):
            self.optim.zero_grad(set_to_none=True)
            loss, pred, targets = self.step(batch)
            self.fabric.backward(loss)
            self.optim.step()
            self.train_acc.update(pred, targets)
            total_loss += float(loss.detach().item())
        return float(self.train_acc.compute().item()), total_loss / len(loader)

    def validation(self, dataset_loader: Any, epoch: int = 0) -> tuple[float, float]:
        loader = self._prepare_loader(dataset_loader, "val")
        if len(loader) == 0:
            raise ValueError("Validation DataLoader is empty")
        self.net.eval()
        total_loss = 0.0
        self.val_acc.reset()
        with torch.no_grad():
            for step, batch in enumerate(tqdm(loader, desc="验证", colour="green", leave=False)):
                loss, pred, targets = self.step(batch)
                self.val_acc.update(pred, targets)
                total_loss += float(loss.item())
                if self.log_pointclouds and step < self.max_visualization_batches:
                    self.log_pointcloud(
                        "targets_pointcloud",
                        batch[0].transpose(1, 2),
                        batch[1],
                        step=epoch,
                    )
                    self.log_pointcloud(
                        "pred_pointcloud",
                        batch[0].transpose(1, 2),
                        pred.argmax(dim=1).reshape(batch[0].shape[0], -1),
                        step=epoch,
                    )
        return float(self.val_acc.compute().item()), total_loss / len(loader)

    def log_pointcloud(
        self,
        name: str,
        verts: torch.Tensor,
        labels: torch.Tensor,
        faces: torch.Tensor | None = None,
        step: int | None = None,
    ) -> None:
        """Log colored point clouds; pass ``faces`` when actual meshes are available."""
        color_map = torch.tensor(
            [
                [230, 25, 75], [60, 180, 75], [255, 225, 25], [67, 99, 216],
                [245, 130, 49], [66, 212, 244], [240, 50, 230], [250, 190, 212],
                [70, 153, 144], [220, 190, 255], [154, 99, 36], [255, 250, 200],
                [128, 0, 0], [170, 255, 195], [0, 0, 117], [169, 169, 169],
                [255, 255, 255], [0, 0, 0],
            ],
            dtype=torch.uint8,
        )
        labels = labels.reshape(verts.shape[0], -1).long().detach().cpu()
        if torch.any(labels < 0) or torch.any(labels >= len(color_map)):
            raise ValueError("Point-cloud labels exceed the configured visualization color map")
        colors = color_map[labels]
        self.tb_native_log.add_mesh(
            tag=name,
            vertices=verts.detach().float().cpu(),
            faces=faces.detach().long().cpu() if faces is not None else None,
            colors=colors,
            global_step=step,
        )

    def save_model(
        self,
        save_path: str | os.PathLike[str],
        new_loss: float,
        *,
        epoch: int = 0,
        global_step: int = 0,
        best_train_loss: float | None = None,
        best_val_loss: float | None = None,
        config: dict[str, Any] | None = None,
    ) -> None:
        """Save a resumable checkpoint containing model and optimizer state."""
        path = Path(save_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        checkpoint = {
            "format_version": 2,
            "epoch": epoch,
            "global_step": global_step,
            "model": self.net.state_dict(),
            "optimizer": self.optim.state_dict(),
            "loss": float(new_loss),
            "best_train_loss": best_train_loss,
            "best_val_loss": best_val_loss,
            "config": config,
        }
        self.fabric.save(path, checkpoint)
        self.fabric.barrier()
        log.info("Saved checkpoint: %s (loss=%.6f)", path, new_loss)

    def load_model(self, load_path: str | os.PathLike[str], strict: bool = True) -> dict[str, Any]:
        """Load a checkpoint and return its training metadata."""
        path = Path(load_path)
        if not path.exists():
            log.info("No checkpoint found at %s; starting from scratch", path)
            return {"epoch": -1, "global_step": 0}

        checkpoint = self.fabric.load(path, strict=strict)
        model_state = checkpoint.get("model", checkpoint.get("net"))
        if model_state is None:
            raise KeyError(f"Checkpoint has no model state: {path}")
        self.net.load_state_dict(model_state, strict=strict)
        if checkpoint.get("optimizer") is not None:
            self.optim.load_state_dict(checkpoint["optimizer"])
        log.info("Loaded checkpoint: %s (epoch=%s)", path, checkpoint.get("epoch", "unknown"))
        return checkpoint

    def init_weights(self) -> None:
        """Initialize convolution and normalization layers when explicitly requested."""
        for module in self.net.modules():
            if isinstance(module, (nn.Conv1d, nn.Conv2d)):
                nn.init.kaiming_normal_(module.weight, mode="fan_out", nonlinearity="relu")
                if module.bias is not None:
                    nn.init.zeros_(module.bias)
            elif isinstance(module, (nn.BatchNorm1d, nn.BatchNorm2d)):
                nn.init.ones_(module.weight)
                nn.init.zeros_(module.bias)

    def analytical_performance(self, dataset_loader: Any) -> None:
        """Profile a short training pass for performance diagnostics."""
        loader = self._prepare_loader(dataset_loader, "performance")
        self.net.train()
        with torch.profiler.profile(
            schedule=torch.profiler.schedule(wait=1, warmup=1, active=3, repeat=1),
            on_trace_ready=torch.profiler.tensorboard_trace_handler(self.tb_log.log_dir),
            record_shapes=True,
            with_stack=True,
        ) as profiler:
            for batch in tqdm(loader, desc="性能测试", colour="yellow", leave=False):
                self.optim.zero_grad(set_to_none=True)
                loss, _, _ = self.step(batch)
                self.fabric.backward(loss)
                self.optim.step()
                profiler.step()
        log.info("Profiler:\n%s", profiler.key_averages().table(sort_by="self_cpu_time_total", row_limit=10))
