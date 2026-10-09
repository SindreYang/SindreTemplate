# -*- coding: UTF-8 -*-
'''
=================================================
@path   ：FlaskDeploy -> tools.py
@IDE    ：PyCharm
@Author ：sindre
@Email  ：yx@mviai.com
@Date   ：2022/12/5 14:57
@Version: V0.1
@License: (C)Copyright 2021-2022 , UP3D
@Reference: 
@History:
- 2022/12/5 :
==================================================
'''
__author__ = 'sindre'

import json

import numpy as np
import scipy
import trimesh
import vedo
import math
import scipy
import scipy.misc
import torch
from PIL import Image
import vtk
from vtk.util import numpy_support as np_support
import open3d as o3d

class ToothMeshInfo(object):
    """Get tooth mesh information from stl file.

    Args:
        mesh (trimesh.Trimesh): get mesh from Trimesh API

    Attributes:
        _faces (list): the list of mesh faces using Trimesh API
        _points (np.array): the list of mesh points using Trimesh API
    """

    def __init__(self, mesh):
        self._mesh = mesh
        self._faces = np.asarray(self._mesh.faces).tolist()
        self._points = np.asarray(self._mesh.vertices)
        self._barycenters = np.asarray(self._mesh.triangles_center)

class CaptureToothImage(ToothMeshInfo):
    """Capture tooth image from mesh data

    Args:
        mesh (Trimesh): get mesh from Trimesh API.

    Attributes:
        _resolution (tuple, h x w): 2d图像大小. Default: (512, 512)
        _view (tuple, x, y, z): 相机的视图向上方向. Default: (0.0, 1.0, 0.0).
        _zoom_factor (int): 视图按照指定的因子缩放. Default: 30.
        image_matrix (list): 捕获图像中的像素对应的顶点索引.
        world_matrix (np.array): 网格中点对应的顶点索引.
    """

    def __init__(self, mesh):
        super().__init__(mesh)
        self._resolution = (512, 512)
        self._view = (0.0, 1.0, 0.0)
        self._zoom_factor = 30
        self.image_matrix = []

    def __call__(self):
        self.catpure_screen_shot()
        self._setting_caputre()
        self._capture_tooth_image()
        self._get_world_to_image_matrix()
        return self.img, self.image_matrix, self.world_matrix

    def catpure_screen_shot(self):
        pcd_mesh = o3d.geometry.PointCloud(o3d.utility.Vector3dVector(np.array(self._barycenters)))
        _, ind = pcd_mesh.remove_statistical_outlier(nb_neighbors=50, std_ratio=2.0)
        self._faces = np.asarray(self._faces)[ind]

    def _create_polygon(self):
        numberPoints = len(self._points)
        Points = vtk.vtkPoints()
        points_vtk = np_support.numpy_to_vtk(self._points, deep=1, array_type=vtk.VTK_FLOAT)
        Points.SetNumberOfPoints(numberPoints)
        Points.SetData(points_vtk)

        Triangles = vtk.vtkCellArray()

        for item in self._faces:
            Triangle = vtk.vtkTriangle()
            Triangle.GetPointIds().SetId(0, item[0])
            Triangle.GetPointIds().SetId(1, item[1])
            Triangle.GetPointIds().SetId(2, item[2])
            Triangles.InsertNextCell(Triangle)

        self._polydata = vtk.vtkPolyData()
        self._polydata.SetPoints(Points)
        self._polydata.SetPolys(Triangles)

        self._min_val, self._max_val = self._polydata.GetPoints().GetData().GetRange()
        self.world_matrix = np.asarray(self._polydata.GetPoints().GetData())

    def _set_look_up_table(self):
        # transfer function (lookup table) for mapping point scalar data to colors (parent class is vtkScalarsToColors)
        self._lut = vtk.vtkColorTransferFunction()
        self._lut.AddRGBPoint(self._min_val, 0.0, 0.0, 1.0)
        self._lut.AddRGBPoint(self._min_val + (self._max_val - self._min_val) / 4, 0.0, 0.5, 0.5)
        self._lut.AddRGBPoint(self._min_val + (self._max_val - self._min_val) / 2, 0.0, 1.0, 0.0)
        self._lut.AddRGBPoint(self._min_val - (self._max_val - self._min_val) / 4, 0.5, 0.5, 0.0)
        self._lut.AddRGBPoint(self._min_val, 1.0, 0.0, 0.0)

    def _set_mapper(self):
        self._mapper = vtk.vtkPolyDataMapper()
        self._mapper.SetLookupTable(self._lut)
        self._mapper.SetScalarRange(self._min_val, self._max_val)
        self._mapper.SetInputData(self._polydata)

    def _set_actor(self):
        self._actor = vtk.vtkActor()
        self._actor.SetMapper(self._mapper)

    def _set_render_window(self, ren=None):
        if ren is None:
            self._ren = vtk.vtkRenderer()
        else:
            self._ren = ren

        self._renWin = vtk.vtkRenderWindow()
        self._renWin.SetOffScreenRendering(1)
        self._renWin.AddRenderer(self._ren)
        self._renWin.SetSize(self._resolution)
        self._ren.SetBackground(0, 0, 0)

    def _set_interact_rendering_with_camera(self):
        # create a renderwindowinteractor
        self._iren = vtk.vtkRenderWindowInteractor()
        self._iren.SetRenderWindow(self._renWin)
        self._ren.AddActor(self._actor)
        self._renWin.Render()

    def _set_camera(self):
        self._set_render_window()
        self._set_interact_rendering_with_camera()
        # Renderer (Zoom in)
        pos = self._ren.GetActiveCamera().GetPosition()
        foc = self._ren.GetActiveCamera().GetFocalPoint()

        # Re-Renderer (Zoom in)
        self._ren = vtk.vtkRenderer()
        self._camera = vtk.vtkCamera()
        self._camera.SetViewUp(self._view)
        self._camera.SetPosition(pos[0], pos[1], pos[2] - self._zoom_factor)
        self._camera.SetFocalPoint(foc[0], foc[1], foc[2])
        self._ren.SetActiveCamera(self._camera)

        self._set_render_window(self._ren)
        self._set_interact_rendering_with_camera()

    def _set_image_filter(self):
        self._renWin.Render()
        self._grabber = vtk.vtkWindowToImageFilter()
        self._grabber.SetInput(self._renWin)
        self._grabber.Update()

    def _setting_caputre(self):
        self._create_polygon()
        self._set_look_up_table()
        self._set_mapper()
        self._set_actor()
        self._set_camera()
        self._set_image_filter()

    def _capture_tooth_image(self):
        self.img = np.asarray(self._grabber.GetOutput().GetPointData().GetScalars())
        self.img = self.img.reshape(self._resolution + (3,))

    def _get_world_to_image_matrix(self) -> np.array:
        for p in self.world_matrix:
            displayPt = [0, 0, 0]
            vtk.vtkInteractorObserver.ComputeWorldToDisplay(self._ren, p[0], p[1], p[2], displayPt)
            self.image_matrix.append(displayPt)


