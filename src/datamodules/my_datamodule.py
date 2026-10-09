"""Point-cloud dataset and DataLoader construction."""

from __future__ import annotations

from pathlib import Path
from typing import Sequence

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset, Subset, random_split


class MyDataset(Dataset):
    """Load point clouds from ``sources/*.pts`` and labels from ``targets/*.seg``."""

    def __init__(
        self,
        data_dir: str = "datasets/torch_datasets",
        train_val_split: Sequence[float] = (0.9, 0.1),
        batch_size: int = 2,
        num_workers: int = 0,
        pin_memory: bool = False,
        seed: int = 1024,
        mode: str = "train",
        augmentation: bool = True,
        prefetch_factor: int = 2,
        sample_size: int = 1024,
    ) -> None:
        if mode not in {"train", "val", "test_performance"}:
            raise ValueError(f"Unsupported dataset mode: {mode!r}")
        if batch_size < 1 or num_workers < 0 or sample_size < 1:
            raise ValueError("batch_size, sample_size must be positive and num_workers cannot be negative")
        if len(train_val_split) != 2 or any(float(value) <= 0 for value in train_val_split):
            raise ValueError("train_val_split must contain two positive values")

        self.data_dir = Path(data_dir)
        self.mode = mode
        self.batch_size = batch_size
        self.num_workers = num_workers
        self.pin_memory = pin_memory
        self.seed = seed
        self.data_augmentation = augmentation and mode == "train"
        self.prefetch_factor = prefetch_factor
        self.sample_size = sample_size

        paths = self._find_source_paths(self.data_dir)
        if not paths:
            raise FileNotFoundError(
                f"No .pts files were found under {self.data_dir.resolve()}. "
                "Place point clouds in a sources directory before training."
            )
        if len(paths) < 2:
            raise ValueError("At least two point-cloud files are required for train/validation splits")

        split_generator = torch.Generator().manual_seed(seed)
        train_size, val_size = self._split_lengths(len(paths), train_val_split)
        train_subset, val_subset = random_split(
            paths,
            [train_size, val_size],
            generator=split_generator,
        )
        if mode == "train":
            self.datasets = train_subset
        elif mode == "val":
            self.datasets = val_subset
        else:
            count = min(len(train_subset), max(1, batch_size * 10))
            self.datasets = Subset(train_subset, range(count))

        if len(self.datasets) == 0:
            raise ValueError(f"The {mode} split is empty; add more data or change train_val_split")

    @staticmethod
    def _find_source_paths(data_dir: Path) -> list[Path]:
        if not data_dir.exists():
            raise FileNotFoundError(f"Dataset directory does not exist: {data_dir.resolve()}")
        return sorted(
            path
            for path in data_dir.rglob("*.pts")
            if "sources" in {part.lower() for part in path.parts}
        )

    @staticmethod
    def _split_lengths(size: int, ratios: Sequence[float]) -> tuple[int, int]:
        train_ratio, val_ratio = (float(value) for value in ratios)
        total = train_ratio + val_ratio
        train_size = int(round(size * train_ratio / total))
        train_size = min(max(train_size, 1), size - 1) if size > 1 else size
        return train_size, size - train_size

    @staticmethod
    def _target_path(source_path: Path) -> Path:
        parts = list(source_path.parts)
        source_index = next(
            (index for index, part in enumerate(parts) if part.lower() == "sources"),
            None,
        )
        if source_index is None:
            raise ValueError(f"Source path is not inside a sources directory: {source_path}")
        parts[source_index] = "targets"
        return Path(*parts).with_suffix(".seg")

    def __len__(self) -> int:
        return len(self.datasets)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        source_path = Path(self.datasets[idx])
        target_path = self._target_path(source_path)
        if not target_path.exists():
            raise FileNotFoundError(f"Missing label file for {source_path}: {target_path}")

        point_set = np.loadtxt(source_path, dtype=np.float32, ndmin=2)
        labels = np.loadtxt(target_path, dtype=np.int64, ndmin=1)
        if point_set.ndim != 2 or point_set.shape[1] < 3:
            raise ValueError(f"Expected at least 3 point features in {source_path}")
        if len(point_set) != len(labels):
            raise ValueError(
                f"Point/label count mismatch for {source_path}: "
                f"{len(point_set)} points vs {len(labels)} labels"
            )

        if self.mode == "train":
            replace = len(point_set) < self.sample_size
            choice = np.random.choice(len(point_set), self.sample_size, replace=replace)
        else:
            # Validation and profiling must be repeatable across epochs.
            choice = np.arange(self.sample_size) % len(point_set)
        point_set = point_set[choice]
        labels = labels[choice]

        point_set = point_set - np.mean(point_set, axis=0, keepdims=True)
        scale = float(np.max(np.linalg.norm(point_set, axis=1)))
        if not np.isfinite(scale) or scale <= np.finfo(np.float32).eps:
            raise ValueError(f"Point cloud has zero or invalid scale: {source_path}")
        point_set = point_set / scale

        if self.data_augmentation:
            theta = np.random.uniform(0.0, np.pi * 2.0)
            rotation = np.array(
                [[np.cos(theta), -np.sin(theta)], [np.sin(theta), np.cos(theta)]],
                dtype=np.float32,
            )
            point_set[:, [0, 2]] = point_set[:, [0, 2]] @ rotation
            point_set += np.random.normal(0.0, 0.02, size=point_set.shape).astype(np.float32)

        labels = labels - 1
        if np.any(labels < 0):
            raise ValueError(f"Labels must be 1-based positive integers: {target_path}")

        points = torch.from_numpy(np.ascontiguousarray(point_set, dtype=np.float32)).transpose(1, 0)
        targets = torch.from_numpy(np.ascontiguousarray(labels, dtype=np.int64))
        return points, targets

    def _init_fn(self, worker_id: int) -> None:
        seed = self.seed + worker_id + int(torch.initial_seed() % (2**32))
        np.random.seed(seed % (2**32))

    def _loader_kwargs(self, shuffle: bool) -> dict:
        kwargs = {
            "dataset": self,
            "batch_size": self.batch_size,
            "num_workers": self.num_workers,
            "pin_memory": self.pin_memory,
            "shuffle": shuffle,
            "worker_init_fn": self._init_fn,
        }
        if self.num_workers > 0:
            kwargs["prefetch_factor"] = self.prefetch_factor
            kwargs["persistent_workers"] = True
        return kwargs

    def train_dataloader(self) -> DataLoader:
        return DataLoader(**self._loader_kwargs(shuffle=True))

    def val_dataloader(self) -> DataLoader:
        return DataLoader(**self._loader_kwargs(shuffle=False))
