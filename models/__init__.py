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
import numpy as np
import torch
import trimesh
from copy import deepcopy
import vedo
from pygco import cut_from_graph
from sklearn.neighbors import KNeighborsClassifier
import pymeshlab
from matplotlib import pyplot as plt
from omegaconf import DictConfig, OmegaConf
import hydra
import time
from .net import meshsegnet,ShapeNet32Vox,hrnet
from .voxels import *
from .tools import fix_mesh, fix_axis, CaptureToothImage, decode_preds




# from .posts import posts_bp
# # 注册模块
# def init_app(app):
#     app.register_blueprint(user_bp)
#     app.register_blueprint(posts_bp)