# 补洞，网格错误
def fix_mesh(path):
    mesh = vedo.load(path).clean().fillHoles().computeNormals()
    mesh2 = mesh.clone().addCurvatureScalars(method=1)
    curvature_arr = mesh2.pointdata["Mean_Curvature"]
    # show
    # mesh.cmap('PRGn', "Mean_Curvature", vmin=-3, vmax=-1).addScalarBar().show(axes=1)

    # 返回修复后的模型和所有曲率值
    return mesh, curvature_arr


# 修复z轴
def fix_axis(mesh, Curvature_Arr):
    # 获取曲率线
    mesh_points = mesh.points()
    pts = []
    for i in range(len(Curvature_Arr)):
        if Curvature_Arr[i] < -2:
            pts.append(mesh_points[i])

    c, n = trimesh.points.plane_fit(pts)

    # 第二次拟合平面
    distence = trimesh.points.point_plane_distance(pts, n, plane_origin=c)
    new_pts = [pts[i] for i in range(len(distence)) if abs(distence[i]) < 5]
    c, n = trimesh.points.plane_fit(new_pts)

    # 矫正到z轴
    T = trimesh.geometry.plane_transform(c, n)

    # show
    # T = np.linalg.inv(trimesh.geometry.plane_transform(origin=c, normal=n))
    # plane = trimesh.path.creation.grid(side=50, transform=T)
    # p = trimesh.points.PointCloud(np.array(new_pts))
    # trimesh.Scene([plane, p]).show()

    # 修正后的点（list）
    return new_pts, T




