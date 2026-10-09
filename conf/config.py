"""Default application and model configuration."""

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RESOURCE_DIR = PROJECT_ROOT / "resources"


class app_config:
    """Safe defaults for local development and deployment."""

    DEBUG = False
    TESTING = False
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")


class split_config:
    """Configuration for the optional tooth-segmentation model."""

    name = "split"
    cache_dir = RESOURCE_DIR / "cache"
    obj_name = "mesh.obj"
    mtl_name = "mesh.obj.mtl"
    ply_name = "mesh.ply"

    # Checkpoints are user-supplied and are intentionally not committed.
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
