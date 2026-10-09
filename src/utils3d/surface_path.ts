/**
 * surfacePath — 网格表面路径算法(纯函数模块)
 *
 * 与具体编辑器无关的核心算法:
 *   - 邻接表构建(buildAdjacency)
 *   - 空间网格索引(buildSpatialGrid / get_nearest_vertex)
 *   - 基于边长的 Dijkstra 最短路径(get_shortest_surface_path)
 *   - 段级缓存 + 路径签名的表面路径计算(get_surface_path)
 *
 * 设计原则:
 *   - 纯函数:不直接操作引擎/DOM,数据由调用方传入
 *   - 缓存上下文(CacheContext)由调用方持有,跨调用复用
 */

// ── 类型定义 ──

/** 网格拓扑数据(邻接表 + 顶点 + 空间索引) */
export interface MeshPathData {
  /** 邻接表:每个顶点的邻居顶点索引列表 */
  adj: number[][];
  /** 顶点坐标 [x0,y0,z0, x1,y1,z1, ...](局部空间) */
  verts: Float32Array;
  /** 空间网格索引:格子 key → 顶点索引列表 */
  grid: Map<string, number[]>;
  /** 格子大小 */
  cellSize: number;
}

/** 缓存上下文(由调用方持有,跨调用复用) */
export interface PathCacheContext {
  /** 当前缓存所属网格；原地修改数组后需重新创建缓存. */
  facesRef: Uint32Array | null;
  vertsRef: Float32Array | null;
  nbFaces: number;
  nbVerts: number;
  adj: number[][];
  grid: Map<string, number[]>;
  gridCellSize: number;
  /** 段级路径缓存 */
  segCache: Array<{ key: string; path: number[] } | null>;
  /** 整条路径签名缓存 */
  cachedPath: Array<[number, number, number]>;
  /** 每一段的实际采样点,长度可变;用于沿表面模式的精确插点映射. */
  cachedSegments: Array<Array<[number, number, number]>>;
  lastPathKey: string;
}

/** 创建一个空的缓存上下文 */
export function get_path_cache(): PathCacheContext {
  return {
    facesRef: null,
    vertsRef: null,
    nbFaces: 0,
    nbVerts: 0,
    adj: [],
    grid: new Map(),
    gridCellSize: 0,
    segCache: [],
    cachedPath: [],
    cachedSegments: [],
    lastPathKey: "",
  };
}

// ── 邻接表 / 空间索引 ──

/**
 * 获取或构建邻接表 + 空间网格.
 * 通过 meshDataProvider 提供 faces/verts(避免本模块直接依赖引擎).
 */
export function get_mesh_path_data(
  cache: PathCacheContext,
  meshDataProvider: () => { faces: Uint32Array; verts: Float32Array; nbFaces: number; nbVerts: number } | null,
): MeshPathData | null {
  const md = meshDataProvider();
  if (!md) return null;
  const { faces, verts, nbFaces, nbVerts } = md;
  if (!Number.isSafeInteger(nbFaces) || !Number.isSafeInteger(nbVerts) || nbFaces < 0 || nbVerts < 0 ||
      faces.length < nbFaces * 4 || verts.length < nbVerts * 3) {
    throw new RangeError("mesh requires four face indices per face and three coordinates per vertex");
  }

  // 按数组引用和元素数量复用，避免每次拖动都扫描整张网格.
  // 调用方原地修改网格后必须重新创建缓存.
  if (
    cache.facesRef === faces
    && cache.vertsRef === verts
    && cache.nbFaces === nbFaces
    && cache.nbVerts === nbVerts
    && cache.adj.length === nbVerts
  ) {
    return {
      adj: cache.adj,
      verts,
      grid: cache.grid,
      cellSize: cache.gridCellSize,
    };
  }

  // 网格变化后顶点索引和路径都可能失效.
  cache.segCache = [];
  cache.cachedPath = [];
  cache.cachedSegments = [];
  cache.lastPathKey = "";

  // 构建邻接表
  const adj: number[][] = Array.from({ length: nbVerts }, () => []);
  for (let i = 0; i < nbFaces; i++) {
    const j = i * 4;
    const a = faces[j], b = faces[j + 1], c = faces[j + 2], d = faces[j + 3];
    const addEdge = (u: number, v: number) => {
      if (u >= nbVerts || v >= nbVerts || u === v) return;
      if (adj[u].indexOf(v) < 0) adj[u].push(v);
      if (adj[v].indexOf(u) < 0) adj[v].push(u);
    };
    addEdge(a, b);
    addEdge(b, c);
    if (d !== 0xffffffff) {
      // 四边面只连接真实边,不加入会穿过面的 a-c 对角线.
      addEdge(c, d);
      addEdge(d, a);
    } else {
      addEdge(c, a);
    }
  }

  // 构建空间网格索引
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < nbVerts; i++) {
    const j = i * 3;
    if (verts[j] < minX) minX = verts[j]; if (verts[j] > maxX) maxX = verts[j];
    if (verts[j + 1] < minY) minY = verts[j + 1]; if (verts[j + 1] > maxY) maxY = verts[j + 1];
    if (verts[j + 2] < minZ) minZ = verts[j + 2]; if (verts[j + 2] > maxZ) maxZ = verts[j + 2];
  }
  const cellSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 50 || 1;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < nbVerts; i++) {
    const j = i * 3;
    const cx = Math.floor(verts[j] / cellSize), cy = Math.floor(verts[j + 1] / cellSize), cz = Math.floor(verts[j + 2] / cellSize);
    const key = `${cx},${cy},${cz}`;
    let cell = grid.get(key); if (!cell) { cell = []; grid.set(key, cell); }
    cell.push(i);
  }

  cache.facesRef = faces;
  cache.vertsRef = verts;
  cache.nbFaces = nbFaces;
  cache.nbVerts = nbVerts;
  cache.adj = adj;
  cache.grid = grid;
  cache.gridCellSize = cellSize;
  return { adj, verts, grid, cellSize };
}

