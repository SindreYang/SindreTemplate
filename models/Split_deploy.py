# -*- coding: UTF-8 -*-
'''
=================================================
@path   ：MeshSegNet_GPU -> Deploy.py
@IDE    ：PyCharm
@Author ：sindre
@Email  ：yx@mviai.com
@Date   ：2022/11/16 9:31
@Version: V0.1
@License: (C)Copyright 2021-2022 , UP3D
@Reference: 
@History:
- 2022/11/16 :
==================================================
'''
__author__ = 'sindre'


"""
全冠部署子类xxx的实现：
1. 用open3d 提取网格模型的顶点，面片；
2.
3
4. 
"""

from . import *


class CalcEdges(object):
    def __init__(self, adj_idx, normals, barycenters):
        self.adj_idx = adj_idx
        self.normals = normals
        self.barycenters = barycenters

    def _is_exists(self, it):
        return (it is not None)

    def _calc_theta(self, i_node):
        temp = []
        for i_nei in self.adj_idx[i_node]:
            cos_theta = np.dot(self.normals[i_node, 0:3], self.normals[i_nei, 0:3]) / np.linalg.norm(
                self.normals[i_node, 0:3]) / np.linalg.norm(self.normals[i_nei, 0:3])
            if cos_theta >= 1.0:
                cos_theta = 0.9999
            theta = np.arccos(cos_theta)
            phi = np.linalg.norm(self.barycenters[i_node, :] - self.barycenters[i_nei, :])
            if theta > np.pi / 2.0:
                temp.append([i_node, i_nei, -np.log10(theta / np.pi) * phi])
            else:
                beta = 1 + np.linalg.norm(np.dot(self.normals[i_node, 0:3], self.normals[i_nei, 0:3]))
                temp.append([i_node, i_nei, -beta * np.log10(theta / np.pi) * phi])

        return np.array(temp) if len(temp) != 0 else None

    def __call__(self, constraints=20 * 10000) -> (np.array):
        edge_scores = list(filter(self._is_exists, map(self._calc_theta, range(0, len(self.adj_idx)))))
        edges = np.vstack(edge_scores[:])
        edges[:, 2] *= constraints
        edges = edges.astype(np.int32)
        return edges


class PostProcessing(object):
    def __init__(self):
        pass

    def _init_refinement(self, cropped_mesh_prob, class_num=17):
        pairwise = (1 - np.eye(class_num, dtype=np.int32))
        cropped_mesh_prob[cropped_mesh_prob < 1.0e-6] = 1.0e-6

        # unaries
        unaries = -100 * np.log10(cropped_mesh_prob)
        unaries = unaries.astype(np.int32)
        unaries = unaries.reshape(-1, class_num)

        adj_face_idxs = []
        selected_cell_ids = self.cell_ids
        for num_f in range(len(selected_cell_ids)):
            nei = np.sum(np.isin(selected_cell_ids, selected_cell_ids[num_f, :]), axis=1)
            nei_id = np.where(nei == 2)
            nei_id = list(nei_id[0][np.where(nei_id[0] > num_f)])
            adj_face_idxs.append(sorted(nei_id))

        return adj_face_idxs, unaries, pairwise

    def _refinement(self, cropped_mesh_prob, class_num=17, constraints=20 * 10000):
        adj_face_idxs, unaries, pairwise = self._init_refinement(cropped_mesh_prob, class_num=class_num)
        # 计算边缘和传导图-图切
        calc_edges = CalcEdges(adj_face_idxs, self.face_normals, self.barycenters)
        edges = calc_edges(constraints=constraints)
        refined_cropped_labels = cut_from_graph(edges, unaries, pairwise)
        return refined_cropped_labels

    def _upsampling(self, k):
        neigh = KNeighborsClassifier(n_neighbors=k)
        neigh.fit(np.concatenate([self.barycenters_deepcopy, self.face_normals_deepcopy], axis=1),
                  np.ravel(self.refine_labels))
        fine_labels = neigh.predict(np.concatenate([self.barycenters_ori, self.face_normals_ori], axis=1))
        fine_labels_n = fine_labels.reshape(-1)

        # neigh = FaissKNeighbors(k)
        # neigh._fit(np.concatenate([self.barycenters_deepcopy, self.face_normals_deepcopy], axis=1), self.refine_labels)
        # fine_labels_n = neigh._predict(np.concatenate([self.barycenters_ori, self.face_normals_ori], axis=1))
        return fine_labels_n


