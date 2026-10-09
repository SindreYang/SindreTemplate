"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Redo2, RotateCcw, Save, Trash2, Undo2, X } from "lucide-react";
import { create_history, HttpError, save_file_with_picker } from "sindrejs/general";
import { save as save3d } from "sindrejs/general/3d";
import { admin_api as api, admin_error_message } from "../../lib/admin-client";
import { dispose_object, get_catmull_rom_points, get_path_cache, get_polyline_length, get_surface_path, load_model, set_camera_to_object } from "sindrejs/utils3d";
// The example installs three at runtime; SindreJS keeps it an optional peer.
import * as THREE from "three";
import { AdminTopbar } from "../../components/admin-topbar";

type Point = [number, number, number];
type Scene = { id: string; name: string; points: Point[]; updatedAt: string };
const initialPoints: Point[] = [[-1.8, 0, -1], [-.7, .8, 0], [.4, -.2, 1], [1.8, .7, .2]];
const MAX_COORDINATE = 1_000_000;
const MAX_MODEL_BYTES = 100 * 1024 * 1024;

export default function ThreeWorkspacePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelCanvasRef = useRef<HTMLCanvasElement>(null); const modelRef = useRef<any>(null);
  const dragRef = useRef<{ index: number; pointerId: number; startX: number; startY: number; start: Point[]; started: boolean } | null>(null);
  const historyRef = useRef<ReturnType<typeof create_history<Point[]>> | null>(null);
  if (!historyRef.current) historyRef.current = create_history(initialPoints, { limit: 100, equals: pointsEqual });
  const [, refreshHistory] = useState(0);
  const [sceneId, setSceneId] = useState("scene-main"); const [sceneUpdatedAt, setSceneUpdatedAt] = useState(""); const [sceneName, setSceneName] = useState("主路径演示"); const [savedSceneName, setSavedSceneName] = useState("主路径演示"); const [savedPoints, setSavedPoints] = useState<Point[]>(initialPoints); const [selected, setSelected] = useState(0); const [length, setLength] = useState(0); const [modelInfo, setModelInfo] = useState("未导入模型"); const [modelFile, setModelFile] = useState(""); const [modelBusy, setModelBusy] = useState(false); const [sceneSaving, setSceneSaving] = useState(false); const [reloadNeeded, setReloadNeeded] = useState(false); const [modelRevision, setModelRevision] = useState(0); const [notice, setNotice] = useState("正在加载场景…");
  const history = historyRef.current;
  const points = history.get();
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const dirty = sceneName !== savedSceneName || JSON.stringify(points) !== JSON.stringify(savedPoints);
  useEffect(() => { setLength(get_polyline_length(get_catmull_rom_points(points, 96))); }, [points]);
  async function reloadScene() { setNotice("正在重新加载场景…"); try { const { scene } = await api.get<{ scene: Scene }>("/api/admin/scenes"); setSceneId(scene.id); setSceneUpdatedAt(scene.updatedAt); setSceneName(scene.name); setSavedSceneName(scene.name); history.reset(clonePoints(scene.points)); refreshHistory((value) => value + 1); setSavedPoints(clonePoints(scene.points)); setReloadNeeded(false); setNotice(`已加载最新版本 ${scene.name}`); } catch (error) { setNotice(admin_error_message(error, "读取场景")); } }
  useEffect(() => { void reloadScene(); }, []);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (!dirty) return; event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if (event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [history]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const surfaceMesh = create_demo_mesh(); const surfacePath = get_surface_path([[-2, 0, -1.5], [2, 0, 1.5]], false, get_path_cache(), () => surfaceMesh); const context = canvas.getContext("2d"); if (!context) return;
    let frame = 0; let rotation = 0; const resize = () => { const rect = canvas.getBoundingClientRect(); const ratio = Math.min(window.devicePixelRatio, 2); canvas.width = rect.width * ratio; canvas.height = rect.height * ratio; context.setTransform(ratio, 0, 0, ratio, 0, 0); }; resize(); window.addEventListener("resize", resize);
    const project = (point: Point) => { const [x, y, z] = point; const c = Math.cos(rotation), s = Math.sin(rotation); const rx = x * c - z * s; const rz = x * s + z * c; const scale = 105 / (5.4 - rz); return [canvas.clientWidth / 2 + rx * scale, canvas.clientHeight / 2 - y * scale] as const; };
    const selectPoint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      let hit = -1, distance = 18;
      pointsRef.current.forEach((point, index) => { const [px, py] = project(point); const next = Math.hypot(px - x, py - y); if (next <= distance) { hit = index; distance = next; } });
      if (hit >= 0) {
        setSelected(hit);
        dragRef.current = { index: hit, pointerId: event.pointerId, startX: x, startY: y, start: clonePoints(history.get()), started: false };
        canvas.setPointerCapture(event.pointerId);
      }
    };
    const movePoint = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const point = drag.start[drag.index]!;
      const dx = event.clientX - canvas.getBoundingClientRect().left - drag.startX;
      const dy = event.clientY - canvas.getBoundingClientRect().top - drag.startY;
      const c = Math.cos(rotation), s = Math.sin(rotation);
      const rz = point[0] * s + point[2] * c;
      const scale = 105 / Math.max(1, 5.4 - rz);
      const next = drag.start.map((item, index) => index === drag.index ? [bound(point[0] + dx / scale), bound(point[1] - dy / scale), point[2]] as Point : item);
      if (!drag.started) { history.commit(clonePoints(next)); drag.started = true; }
      else history.replace(clonePoints(next));
      refreshHistory((value) => value + 1);
    };
    const endPoint = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener("pointerdown", selectPoint);
    canvas.addEventListener("pointermove", movePoint);
    canvas.addEventListener("pointerup", endPoint);
    canvas.addEventListener("pointercancel", endPoint);
    const draw = () => { const currentPoints = pointsRef.current; const sampled = get_catmull_rom_points(currentPoints, 96); const currentSelected = selectedRef.current; const width = canvas.clientWidth, height = canvas.clientHeight; context.clearRect(0, 0, width, height); context.fillStyle = "#101b35"; context.fillRect(0, 0, width, height); context.strokeStyle = "#34456d"; context.lineWidth = 1; for (let x = -4; x <= 4; x += .5) { const a = project([x, -.65, -2]), b = project([x, -.65, 2]); context.beginPath(); context.moveTo(...a); context.lineTo(...b); context.stroke(); } for (let z = -2; z <= 2; z += .5) { const a = project([-4, -.65, z]), b = project([4, -.65, z]); context.beginPath(); context.moveTo(...a); context.lineTo(...b); context.stroke(); } context.strokeStyle = "#9dc0ff"; context.lineWidth = 3; context.beginPath(); sampled.forEach((point, index) => { const projected = project(point); if (index === 0) context.moveTo(...projected); else context.lineTo(...projected); }); context.stroke(); context.strokeStyle = "#ff8f70"; context.lineWidth = 2; context.beginPath(); surfacePath.forEach((point, index) => { const projected = project(point); if (index === 0) context.moveTo(...projected); else context.lineTo(...projected); }); context.stroke(); currentPoints.forEach((point, index) => { const [x, y] = project(point); context.fillStyle = index === currentSelected ? "#ffffff" : "#ffd166"; context.beginPath(); context.arc(x, y, index === currentSelected ? 8 : 5, 0, Math.PI * 2); context.fill(); }); const [mx, my] = project([0, 0, 0]); context.fillStyle = "#3f7cff"; context.beginPath(); context.arc(mx, my, 25, 0, Math.PI * 2); context.fill(); context.fillStyle = "#bcd1ff"; context.font = "12px sans-serif"; context.fillText("SindreJS 3D Path", 18, 28); rotation += .006; frame = requestAnimationFrame(draw); }; draw();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); canvas.removeEventListener("pointerdown", selectPoint); canvas.removeEventListener("pointermove", movePoint); canvas.removeEventListener("pointerup", endPoint); canvas.removeEventListener("pointercancel", endPoint); };
  }, []);
  useEffect(() => {
    const canvas = modelCanvasRef.current; const object = modelRef.current; if (!canvas) return; if (!object) { canvas.width = canvas.width; return; }
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const scene = new THREE.Scene(); scene.background = new THREE.Color("#101b35"); scene.add(new THREE.HemisphereLight(0xffffff, 0x34456d, 2)); const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(4, 6, 5); scene.add(light); scene.add(object);
      const camera = new THREE.PerspectiveCamera(45, 1, .01, 1000); camera.position.set(3, 2, 5); const resize = () => { const rect = canvas.getBoundingClientRect(); renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / Math.max(rect.height, 1); camera.updateProjectionMatrix(); }; resize(); window.addEventListener("resize", resize); set_camera_to_object(camera, object, 1.35);
      let frame = 0; const animate = () => { object.rotation.y += .004; renderer.render(scene, camera); frame = requestAnimationFrame(animate); }; animate();
      return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); scene.remove(object); renderer.dispose(); };
    } catch (error) { setNotice(`模型预览失败：${error instanceof Error ? error.message : "WebGL 不可用"}`); }
  }, [modelRevision]);
  useEffect(() => () => { if (modelRef.current) dispose_object(modelRef.current); }, []);
  function commitPoints(next: Point[]) { history.commit(clonePoints(next)); refreshHistory((value) => value + 1); }
  function updatePoint(axis: number, value: string) { const number = Number(value); if (!Number.isFinite(number)) return; commitPoints(points.map((point, index) => index === selected ? point.map((item, itemIndex) => itemIndex === axis ? bound(number) : item) as Point : point)); }
  function addPoint() { const last = points.at(-1) ?? [0, 0, 0]; commitPoints([...points, [last[0] + .5, last[1], last[2]]]); setSelected(points.length); }
  function removePoint() { if (points.length <= 2) return; commitPoints(points.filter((_, index) => index !== selected)); setSelected(Math.max(0, selected - 1)); }
  function undo() { if (history.can_undo()) { history.undo(); refreshHistory((value) => value + 1); setNotice("已撤销上一步编辑"); } }
  function redo() { if (history.can_redo()) { history.redo(); refreshHistory((value) => value + 1); setNotice("已恢复下一步编辑"); } }
  function resetPoints() { if (dirty && window.confirm("放弃未保存的场景修改并恢复到上次保存状态吗？")) { history.reset(clonePoints(savedPoints)); refreshHistory((value) => value + 1); setSceneName(savedSceneName); setNotice("已恢复上次保存的状态"); } }
  async function saveScene() { if (sceneSaving || !dirty) return; setSceneSaving(true); setNotice("保存中…"); try { const result = await api.post<{ scene: Scene }>("/api/admin/scenes", { id: sceneId, updatedAt: sceneUpdatedAt, name: sceneName, points }); setSceneId(result.scene.id); setSceneUpdatedAt(result.scene.updatedAt); setSavedSceneName(result.scene.name); setSavedPoints(result.scene.points); setReloadNeeded(false); setNotice(`已通过 general 保存 ${result.scene.name}`); } catch (error) { if (error instanceof HttpError && error.status === 409) { setReloadNeeded(true); setNotice("检测到场景版本冲突，请重新加载最新版本"); } else setNotice(admin_error_message(error, "保存场景")); } finally { setSceneSaving(false); } }
  function clearModel() { if (modelRef.current) dispose_object(modelRef.current); modelRef.current = null; setModelFile(""); setModelInfo("未导入模型"); setModelRevision((value) => value + 1); setNotice("已通过 utils3d 释放模型资源"); }
  async function exportModel() {
    if (!modelRef.current) return;
    try {
      await save_file_with_picker(modelRef.current, { suggestedName: `${modelFile.split(".")[0] || "sindrejs-model"}.glb`, types: [{ description: "GLB model", accept: { "model/gltf-binary": [".glb"] } }] }, save3d);
      setNotice("已通过 sindrejs/general/3d 导出 GLB 模型");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") { setNotice("已取消模型导出"); return; }
      if (error instanceof Error && error.message.includes("File System Access")) { setNotice("当前浏览器不支持文件保存选择器，请使用 Chromium 浏览器"); return; }
      setNotice(`模型导出失败：${error instanceof Error ? error.message : "无法写入文件"}`);
    }
  }
  async function importModel(file: File) { if (file.size > MAX_MODEL_BYTES) { setModelFile(""); setModelInfo("模型文件过大"); setNotice("模型导入失败：文件不能超过 100 MB"); return; } setModelBusy(true); setModelFile(file.name); setNotice(`正在解析 ${file.name}…`); try { const loaded = await load_model(await file.arrayBuffer(), file.name); if (modelRef.current) dispose_object(modelRef.current); modelRef.current = loaded.object; setModelInfo(`${file.name} · ${loaded.format.toUpperCase()} · ${loaded.meshes} 个网格 · ${loaded.vertices} 个顶点`); setModelRevision((value) => value + 1); setNotice(`已通过 utils3d 解析并载入 ${file.name}`); } catch (error) { setModelFile(""); setModelInfo("模型解析失败"); setNotice(`模型导入失败：${error instanceof Error ? error.message : "格式不受支持"}`); } finally { setModelBusy(false); } }
  const activePoint = points[selected] ?? points[0];
  return <main className="admin-shell"><AdminTopbar section="3D WORKSPACE" /><div className="three-workspace"><div className="editor-toolbar"><div><span className="admin-kicker">UTILS3D PLAYGROUND</span><h1>3D 工作台</h1><p>编辑控制点，导入模型，实时观察样条路径和网格表面最短路径。</p></div><div className="editor-actions"><button className="admin-secondary" onClick={undo} disabled={!history.can_undo()}><Undo2 size={15} />撤销</button><button className="admin-secondary" onClick={redo} disabled={!history.can_redo()}><Redo2 size={15} />重做</button><button className="admin-secondary" onClick={resetPoints} disabled={!dirty || sceneSaving}><RotateCcw size={15} />重置</button><button className="admin-primary" onClick={() => void saveScene()} disabled={!dirty || sceneSaving}><Save size={15} />{sceneSaving ? "保存中…" : "保存场景"}</button></div></div><div className="admin-notice" role="status">{notice}{dirty && <span className="editor-dirty"> · 有未保存修改</span>}{reloadNeeded && <button className="draft-clear" onClick={() => void reloadScene()} disabled={sceneSaving}>重新加载最新版本</button>}</div><div className="three-grid"><section className="three-canvas-card"><canvas ref={canvasRef} aria-label="SindreJS 3D 场景" /><div className="three-legend"><span><i className="legend-blue" />样条路径</span><span><i className="legend-yellow" />控制点</span><span><i className="legend-surface" />表面最短路径</span></div><div className="model-import"><div className="model-import-row"><label>导入模型<input type="file" accept=".glb,.gltf,.ply,.stl,.obj" disabled={modelBusy} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void importModel(file); }} /></label><div className="model-actions">{modelFile && <button className="icon-danger" onClick={clearModel} disabled={modelBusy} aria-label="清除模型"><X size={15} /></button>}{modelFile && <button className="admin-secondary" onClick={() => void exportModel()} disabled={modelBusy}>导出 GLB</button>}</div></div><small>{modelBusy ? "正在解析模型…" : modelInfo}</small></div><canvas ref={modelCanvasRef} className="model-canvas" aria-label="导入模型预览" /></section><aside className="three-inspector"><span className="admin-kicker">SCENE INSPECTOR</span><label className="scene-name-label">场景名称<input maxLength={100} value={sceneName} onChange={(event) => setSceneName(event.target.value)} /></label><div className="point-toolbar"><h2>控制点</h2><button className="admin-secondary" onClick={addPoint}><Plus size={14} />添加</button></div><div className="point-list">{points.map((point, index) => <button className={`point-item ${index === selected ? "selected" : ""}`} key={`${index}-${point.join("-")}`} onClick={() => setSelected(index)}><strong>P{index + 1}</strong><span>{point.map((value) => value.toFixed(2)).join(" / ")}</span></button>)}</div><div className="point-editor"><div className="point-editor-head"><strong>P{selected + 1} 坐标</strong><button className="icon-danger" onClick={removePoint} disabled={points.length <= 2} aria-label="删除控制点"><Trash2 size={15} /></button></div>{activePoint.map((value, axis) => <label key={axis}>{["X", "Y", "Z"][axis]}<input type="number" min={-1000000} max={1000000} step="0.1" value={value} onChange={(event) => updatePoint(axis, event.target.value)} /></label>)}</div><div className="three-stat"><strong>{points.length}</strong><span>控制点</span></div><div className="three-stat"><strong>{length.toFixed(2)}</strong><span>样条长度</span></div></aside></div></div></main>;
}

function pointsEqual(a: Point[], b: Point[]) { return JSON.stringify(a) === JSON.stringify(b); }
function bound(value: number) { return Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, value)); }
function clonePoints(points: Point[]): Point[] { return points.map((point) => [...point] as Point); }

function create_demo_mesh() {
  const size = 5; const verts = new Float32Array(size * size * 3); const faces: number[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const index = (y * size + x) * 3; verts[index] = x - 2; verts[index + 1] = 0.15 * Math.sin(x * 1.4) * Math.cos(y * 1.2); verts[index + 2] = y - 2; }
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const a = y * size + x; faces.push(a, a + 1, a + size + 1, a + size); }
  return { faces: new Uint32Array(faces), verts, nbFaces: faces.length / 4, nbVerts: verts.length / 3 };
}