/**
 * 空间网格找最近顶点(只在附近格子搜索,避免全顶点遍历).
 * @returns 最近顶点索引
 */
export function get_nearest_vertex(grid: Map<string, number[]>, cellSize: number, verts: Float32Array, pt: [number, number, number]): number {
  if (!verts.length || !Number.isFinite(cellSize) || cellSize <= 0) return -1;
  const cx = Math.floor(pt[0] / cellSize), cy = Math.floor(pt[1] / cellSize), cz = Math.floor(pt[2] / cellSize);
  let best = -1, bestDist = Infinity;
  // 从中心格子逐环扩大.找到候选后继续到“未搜索格子的理论最近距离”
  // 已大于当前最优距离,不能在第一个非空环就提前停止.
  const maxRing = 64;
  for (let r = 0; r <= maxRing; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
      if (r > 0 && Math.abs(dx) < r && Math.abs(dy) < r && Math.abs(dz) < r) continue;
      const cell = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
      if (!cell) continue;
      for (const vi of cell) {
        const j = vi * 3;
        const d = (verts[j] - pt[0]) ** 2 + (verts[j + 1] - pt[1]) ** 2 + (verts[j + 2] - pt[2]) ** 2;
        if (d < bestDist) { bestDist = d; best = vi; }
      }
    }
    const unseenLowerBound = Math.max(0, r - 1) * cellSize;
    if (best >= 0 && unseenLowerBound * unseenLowerBound > bestDist) return best;
  }
  // 控制点可能远离包围盒,空间格子 64 环仍找不到时做正确性兜底.
  for (let vi = 0; vi < verts.length / 3; vi++) {
    const j = vi * 3;
    const d = (verts[j] - pt[0]) ** 2 + (verts[j + 1] - pt[1]) ** 2 + (verts[j + 2] - pt[2]) ** 2;
    if (d < bestDist) { bestDist = d; best = vi; }
  }
  return best;
}

// ── Dijkstra(按边长)──

/**
 * 沿网格表面两点间的最短顶点路径(标准 Dijkstra + 二叉堆).
 * @returns 顶点索引路径(从 start 到 end),失败返回 null
 */
export function get_shortest_surface_path(
  adj: number[][], verts: Float32Array, grid: Map<string, number[]>, cellSize: number,
  startLocal: [number, number, number], endLocal: [number, number, number],
): number[] | null {
  const startIdx = get_nearest_vertex(grid, cellSize, verts, startLocal);
  const endIdx = get_nearest_vertex(grid, cellSize, verts, endLocal);
  if (startIdx < 0 || endIdx < 0) return null;
  if (startIdx === endIdx) return [startIdx];

  const n = adj.length;
  const dist = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  dist[startIdx] = 0;

  // 二叉堆(最小堆,按 dist)
  const heap: Array<[number, number]> = [[0, startIdx]];
  const heapPush = (d: number, v: number) => {
    heap.push([d, v]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= d) break;
      heap[i] = heap[p]; heap[p] = [d, v];
      i = p;
    }
  };
  const heapPop = (): [number, number] | undefined => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length === 0) return top;
    heap[0] = last;
    let i = 0;
    const h = heap.length;
    for (;;) {
      let smallest = i;
      const l = (i << 1) + 1, r = (i << 1) + 2;
      if (l < h && heap[l][0] < heap[smallest][0]) smallest = l;
      if (r < h && heap[r][0] < heap[smallest][0]) smallest = r;
      if (smallest === i) break;
      [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
      i = smallest;
    }
    return top;
  };

  let found = false;
  while (heap.length > 0) {
    const entry = heapPop();
    if (!entry) break;
    const [d, u] = entry;
    if (closed[u]) continue;
    closed[u] = 1;
    if (u === endIdx) { found = true; break; }

    const neighbors = adj[u];
    const uj = u * 3;
    for (let k = 0; k < neighbors.length; k++) {
      const v = neighbors[k];
      if (closed[v]) continue;
      const vj = v * 3;
      const dx = verts[vj] - verts[uj];
      const dy = verts[vj + 1] - verts[uj + 1];
      const dz = verts[vj + 2] - verts[uj + 2];
      const w = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nd = d + w;
      if (nd < dist[v]) {
        prev[v] = u;
        dist[v] = nd;
        heapPush(nd, v);
      }
    }
  }

  if (!found) return null;
  const path: number[] = [];
  let cur = endIdx;
  while (cur >= 0) { path.push(cur); cur = prev[cur]; }
  return path.reverse();
}

