# -*- coding: UTF-8 -*-
'''
=================================================
@path   ：FlaskDeploy -> __init__.py.py
@IDE    ：PyCharm
@Author ：sindre
@Email  ：yx@mviai.com
@Date   ：2022/12/5 14:31
@Version: V0.1
@License: (C)Copyright 2021-2022 , UP3D
@Reference: 
@History:
- 2022/12/5 :
==================================================
'''
__author__ = 'sindre'
import time
from copy import deepcopy

import hydra
import numpy as np
import pymeshlab
import torch
import trimesh
import vedo
from matplotlib import pyplot as plt
from omegaconf import DictConfig, OmegaConf
from pygco import cut_from_graph
from sklearn.neighbors import KNeighborsClassifier

from .net import ShapeNet32Vox, hrnet, meshsegnet
from .tools import CaptureToothImage, decode_preds, fix_axis, fix_mesh
from .voxels import *




# from .posts import posts_bp
# # 注册模块
# def init_app(app):
#     app.register_blueprint(user_bp)
#     app.register_blueprint(posts_bp)
