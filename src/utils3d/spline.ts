/**
 * splineCurve — 样条曲线算法(纯函数模块)
 *
 * 基于 three.js 的 CatmullRomCurve3(纯数学类,不依赖 three 渲染器).
 *
 * 职责:
 *   - get_catmull_rom_points:控制点 → 采样点列
 *   - get_curve_insert_index:鼠标位置 → 应插入的控制点索引(曲线上插点)
 *
 * 设计原则:
 *   - 纯函数:控制点,采样段数,屏幕点列等由调用方传入
 *   - 不直接依赖引擎/DOM
 */

import { CatmullRomCurve3, Vector3 } from "three";

// ── 常量 ──
/** 采样段数(曲线平滑度) */
export const SPLINE_SEGMENTS = 128;
/** 曲线插点命中距离的上下限(像素). 实际值按局部屏幕尺度计算. */
const MIN_CURVE_HIT_RADIUS = 3;
const MAX_CURVE_HIT_RADIUS = 32;
const SAMPLE_SPACING_FACTOR = 3;
const CONTROL_SPAN_FACTOR = 0.4;
const END_SEGMENT_GUARD_RATIO = 0.6;

// ── 类型定义 ──

/** 控制点坐标(局部空间) */
export type Pt3 = [number, number, number];
/** 曲线采样中某个控制点段对应的首尾采样下标(end 为该段最后一个点). */
export interface SegmentRange {
  start: number;
  end: number;
  /** 原始控制点段编号;不能使用范围数组下标替代,因为单点/空路径段可能被跳过. */
  segment?: number;
}

// ── 采样 ──

/**
 * 用 three CatmullRomCurve3 生成采样点列.
 * @param points 控制点(局部空间),需 ≥2 个
 * @param segments 采样段数(默认 SPLINE_SEGMENTS)
 * @returns 采样点列(局部空间,长度 = segments + 1)
 */
export function get_catmull_rom_points(
  points: Pt3[],
  segments: number = SPLINE_SEGMENTS,
  closed: boolean = false,
): Pt3[] {
  if (!Number.isSafeInteger(segments) || segments < 1) throw new RangeError("segments must be a positive integer");
  if (points.some((point) => point.length !== 3 || point.some((coordinate) => !Number.isFinite(coordinate)))) {
    throw new TypeError("control points must contain finite 3D coordinates");
  }
  if (points.length < 2) return points.slice();
  const locals = points.map((p) => new Vector3(p[0], p[1], p[2]));
  // centripetal 参数化可避免非均匀控制点下常见的尖点和自交.
  // 不得再对 x/y/z 分量分别钳制: 分量裁剪会破坏曲线切线连续性,
  // 在闭合曲线上表现为水平折线,尖角和回折.
  const curve = new CatmullRomCurve3(locals, closed, "centripetal");
  const out: Pt3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = curve.getPoint(t);
    if (Number.isFinite(pt.x) && Number.isFinite(pt.y) && Number.isFinite(pt.z)) {
      out.push([pt.x, pt.y, pt.z]);
      continue;
    }
    // Three.js 已处理重复点; 此处只为异常数值保留线性兜底.
    const segmentCount = closed ? points.length : points.length - 1;
    const scaled = t * segmentCount;
    const segment = Math.min(Math.floor(scaled), segmentCount - 1);
    const localT = Math.min(Math.max(scaled - segment, 0), 1);
    const a = points[segment % points.length];
    const b = points[(segment + 1) % points.length];
    out.push([
      a[0] + (b[0] - a[0]) * localT,
      a[1] + (b[1] - a[1]) * localT,
      a[2] + (b[2] - a[2]) * localT,
    ]);
  }
  return out;
}

// ── 曲线上插点 ──

/**
 * 查找鼠标点击位置在曲线上对应的插入点索引.
 *
 * 流程:
 *   1. 采样曲线 → 投影到屏幕(由 screenProject 回调提供)
 *   2. 鼠标找最近采样线段, 按局部采样间距与控制点间距动态计算命中范围
 *   3. 线段参数 → 曲线参数 t → 控制点段 seg → 插入位置 seg+1
 *
 * @param cx 鼠标 canvas 坐标 x
 * @param cy 鼠标 canvas 坐标 y
 * @param controlCount 控制点数量
 * @param samples 曲线采样点(局部空间)
 * @param screenProject 局部/世界 → 屏幕坐标的投影回调
 * @returns 应插入的控制点索引(在 idx 处插入,即插到原 idx-1 和 idx 之间),-1 = 不在曲线上
 */