class PreProcessing(object):
    def __init__(self, device, ply_path, model_checkpoint_path, class_num, f_n=10000):
        self._generate_input(device, ply_path, model_checkpoint_path, class_num, f_n)

    def _generate_input(self, device, ply_path, model_checkpoint_path, class_num=17, f_n=10000):
        prediction_model = meshsegnet.MeshSegNet(num_classes=class_num, with_dropout=True, dropout_p=0.5).to(device)
        chack = torch.load(model_checkpoint_path)
        prediction_model.load_state_dict(chack["net"])
        self.prediction_model = prediction_model.eval()
        # 基础特征：
        mesh = vedo.load(ply_path)
        mesh.computeNormals(cells=True, points=False)
        '''
        vedo 
        mesh.computeNormals(cells=True, points=False).print()
        mesh.celldata["Normals"] 是面的法线
        直接mesh.normals() 是点的法线
        '''
        self.points_ori, self.face_normals_ori, self.face_ori, self.barycenters_ori = mesh.points(), mesh.celldata[
            "Normals"], mesh.faces(), mesh.cellCenters()
        ratio = f_n / mesh.NCells()
        mesh.decimate(fraction=ratio)
        mesh = vedo.utils.vedo2trimesh(mesh)  # 转成trimesh继续处理
        points = mesh.vertices.copy()
        face = mesh.vertices[mesh.faces].reshape(-1, 9)  # 面片
        normals = mesh.face_normals.copy()  # 面片法线
        barycenters = mesh.triangles_center.copy()  # 重心

        self.face_normals_deepcopy, self.barycenters_deepcopy, = deepcopy(normals), deepcopy(barycenters)

        # 会根据处理，值进行变化
        self.cells, self.face_normals, self.barycenters, self.cell_ids, self.points = \
            face, normals, barycenters, mesh.faces, points

        maxs = points.max(axis=0)
        mins = points.min(axis=0)
        means = points.mean(axis=0)
        stds = points.std(axis=0)
        nmeans = normals.mean(axis=0)
        nstds = normals.std(axis=0)

        for i in range(3):
            face[:, i] = (face[:, i] - means[i]) / stds[i]
            face[:, i + 3] = (face[:, i + 3] - means[i]) / stds[i]
            face[:, i + 6] = (face[:, i + 6] - means[i]) / stds[i]
            barycenters[:, i] = (barycenters[:, i] - mins[i]) / (maxs[i] - mins[i])
            normals[:, i] = (normals[:, i] - nmeans[i]) / nstds[i]

        X = np.column_stack((face, barycenters, normals)).transpose(1, 0)
        X = X.reshape([1, X.shape[0], X.shape[1]])
        self.X = torch.from_numpy(X).to(device, dtype=torch.float)


def export_mtl(import_mesh, save_mesh):
    ms = pymeshlab.MeshSet()
    ms.load_new_mesh(import_mesh)
    ms.save_current_mesh(save_mesh, save_vertex_normal=False)



class TeethSeg(PreProcessing, PostProcessing):
    def __init__(self, mesh_path, model_path, class_num=17, device=None, constraints=20 * 10000, refine_switch=True):
        if device is None:
            self.device = "cuda:0" if torch.cuda.is_available() else "cpu"

        PreProcessing.__init__(self, self.device, mesh_path, model_path, class_num, f_n=10000)
        self.class_num = class_num
        self.refine_labels = None
        self.constraints = constraints
        self.refine_switch = refine_switch

    def _inference_teeth(self):
        with torch.no_grad():
            tensor_prob_output = self.prediction_model(self.X).to(self.device, dtype=torch.float)
            output_mesh_prob = tensor_prob_output.cpu().detach().numpy().squeeze(0)
            if self.refine_switch:
                print("优化中...")
                self.refine_labels = PostProcessing._refinement(self, output_mesh_prob, class_num=self.class_num,
                                                                constraints=self.constraints)
            else:
                print("不执行优化...")
                self.refine_labels = np.argmax(output_mesh_prob, axis=1)

    def __call__(self):
        self._inference_teeth()
        upsampled_labels = PostProcessing._upsampling(self, k=3)
        return upsampled_labels

    def test_simple(self, save_path="upsampled_C++.ply", sampled=True):
        self._inference_teeth()
        # 测试
        colormap_hex = ['#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#42d4f4', '#f032e6', '#fabed4',
                        '#469990',
                        '#dcbeff',
                        '#9A6324', '#fffac8', '#800000', '#aaffc3', '#000075', '#a9a9a9', '#ffffff', '#000000'
                        ]
        colormap = [trimesh.visual.color.hex_to_rgba(i) for i in colormap_hex]
        if sampled:
            colors = [colormap[int(self.refine_labels[i])] for i in range(len(self.refine_labels))]
            mesh = trimesh.Trimesh(vertices=self.points, faces=self.cell_ids, face_colors=colors)
            mesh.export(save_path)
            # mesh.show()
        else:
            upsampled_labels = PostProcessing._upsampling(self, k=3)
            colors = [colormap[i] for i in upsampled_labels]
            mesh = trimesh.Trimesh(vertices=self.points_ori, faces=self.face_ori, face_colors=colors)
            # id5=np.argwhere(upsampled_labels==5)
            # trimesh.Trimesh(vertices=self.points_ori, faces=np.array(self.face_ori)[id5[:,0]]).export("5.ply")
            mesh.export(save_path)
            # trimesh.Scene([mesh]).show()

    def extraction_teeth(self,id_1=2,id_2=4):
        # id_1,id_2 默认为邻牙号，取2，4 或13，15
        # 返回邻牙（trimesh）,缺失牙弓（trimesh）,返回原始缺失牙（trimesh）
        self._inference_teeth()
        upsampled_labels = PostProcessing._upsampling(self, k=3)
        face_ext = np.array(self.face_ori)[np.where((upsampled_labels == id_1) | (upsampled_labels == id_2))[0]]
        mesh_ext = trimesh.Trimesh(vertices=self.points_ori, faces=face_ext)
        ####
        miss_id = min(id_1,id_2)+1
        face_miss = np.array(self.face_ori)[np.where(upsampled_labels != miss_id)]
        mesh_miss = trimesh.Trimesh(vertices=self.points_ori, faces= face_miss)
        ####
        face_tooth_miss = np.array(self.face_ori)[np.where(upsampled_labels == miss_id)]
        mesh_tooth_miss = trimesh.Trimesh(vertices=self.points_ori, faces=face_tooth_miss)


        return mesh_ext,mesh_miss,mesh_tooth_miss