// ── 表面路径计算(段级缓存)──

/**
 * 沿网格表面在控制点之间生成路径点列(段级缓存 + 只重算受影响段).
 * @param pts 控制点(局部空间)
 * @param closed 是否闭合
 * @param cache 缓存上下文(跨调用复用)
 * @param meshDataProvider 提供网格 faces/verts
 */
export function get_surface_path(
  pts: Array<[number, number, number]>,
  closed: boolean,
  cache: PathCacheContext,
  meshDataProvider: () => { faces: Uint32Array; verts: Float32Array; nbFaces: number; nbVerts: number } | null,
): Array<[number, number, number]> {
  if (pts.length < 2) {
    cache.segCache = [];
    cache.cachedPath = [];
    cache.cachedSegments = [];
    cache.lastPathKey = "";
    return pts;
  }

  const md = get_mesh_path_data(cache, meshDataProvider);
  const cnt = closed ? pts.length : pts.length - 1;

  // 段数变化 → 只扩展/截断,保留已有段的缓存
  if (cache.segCache.length > cnt) {
    cache.segCache.length = cnt;
  } else if (cache.segCache.length < cnt) {
    for (let s = cache.segCache.length; s < cnt; s++) cache.segCache[s] = null;
  }

  if (!md) { // 回退直线
    const r: Array<[number, number, number]> = [];
    const segments: Array<Array<[number, number, number]>> = [];
    for (let s = 0; s < cnt; s++) {
      const a = pts[s], b = pts[(s + 1) % pts.length];
      const segment: Array<[number, number, number]> = [];
      for (let t = 0; t <= 12; t++) { const r2 = t / 12; const p: [number, number, number] = [a[0] + (b[0] - a[0]) * r2, a[1] + (b[1] - a[1]) * r2, a[2] + (b[2] - a[2]) * r2]; r.push(p); segment.push(p); }
      segments.push(segment);
    }
    cache.cachedSegments = segments;
    cache.cachedPath = r;
    cache.lastPathKey = "";
    return r;
  }

  // 端点顶点 ID 不能作为完整缓存键:控制点可能仍落在同一个最近顶点
  // 的邻域内,但实际坐标已经改变.把坐标一并纳入签名,避免复用旧路径.
  const pointKey = (p: [number, number, number]) => p.join(",");
  const keys: string[] = new Array(cnt);
  for (let s = 0; s < cnt; s++) {
    const a = pts[s], b = pts[(s + 1) % pts.length];
    const sa = get_nearest_vertex(md.grid, md.cellSize, md.verts, a);
    const sb = get_nearest_vertex(md.grid, md.cellSize, md.verts, b);
    keys[s] = `${sa}_${sb}_${pointKey(a)}_${pointKey(b)}`;
  }
  const pathKey = keys.join("|");

  // 整条路径没变 → 直接返回缓存
  if (pathKey === cache.lastPathKey && cache.cachedPath.length > 0) {
    return cache.cachedPath;
  }

  const result: Array<[number, number, number]> = [];
  const segments: Array<Array<[number, number, number]>> = [];
  for (let s = 0; s < cnt; s++) {
    const a = pts[s], b = pts[(s + 1) % pts.length];
    const key = keys[s];

    // 该段没变 → 复用;变了 → 只重算这一段
    let path: number[] | null = null;
    const cached = cache.segCache[s];
    if (cached && cached.key === key) {
      path = cached.path;
    } else {
      path = get_shortest_surface_path(md.adj, md.verts, md.grid, md.cellSize, a, b);
      cache.segCache[s] = { key, path: path ?? [] };
    }

    const segment: Array<[number, number, number]> = [];
    if (path && path.length > 0) {
      for (const vi of path) { const j = vi * 3; const p: [number, number, number] = [md.verts[j], md.verts[j + 1], md.verts[j + 2]]; result.push(p); segment.push(p); }
    } else {
      for (let t = 0; t <= 12; t++) { const r2 = t / 12; const p: [number, number, number] = [a[0] + (b[0] - a[0]) * r2, a[1] + (b[1] - a[1]) * r2, a[2] + (b[2] - a[2]) * r2]; result.push(p); segment.push(p); }
    }
    segments.push(segment);
  }

  cache.cachedPath = result;
  cache.cachedSegments = segments;
  cache.lastPathKey = pathKey;
  return result;
}
