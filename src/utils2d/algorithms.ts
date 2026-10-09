/** Canvas 2D annotation primitives; coordinates are image pixels. */
export interface Point { x: number; y: number }
export interface ViewTransform { scale: number; offsetX: number; offsetY: number }
export type Annotation =
  | { kind: "rect"; x: number; y: number; width: number; height: number }
  | { kind: "rotatedRect"; cx: number; cy: number; width: number; height: number; angle: number }
  | { kind: "polygon" | "polyline"; points: readonly Point[] }
  | { kind: "keypoint"; x: number; y: number };

function validView(view: ViewTransform): void {
  if (!Number.isFinite(view.scale) || view.scale <= 0 ||
      !Number.isFinite(view.offsetX) || !Number.isFinite(view.offsetY)) {
    throw new RangeError("view requires a positive scale and finite offsets");
  }
}

export function get_canvas_point(point: Point, view: ViewTransform): Point {
  validView(view);
  return { x: point.x * view.scale + view.offsetX, y: point.y * view.scale + view.offsetY };
}

export function get_image_point(point: Point, view: ViewTransform): Point {
  validView(view);
  return { x: (point.x - view.offsetX) / view.scale, y: (point.y - view.offsetY) / view.scale };
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = dx * dx + dy * dy === 0 ? 0 : Math.max(0, Math.min(1,
    ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

export function get_annotation_hit(annotation: Annotation, point: Point, tolerance = 5): boolean {
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new RangeError("invalid tolerance");
  if (annotation.kind === "rect") {
    const { x, y, width, height } = annotation;
    return point.x >= Math.min(x, x + width) - tolerance &&
      point.x <= Math.max(x, x + width) + tolerance &&
      point.y >= Math.min(y, y + height) - tolerance &&
      point.y <= Math.max(y, y + height) + tolerance;
  }
  if (annotation.kind === "rotatedRect") {
    const { cx, cy, width, height, angle } = annotation;
    const dx = point.x - cx, dy = point.y - cy;
    const x = dx * Math.cos(angle) + dy * Math.sin(angle);
    const y = -dx * Math.sin(angle) + dy * Math.cos(angle);
    return Math.abs(x) <= Math.abs(width) / 2 + tolerance &&
      Math.abs(y) <= Math.abs(height) / 2 + tolerance;
  }
  if (annotation.kind === "keypoint") {
    return Math.hypot(point.x - annotation.x, point.y - annotation.y) <= tolerance;
  }
  const vertices = annotation.points;
  if (vertices.length < 2) return false;
  for (let i = 1; i < vertices.length; i++) {
    if (distanceToSegment(point, vertices[i - 1], vertices[i]) <= tolerance) return true;
  }
  if (annotation.kind === "polyline" || vertices.length < 3) return false;
  if (distanceToSegment(point, vertices[vertices.length - 1], vertices[0]) <= tolerance) return true;
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i], b = vertices[j];
    if ((a.y > point.y) !== (b.y > point.y) &&
        point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export interface DrawOptions { stroke?: string; fill?: string; lineWidth?: number; keypointRadius?: number }

/** Draw with caller-controlled image-to-canvas transform; preserves context state. */
export function show_annotation(
  ctx: CanvasRenderingContext2D, annotation: Annotation,
  view: ViewTransform, options: DrawOptions = {},
): void {
  validView(view);
  ctx.save();
  try {
    ctx.translate(view.offsetX, view.offsetY);
    ctx.scale(view.scale, view.scale);
    ctx.strokeStyle = options.stroke ?? "#ff4258";
    ctx.fillStyle = options.fill ?? "rgba(255,66,88,0.16)";
    ctx.lineWidth = (options.lineWidth ?? 2) / view.scale;
    ctx.beginPath();
    if (annotation.kind === "rect") {
      ctx.rect(annotation.x, annotation.y, annotation.width, annotation.height);
    } else if (annotation.kind === "rotatedRect") {
      ctx.translate(annotation.cx, annotation.cy);
      ctx.rotate(annotation.angle);
      ctx.rect(-annotation.width / 2, -annotation.height / 2, annotation.width, annotation.height);
    } else if (annotation.kind === "keypoint") {
      ctx.arc(annotation.x, annotation.y, (options.keypointRadius ?? 5) / view.scale, 0, Math.PI * 2);
    } else if (annotation.points.length) {
      ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
      for (const p of annotation.points.slice(1)) ctx.lineTo(p.x, p.y);
      if (annotation.kind === "polygon") ctx.closePath();
    }
    if (annotation.kind !== "polyline") ctx.fill();
    ctx.stroke();
  } finally { ctx.restore(); }
}