export function get_curve_insert_index(
  cx: number,
  cy: number,
  controlCount: number,
  samples: Pt3[],
  screenProject: (local: Pt3) => [number, number] | null,
  closed: boolean = false,
  segmentRanges?: SegmentRange[],
  localHint?: Pt3,
  controlPoints?: Pt3[],
): number {
  if (controlCount < 2 || samples.length < 2) return -1;

  // 采样点 → 屏幕坐标. 保留投影失败的空洞, 不跨空洞计算线段.
  const pts2d: Array<[number, number] | null> = samples.map((p) => screenProject(p));
  const distance = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const pointToSegment = (p: [number, number], a: [number, number], b: [number, number]) => {
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const lenSq = vx * vx + vy * vy;
    const u = lenSq > 1e-8
      ? Math.min(Math.max(((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / lenSq, 0), 1)
      : 0;
    const q: [number, number] = [a[0] + vx * u, a[1] + vy * u];
    return { distance: distance(p, q), u };
  };
  const pointToSegment3d = (p: Pt3, a: Pt3, b: Pt3) => {
    const vx = b[0] - a[0], vy = b[1] - a[1], vz = b[2] - a[2];
    const lenSq = vx * vx + vy * vy + vz * vz;
    const u = lenSq > 1e-12
      ? Math.min(Math.max(((p[0] - a[0]) * vx + (p[1] - a[1]) * vy + (p[2] - a[2]) * vz) / lenSq, 0), 1)
      : 0;
    const dx = p[0] - (a[0] + vx * u);
    const dy = p[1] - (a[1] + vy * u);
    const dz = p[2] - (a[2] + vz * u);
    return dx * dx + dy * dy + dz * dz;
  };

  // 找鼠标最近的可见采样线段. 采样越稀疏/模型越大, 容差越大;
  // 控制点越近, 容差自动收紧, 避免相邻短线段互相抢命中.
  let bestDistance = Infinity;
  let bestSpatialDistance = Infinity;
  let bestT = -1;
  let bestSegment = -1;
  const candidates: Array<{
    screenDistance: number;
    spatialDistance: number;
    t: number;
    segment: number;
    hitRadius: number;
  }> = [];
  for (let i = 0; i < pts2d.length - 1; i++) {
    const a = pts2d[i], b = pts2d[i + 1];
    if (!a || !b) continue;
    const hit = pointToSegment([cx, cy], a, b);
    const spacing = Math.max(
      distance(a, b),
      i > 0 && pts2d[i - 1] ? distance(pts2d[i - 1]!, a) : 0,
      i + 2 < pts2d.length && pts2d[i + 2] ? distance(b, pts2d[i + 2]!) : 0,
    );
    const t0 = i / (samples.length - 1);
    const t1 = (i + 1) / (samples.length - 1);
    let controlSegment: number;
    let startSample: number;
    let endSample: number;
    if (segmentRanges?.length) {
      const rangeIndex = segmentRanges.findIndex((range) => i >= range.start && i < range.end);
      if (rangeIndex < 0) continue;
      controlSegment = segmentRanges[rangeIndex].segment ?? rangeIndex;
      startSample = segmentRanges[rangeIndex].start;
      endSample = segmentRanges[rangeIndex].end;
    } else {
      controlSegment = closed
        ? Math.floor(t0 * controlCount) % controlCount
        : Math.min(Math.floor(t0 * (controlCount - 1)), controlCount - 2);
      const denominator = closed ? controlCount : controlCount - 1;
      startSample = Math.round(controlSegment * (samples.length - 1) / denominator);
      const nextControl = closed ? (controlSegment + 1) % controlCount : controlSegment + 1;
      endSample = Math.round(nextControl * (samples.length - 1) / denominator);
    }
    const controlSpan = pts2d[startSample] && pts2d[endSample]
      ? distance(pts2d[startSample]!, pts2d[endSample]!)
      : 0;
    let hitRadius = Math.min(MAX_CURVE_HIT_RADIUS, Math.max(MIN_CURVE_HIT_RADIUS, spacing * SAMPLE_SPACING_FACTOR));
    if (controlSpan > 0) {
      hitRadius = Math.min(hitRadius, Math.max(MIN_CURVE_HIT_RADIUS, controlSpan * CONTROL_SPAN_FACTOR));
    }
    const spatialDistance = localHint
      ? pointToSegment3d(localHint, samples[i], samples[i + 1])
      : Infinity;
    // 屏幕上重叠的段(常见于闭合曲线或牙缝投影)不能只按 2D 最近段决定.
    // 先保证点击在线附近,再用实际网格命中点的 3D 距离稳定消歧.
    const screenTie = localHint ? Math.max(4, Math.min(16, hitRadius * 0.75)) : 0;
    const isBetter = hit.distance <= hitRadius && (
      hit.distance < bestDistance - screenTie
      || (Math.abs(hit.distance - bestDistance) <= screenTie && spatialDistance < bestSpatialDistance)
    );
    if (isBetter) {
      bestDistance = hit.distance;
      bestSpatialDistance = spatialDistance;
      bestT = t0 + (t1 - t0) * hit.u;
      bestSegment = controlSegment;
    }
    if (hit.distance <= hitRadius) {
      candidates.push({
        screenDistance: hit.distance,
        spatialDistance,
        t: t0 + (t1 - t0) * hit.u,
        segment: controlSegment,
        hitRadius,
      });
    }
  }
  if (bestT < 0) return -1; // 不在曲线上

  // 末段保护:如果屏幕上误命中了末段,但鼠标下方的真实网格点明显更接近
  // 中间控制点,则优先选择该控制点相邻的候选段,避免把新点追加到末尾.
  if (localHint && controlPoints && controlPoints.length === controlCount && candidates.length > 0) {
    const nearest = controlPoints.reduce((result, point, index) => {
      const d = pointToSegment3d(localHint, point, point);
      return d < result.distance ? { index, distance: d } : result;
    }, { index: -1, distance: Infinity });
    const lastSegment = closed ? controlCount - 1 : controlCount - 2;
    if (nearest.index >= 0 && nearest.index < controlCount - 1 && bestSegment === lastSegment) {
      const lastEndpoints = closed
        ? [controlPoints[controlCount - 1], controlPoints[0]]
        : [controlPoints[controlCount - 2], controlPoints[controlCount - 1]];
      const lastEndpointDistance = Math.min(
        pointToSegment3d(localHint, lastEndpoints[0], lastEndpoints[0]),
        pointToSegment3d(localHint, lastEndpoints[1], lastEndpoints[1]),
      );
      const adjacent = candidates
        .filter((candidate) => candidate.segment === nearest.index - 1 || candidate.segment === nearest.index)
        .sort((a, b) => a.spatialDistance - b.spatialDistance)[0];
      if (
        adjacent
        && nearest.distance < lastEndpointDistance * END_SEGMENT_GUARD_RATIO
        && adjacent.screenDistance <= Math.max(adjacent.hitRadius, bestDistance + 8)
      ) {
        bestDistance = adjacent.screenDistance;
        bestSpatialDistance = adjacent.spatialDistance;
        bestT = adjacent.t;
        bestSegment = adjacent.segment;
      }
    }
  }

  // 使用实际段范围时,不能再按全局采样比例推断控制点段;表面路径每段长度不同.
  if (segmentRanges?.length && bestSegment >= 0) return bestSegment + 1;

  // 线段参数对应曲线参数 t, 再映射到控制点段
  const t = bestT;
  const n = controlCount;
  if (closed) {
    // 闭合环:n 段(含首尾连接段),返回 0..n(n=末尾,即首尾之间)
    const seg = Math.floor(t * n) % n;
    return seg + 1;
  }
  const seg = Math.min(Math.floor(t * (n - 1)), n - 2);
  return seg + 1;
}

// ── 工具 ──

/**
 * 计算控制点折线总长度(用于 debug / 信息展示).
 */
export function get_polyline_length(points: Pt3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
    total += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return total;
}
