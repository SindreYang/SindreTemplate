"""Environment-driven defaults for the Flask service."""

from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RESOURCE_DIR = PROJECT_ROOT / "resources"


def _int_env(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be an integer") from exc
    if parsed < 0:
        raise ValueError(f"Environment variable {name} cannot be negative")
    return parsed


def cors_origins() -> list[str]:
    """Return a validated comma-separated CORS allow-list."""
    value = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    origins = [origin.strip() for origin in value.split(",") if origin.strip()]
    return origins or ["http://localhost:3000"]


class app_config:
    """Safe defaults for local development and deployment."""

    DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"
    TESTING = False
    MAX_CONTENT_LENGTH = _int_env("MAX_CONTENT_LENGTH", 100 * 1024 * 1024)
    CORS_ORIGINS = cors_origins()
    SPLIT_CACHE_TTL_SECONDS = _int_env("SPLIT_CACHE_TTL_SECONDS", 24 * 60 * 60)
    HOST = os.environ.get("FLASK_HOST", "127.0.0.1")
    PORT = _int_env("FLASK_PORT", 5000)


class split_config:
    """Configuration for the optional tooth-segmentation model."""

    name = "split"
    cache_dir = RESOURCE_DIR / "cache"
    obj_name = "mesh.obj"
    mtl_name = "mesh.obj.mtl"
    ply_name = "mesh.ply"

    # Checkpoints are user-supplied and intentionally not committed.
    merger_args = {
        "对称分牙上颌": (RESOURCE_DIR / "upper_9.pt", 9),
        "对称分牙下颌": (RESOURCE_DIR / "lower_9.pt", 9),
        "齿龈分类": (RESOURCE_DIR / "齿龈分类.pt", 2),
        "牙齿分区": (RESOURCE_DIR / "牙齿分区.pt", 3),
        "磨尖牙分类": (RESOURCE_DIR / "磨尖牙分类.pt", 3),
        "磨牙分类": (RESOURCE_DIR / "磨牙分类.pt", 3),
        "切牙分类": (RESOURCE_DIR / "切牙分类.pt", 4),
        "上颌": (RESOURCE_DIR / "upper_17.pt", 17),
        "下颌": (RESOURCE_DIR / "lower_17.pt", 17),
    }
