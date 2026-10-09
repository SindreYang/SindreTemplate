"""Hydra entry point for reproducible point-cloud training."""

from __future__ import annotations

from pathlib import Path

import hydra
from lightning.fabric import seed_everything
from lightning.fabric.loggers import TensorBoardLogger
from omegaconf import DictConfig, OmegaConf
from tqdm import trange

from src.pipeline.my_pipeline import MyPipeline
from src.utils import get_logger, seed_torch

log = get_logger(__name__)


def _absolute_path(original_cwd: str, value: str) -> Path:
    path = Path(value).expanduser()
    return path if path.is_absolute() else Path(original_cwd) / path


@hydra.main(version_base=None, config_path="configs", config_name="experiment.yaml")
def main(config_global: DictConfig) -> None:
    """Create data, model, logger, and a resumable training loop."""
    original_cwd = hydra.utils.get_original_cwd()
    config = config_global.my_envs
    config.datamodule.data_dir = str(_absolute_path(original_cwd, config.datamodule.data_dir))
    seed = int(config.train.seed)
    seed_torch(seed)
    seed_everything(seed, workers=True)
    log.info("Experiment: %s/%s", config_global.name, config_global.version)

    train_dataset = hydra.utils.instantiate(config.datamodule, mode="train")
    val_dataset = hydra.utils.instantiate(config.datamodule, mode="val")
    train_loader = train_dataset.train_dataloader()
    val_loader = val_dataset.val_dataloader()

    log_dir = _absolute_path(original_cwd, f"logs/runs/{config_global.name}/{config_global.version}")
    tb_logger = TensorBoardLogger(root_dir=str(log_dir), name="tensorboard", flush_secs=10)
    log.info("TensorBoard log directory: %s", tb_logger.log_dir)

    train: MyPipeline = hydra.utils.instantiate(config.pipeline, TensorBoardLog=tb_logger)
    resume_path = _absolute_path(original_cwd, config.train.resume_from_checkpoint)
    checkpoint = train.load_model(resume_path)
    start_epoch = int(checkpoint.get("epoch", -1)) + 1
    best_train_loss = float(checkpoint.get("best_train_loss", float("inf")))
    best_val_loss = float(checkpoint.get("best_val_loss", float("inf")))
    global_step = int(checkpoint.get("global_step", 0))

    if config_global.openPerformanceTest:
        performance_dataset = hydra.utils.instantiate(config.datamodule, mode="test_performance")
        train.analytical_performance(performance_dataset.train_dataloader())

    epochs = int(config.train.epochs)
    last_path = _absolute_path(original_cwd, config.train.resume_from_checkpoint)
    best_train_path = _absolute_path(original_cwd, config.train.best_train_ckpt_path)
    best_val_path = _absolute_path(original_cwd, config.train.ckpt_path)
    config_dict = OmegaConf.to_container(config_global, resolve=True)

    for epoch in trange(start_epoch, epochs, desc="训练进度", colour="red"):
        train_acc, train_loss = train.training(train_loader)
        val_acc, val_loss = train.validation(val_loader, epoch=epoch)
        global_step += len(train_loader)

        log.info(
            "Epoch %d/%d: train_loss=%.6f train_acc=%.4f val_loss=%.6f val_acc=%.4f",
            epoch + 1,
            epochs,
            train_loss,
            train_acc,
            val_loss,
            val_acc,
        )
        tb_logger.log_metrics(
            {
                "train_loss": train_loss,
                "train_acc": train_acc,
                "val_loss": val_loss,
                "val_acc": val_acc,
            },
            step=global_step,
        )

        # last.ckpt is always current; best checkpoints are independent files.
        train.save_model(
            last_path,
            val_loss,
            epoch=epoch,
            global_step=global_step,
            best_train_loss=min(best_train_loss, train_loss),
            best_val_loss=min(best_val_loss, val_loss),
            config=config_dict,
        )
        if train_loss < best_train_loss:
            best_train_loss = train_loss
            train.save_model(
                best_train_path,
                train_loss,
                epoch=epoch,
                global_step=global_step,
                best_train_loss=best_train_loss,
                best_val_loss=best_val_loss,
                config=config_dict,
            )
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            train.save_model(
                best_val_path,
                val_loss,
                epoch=epoch,
                global_step=global_step,
                best_train_loss=best_train_loss,
                best_val_loss=best_val_loss,
                config=config_dict,
            )

    tb_logger.finalize("success")


if __name__ == "__main__":
    main()
