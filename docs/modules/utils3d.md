# `src/utils3d`

基于 Three.js 封装常用流程：GLB/GLTF、PLY、STL、OBJ 加载、自动居中及相机适配、屏幕射线拾取、对象与材质/贴图资源释放。实现放在 `algorithms.ts` 与 `model.ts`，`index.ts` 统一导出。公开命名：`load_model`、`get_gltf/get_ply/get_stl/get_obj`、`set_camera_to_object`、`get_picked_object`、`dispose_object`。依赖 `three` 由使用者安装。

浏览器文件导入时可直接调用 `load_model(await file.arrayBuffer(), file.name)`；它统一识别扩展名，返回 `{ object, format, meshes, vertices }`，返回的对象可交给 `dispose_object`。底层 `get_*` 入口仍保留，适合需要原始 `GLTF` 或 `BufferGeometry` 的场景。解析器只在显式使用时加载，不应从 `sindrejs/general` 普通入口间接引入。

React 应用可以按需安装 `react@19`、`three`、`@react-three/fiber@9`、`@react-three/drei@10`，从 `sindrejs/utils3d/react` 导入 `Scene3D`、`Model3D` 和 `preload_model`。该入口还导出 Canvas、OrbitControls、Grid、Center、Bounds、Environment、Html、相机 Gizmo 和 R3F hooks，便于组合自定义场景；hooks 只能在 Canvas 内调用。模型组件支持 `.glb/.gltf`，PLY/STL/OBJ 继续由 `sindrejs/utils3d` 或通用 `load` 处理。

## 样条与网格表面路径

样条采样、插点和表面最短路径由纯算法实现，不引用 Studio 的编辑器引擎。`get_catmull_rom_points` 接收局部坐标和正整数采样段数；`get_curve_insert_index` 的投影回调负责把局部点转换为屏幕点，命中失败返回 `-1`。

```ts
import { get_catmull_rom_points, get_curve_insert_index,
  get_path_cache, get_surface_path } from "sindrejs/utils3d";

const controls: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [1, 1, 0]];
const samples = get_catmull_rom_points(controls, 128, false);
const insertAt = get_curve_insert_index(mouseX, mouseY, controls.length, samples,
  (point) => project_to_screen(point));

let cache = get_path_cache();
const mesh = {
  verts: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0]),
  faces: new Uint32Array([0, 1, 2, 0xffffffff]),
  nbVerts: 3, nbFaces: 1,
};
const path = get_surface_path(controls, false, cache, () => mesh);
// 修改 mesh 的原始 typed array 内容后：cache = get_path_cache();
```

`faces` 每面固定四个索引；三角面用 `0xffffffff` 填充第四位，四边面只沿真实边寻路。`verts` 为连续的局部坐标 `x,y,z`。缓存按数组引用复用网格拓扑；若**原地修改**网格数组，必须建立新的缓存对象，否则可能得到旧路径。控制点坐标变化会刷新相应路径段。`get_surface_path` 在未提供网格或不可达时回退为折线；最近顶点路径沿边连接，不是穿过三角形内部的测地线。样条插点的投影函数应返回 CSS 像素坐标或 `null`，与鼠标位置使用同一坐标系。

## 局部塑形、平滑和压平

这些函数只计算局部空间中的新顶点坐标，保持 `faces` 不变；用于拉动原表面，不会生成新的侧壁或网格。调用方负责鼠标拾取、撤销、更新法线与渲染。网格输入的 `vertices` 为 `Float32Array`，面为 `Uint32Array`；默认每面三个索引，SculptGL 的三角/四边混合面传 `face_stride: 4`，三角面的第四项为 `0xffffffff`。

```ts
import { get_mesh_topology, get_mesh_region, change_mesh_by_brush,
  smooth_mesh_region, flatten_mesh_region } from "sindrejs/utils3d";

const mesh = {
  vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  faces: new Uint32Array([0, 1, 2]),
};
const topology = get_mesh_topology(mesh); // 面与顶点数量不变时重复使用
const region = get_mesh_region(mesh, [0, 0, 0], 2, {
  seed_index: 0, // 从实际命中的面选定种子，避免薄模型背面误选
  topology,
  distance: "surface", // 默认沿网格边距离；"spatial" 为球形距离并限制连通
});

const moved = change_mesh_by_brush(mesh, region, [0, 0, 0.2]);
const smoothed = smooth_mesh_region(mesh, region, { topology, strength: 0.4, tangent: true });
const flattened = flatten_mesh_region(mesh, region, {
  point: [0, 0, 0], normal: [0, 0, 1], strength: 0.7,
});
// 三种操作互相独立；下一次操作若基于 moved，应传 { ...mesh, vertices: moved }。
```

`get_mesh_region` 返回等长的顶点索引和 `0–1` 权重；可传 `mask` 数组进一步减弱或排除顶点，约定 **1 表示可编辑，0 表示锁定**，与 Studio 现有材质遮罩第三通道一致。半径和移动量都是模型局部空间单位。`smooth_mesh_region` 默认沿开放边界滑动；`boundary: "fixed"` 固定边界，`"free"` 允许自由平滑。`tangent: true` 保留大部分法线方向的体积，适合表面磨平；多次普通均值平滑可能使网格收缩。

Studio 接入时，在笔划开始前记录原顶点与撤销状态；拾取命中面后提供 `seed_index`，将返回数组写回现有网格，调用引擎的 `updateGeometry` 和缓冲区刷新。拖动预览每帧从同一份原顶点计算，避免累计重复位移。拓扑在面索引或顶点数量改变后需重建；表面距离每次按**当前顶点位置**计算。若模型具有 UV 接缝、重复顶点或多个材质，接入层应按模型原始索引保持这些属性的一致性。

```tsx
import { Scene3D, Model3D, preload_model } from "sindrejs/utils3d/react";

function Viewer() {
  return <>
    <button onMouseEnter={() => preload_model("/models/example.glb")}>预加载模型</button>
    <Scene3D className="h-96 w-full" grid fallback={<p>无法显示 3D 场景</p>}>
      <Model3D src="/models/example.glb" center />
    </Scene3D>
  </>;
}
```

## 注意

- `get_gltf` 返回 glTF 场景及调用者可访问的原始结果；PLY/STL 返回 `BufferGeometry`，OBJ 返回 `Object3D`。`general.load/save` 按扩展名调用这些算法及相应导出器。
- 把“移出场景”和“释放 GPU 资源”分开；共享材质/纹理不能盲目销毁。
- 转换点或射线前更新世界矩阵，屏幕坐标需提供视口尺寸与 DOM 元素实际矩形。
- Studio 当前 3D 主引擎含 SculptGL；首版不迁移 SculptGL 内部状态或复制整个引擎。GLB 与其他网格格式的转换需逐格式验证。
- React 组件需要客户端 WebGL 与一个有明确高度的容器。GLTF 路径和资源由宿主部署；加载时由组件内 Suspense 暂时保持空场景，应用可自行包裹错误边界。`Clone` 让同一缓存模型可在多个位置使用，勿对缓存对象直接执行 `dispose_object`。