def get_lmks_by_img(model, img, output_size=(256, 256), rot=0):
#     img = np.array(Image.open(image_path).convert('RGB'), dtype=np.float32)

    face_center = torch.Tensor([img.shape[1]//2, img.shape[0]/2])
    crop_scale = max((img.shape[1]) / output_size[0], (img.shape[0]) / output_size[1])

    img_crop = crop(img, face_center, crop_scale, output_size=output_size, rot=rot)
    img_crop = (img_crop/255.0 - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])
    img_crop = img_crop.transpose([2, 0, 1])
    img_crop = torch.tensor(img_crop, dtype=torch.float32).unsqueeze(0).cuda()
    with torch.no_grad():
        pred = model(img_crop)
    return decode_preds(pred, [face_center], [crop_scale], [output_size[0]/4,output_size[1]/4]).cpu().numpy().squeeze(0)


def get_preds(scores):
    """
    从torch张量中的得分图获取预测
    return type: torch.LongTensor
    """
    assert scores.dim() == 4, '分数地图应该是4-dim'
    maxval, idx = torch.max(scores.view(scores.size(0), scores.size(1), -1), 2) #直接获取最大值

    maxval = maxval.view(scores.size(0), scores.size(1), 1)
    idx = idx.view(scores.size(0), scores.size(1), 1) + 1

    preds = idx.repeat(1, 1, 2).float()

    preds[:, :, 0] = (preds[:, :, 0] - 1) % scores.size(3) + 1
    preds[:, :, 1] = torch.floor((preds[:, :, 1] - 1) / scores.size(3)) + 1

    pred_mask = maxval.gt(0).repeat(1, 1, 2).float()
    preds *= pred_mask
    return preds


def decode_preds(output, center, scale, res):
    coords = get_preds(output)  # float type

    coords = coords.cpu()
    # pose-processing
    for n in range(coords.size(0)):
        for p in range(coords.size(1)):
            hm = output[n][p]
            px = int(math.floor(coords[n][p][0]))
            py = int(math.floor(coords[n][p][1]))
            if (px > 1) and (px < res[0]) and (py > 1) and (py < res[1]):
                diff = torch.Tensor([hm[py - 1][px] - hm[py - 1][px - 2], hm[py][px - 1]-hm[py - 2][px - 1]])
                coords[n][p] += diff.sign() * .25
    coords += 0.5
    preds = coords.clone()

    # 变回
    for i in range(coords.size(0)):
        preds[i] = transform_preds(coords[i], center[i], scale[i], res)

    if preds.dim() < 3:
        preds = preds.view(1, preds.size())

    return preds


def crop(img, center, scale, output_size=(256,256), rot=0):
    # center : [center_w, center_h]
    center_new = center.clone()

    # Preprocessing for efficient cropping
    ht, wd = img.shape[0], img.shape[1]
    sf = scale * 200.0 / output_size[0]
    if sf < 2:
        sf = 1
    else:
        new_size = int(np.math.floor(max(ht, wd) / sf))
        new_ht = int(np.math.floor(ht / sf))
        new_wd = int(np.math.floor(wd / sf))
        if new_size < 2:
            return torch.zeros(output_size[0], output_size[1], img.shape[2]) \
                        if len(img.shape) > 2 else torch.zeros(output_size[0], output_size[1])
        else:
            img = np.array(Image.fromarray(img.astype(np.uint8)).resize((new_wd, new_ht)))
#             img = scipy.misc.imresize(img, [new_ht, new_wd])  # (0-1)-->(0-255)
            center_new[0] = center_new[0] * 1.0 / sf
            center_new[1] = center_new[1] * 1.0 / sf
            scale = scale / sf

    # Upper left point
    ul = np.array(transform_pixel([0, 0], center_new, scale, output_size, invert=1))
    # Bottom right point
    br = np.array(transform_pixel(output_size, center_new, scale, output_size, invert=1))

    # Padding so that when rotated proper amount of context is included
    pad = int(np.linalg.norm(br - ul) / 2 - float(br[1] - ul[1]) / 2)
    if not rot == 0:
        ul -= pad
        br += pad

    new_shape = [br[1] - ul[1], br[0] - ul[0]]
    if len(img.shape) > 2:
        new_shape += [img.shape[2]]

    new_img = np.zeros(new_shape, dtype=np.float32)

    # Range to fill new array
    new_x = max(0, -ul[0]), min(br[0], len(img[0])) - ul[0]
    new_y = max(0, -ul[1]), min(br[1], len(img)) - ul[1]
    # Range to sample from original image
    old_x = max(0, ul[0]), min(len(img[0]), br[0])
    old_y = max(0, ul[1]), min(len(img), br[1])
    new_img[new_y[0]:new_y[1], new_x[0]:new_x[1]] = img[old_y[0]:old_y[1], old_x[0]:old_x[1]]

    if not rot == 0:
        # Remove padding
        new_img = scipy.misc.imrotate(new_img, rot)
        new_img = new_img[pad:-pad, pad:-pad]
    new_img = np.array(Image.fromarray(new_img.astype(np.uint8)).resize(output_size[::-1]))
#     new_img = scipy.misc.imresize(new_img, output_size)
    return new_img


def transform_pixel(pt, center, scale, output_size, invert=0, rot=0):
    # Transform pixel location to different reference
    t = get_transform(center, scale, output_size, rot=rot)
    if invert:
        t = np.linalg.inv(t)
    new_pt = np.array([pt[0] - 1, pt[1] - 1, 1.]).T
    new_pt = np.dot(t, new_pt)
    return new_pt[:2].astype(int) + 1


def get_transform(center, scale, output_size, rot=0):
    """
    General image processing functions
    """
    # Generate transformation matrix
    h = 200 * scale
    t = np.zeros((3, 3))
    t[0, 0] = float(output_size[1]) / h
    t[1, 1] = float(output_size[0]) / h
    t[0, 2] = output_size[1] * (-float(center[0]) / h + .5)
    t[1, 2] = output_size[0] * (-float(center[1]) / h + .5)
    t[2, 2] = 1
    if not rot == 0:
        rot = -rot  # To match direction of rotation from cropping
        rot_mat = np.zeros((3, 3))
        rot_rad = rot * np.pi / 180
        sn, cs = np.sin(rot_rad), np.cos(rot_rad)
        rot_mat[0, :2] = [cs, -sn]
        rot_mat[1, :2] = [sn, cs]
        rot_mat[2, 2] = 1
        # Need to rotate around center
        t_mat = np.eye(3)
        t_mat[0, 2] = -output_size[1]/2
        t_mat[1, 2] = -output_size[0]/2
        t_inv = t_mat.copy()
        t_inv[:2, 2] *= -1
        t = np.dot(t_inv, np.dot(rot_mat, np.dot(t_mat, t)))
    return t


def transform_preds(coords, center, scale, output_size):

    for p in range(coords.size(0)):
        coords[p, 0:2] = torch.tensor(transform_pixel(coords[p, 0:2], center, scale, output_size, 1, 0))
    return coords

class NpEncoder(json.JSONEncoder):

    def default(self, obj):
        """
        自定义json编码器

        :param obj:编译对象
        :return:目标格式的对象
        """
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        else:
            return super(NpEncoder, self).default(obj)

def _remove_overlapping_triangles(m: trimesh.Trimesh) -> trimesh.Trimesh:
    """
    删除重叠的三角面片

    :param m : (trimesh.Trimesh)需要处理的网格模型
    :return cleaned_mesh :(trimesh.Trimesh)清除重叠面片后的网格模型
    """
    cleaned_mesh = trimesh.Trimesh()
    used_faces = []
    face_indices = np.arange(0, m.faces.shape[0])
    # 对于所有面，使用 Delaunay 三角剖分重建表面
    # m.facets 共面相邻面的索引列表
    for facet_faces in m.facets:
        if len(facet_faces):
            used_faces.extend(facet_faces)
            # 相邻面的点的集合
            selected_faces = m.faces[facet_faces].flatten()
            facet_vertices = m.vertices[selected_faces]
            # 返回4*4的变换矩阵，使平面变换为与XOY共面
            to_2d = trimesh.geometry.plane_transform(facet_vertices[0], m.face_normals[facet_faces[0]])
            # 实现变换,3维→2维
            vertices_2d = trimesh.transformations.transform_points(
                facet_vertices,
                matrix=to_2d)[:, :2]
            tri = scipy.spatial.qhull.Delaunay(vertices_2d)

            # tri.simplices 根据tri的点划分的三角形
            split = trimesh.Trimesh(vertices=facet_vertices, faces=tri.simplices)
            cleaned_mesh += split
    # 创建不属于共面的面的蒙版,用来判断是否已添加到cleaned_mesh中
    mask = np.ones(face_indices.size, dtype=bool)
    mask[np.unique(used_faces)] = False

    # 重新添加那些剩余的面孔
    cleaned_mesh += m.submesh([face_indices[mask]], only_watertight=False)
    cleaned_mesh.visual = m.visual
    print("结果面片数：", len(cleaned_mesh.faces), "原始面片数：", len(m.faces))
    return cleaned_mesh


def fix_mesh(path):
    """
    对网格进行补洞，网格错误
    :return mesh:(vedo.mesh)带有曲率，curvature_arr(np.array)网格对应平均曲率
    """
    mesh = vedo.load(path).clean().fillHoles().computeNormals()
    mesh2 =mesh.clone().addCurvatureScalars(method=1)
    curvature_arr = mesh2.pointdata["Mean_Curvature"]
    # show
    # mesh.cmap('PRGn', "Mean_Curvature", vmin=-3, vmax=-1).addScalarBar().show(axes=1)

    # 返回修复后的模型和所有曲率值
    return mesh, curvature_arr

# 修复z轴
def fix_axis(mesh, Curvature_Arr):

    """
    根据曲率进行矫正z轴
    :return new_pts:拟合平面的点，T：（trimesh.transform)矫正到z轴朝上的4x4变换矩阵
    """
    # 获取曲率线
    mesh_points = mesh.points()
    pts = []
    for i in range(len(Curvature_Arr)):
        if Curvature_Arr[i] < -2:
            pts.append(mesh_points[i])

    c, n = trimesh.points.plane_fit(pts)

    # 第二次拟合平面
    distence = trimesh.points.point_plane_distance(pts, n, plane_origin=c)
    new_pts = [pts[i] for i in range(len(distence)) if abs(distence[i]) < 5]
    c, n = trimesh.points.plane_fit(new_pts)

    # 矫正到z轴
    T = trimesh.geometry.plane_transform(c, n)

    # show
    # T = np.linalg.inv(trimesh.geometry.plane_transform(origin=c, normal=n))
    # plane = trimesh.path.creation.grid(side=50, transform=T)
    # p = trimesh.points.PointCloud(np.array(new_pts))
    # trimesh.Scene([plane, p]).show()

    # 修正后的点（list）
    return new_pts, T


