"""应用级日志配置。"""

from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path


def configure_logging(app) -> None:
    """配置全局滚动文件日志。

    Args:
        app: 已完成基础配置的 Flask 应用实例。

    说明:
        同一进程重复创建应用时会复用并更新模板自己的 handler，避免重复写日志。
    """
    log_dir = Path(app.config["LOG_DIR"])
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "app.log"
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        "%Y-%m-%d %H:%M:%S",
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(app.config["LOG_LEVEL"])
    marker = "_sindre_template_file_handler"
    existing = next(
        (handler for handler in root_logger.handlers if getattr(handler, marker, False)),
        None,
    )
    if existing is None or Path(getattr(existing, "baseFilename", "")) != log_file.resolve():
        if existing is not None:
            root_logger.removeHandler(existing)
            existing.close()
        file_handler = RotatingFileHandler(
            log_file, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
        )
        setattr(file_handler, marker, True)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

    # Flask 默认会附加一个控制台 handler；移除它，避免同一条记录重复输出。
    for handler in list(app.logger.handlers):
        app.logger.removeHandler(handler)
    app.logger.setLevel(app.config["LOG_LEVEL"])
    app.logger.propagate = True
