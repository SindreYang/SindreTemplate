"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, ArrowRight, CheckCircle2, CircleDot, Database, Gauge, Layers3, RefreshCw, Server, Terminal, XCircle } from "lucide-react";
import { AdaptivePanel } from "sindrejs/utilsui/panel";
import { AsyncStatus, PageHeader } from "sindrejs/utilsui/react";
import { PaginationControls, usePageLoader, type PageResult } from "sindrejs/utilsui/list";
import { AdminTopbar } from "./admin-topbar";
import { admin_api as api, admin_error_message } from "../lib/admin-client";

type ModuleInfo = { name: string; entry: string; runtime: string; status: "ready" | "optional"; usage: string; detail?: string; install?: string };
type Overview = { metrics: { modules: number; routes: number; queued: number; successRate: number }; modules: ModuleInfo[]; generatedAt: string };
type Run = { id: string; action: string; status: "success" | "failed"; duration: number; createdAt: string; detail: string };
type RunPage = PageResult<Run>;


export function AdminDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notice, setNotice] = useState("后台使用 SindreJS general + utilsui 驱动");
  const [checking, setChecking] = useState(false);
  const [source, setSource] = useState('{"module":"utils3d","ready":true}');
  const runs = usePageLoader<Run>({
    pageSize: 5,
    loadPage: (page, pageSize, signal) => api.get<RunPage>("/api/admin/runs", { params: { page, pageSize }, signal }),
  });

  async function refreshOverview() {
    setOverviewError(null);
    try { setOverview(await api.get<Overview>("/api/admin/overview")); }
    catch (error) { setOverviewError(admin_error_message(error, "读取后台概览")); }
  }
  useEffect(() => { void refreshOverview(); }, []);

  async function runCheck() {
    if (checking) return;
    setChecking(true);
    setNotice("正在运行 general / safe_parse_json…");
    try {
      const response = await api.post<{ success: boolean; run: Run; error?: string }>("/api/admin/runs", { source });
      setNotice(response.success ? `已完成 ${response.run.id}，耗时 ${response.run.duration} ms` : `校验失败：${response.error}`);
      runs.reset();
    } catch (error) {
      setNotice(admin_error_message(error, "校验"));
      runs.reset();
    } finally {
      setChecking(false);
    }
  }

  const readyModules = useMemo(() => overview?.modules.filter((item) => item.status === "ready").length ?? 0, [overview]);

  return <div className="admin-shell">
    <AdminTopbar section="ADMIN" dashboard />
    <div className="admin-layout">
      <AdaptivePanel title="工作台导航" open={panelOpen} onOpenChange={setPanelOpen} triggerLabel="打开导航" className="admin-sidebar">
        <nav className="admin-nav" aria-label="后台导航">
          <a className="active" href="#overview"><Activity size={16} />总览</a>
          <a href="#modules"><Layers3 size={16} />模块健康</a>
          <a href="#runs"><Terminal size={16} />运行记录</a>
          <a href="/admin/settings"><Database size={16} />数据设置</a>
          <a href="/admin/articles"><Database size={16} />文章编辑</a>
          <a href="/admin/3d"><Layers3 size={16} />3D 工作台</a>
        </nav>
        <div className="admin-sidebar-note"><span>库版本</span><strong>0.1.x / local</strong><small>当前为演示数据，适合继续接入数据库。</small></div>
      </AdaptivePanel>
      <main className="admin-main" id="overview">
        <PageHeader title="SindreJS 工作台" description="用库自身的请求、校验、日志与 UI 组件管理模块状态和运行记录。" actions={<button className="admin-refresh" onClick={() => { void refreshOverview(); runs.retry(); }}><RefreshCw size={15} />刷新数据</button>} />
        <AsyncStatus busy={!overview && !overviewError} error={overviewError} loadingLabel="正在读取后台概览…">
          {overview && <>
            <div className="admin-metrics">
              <Metric icon={<Layers3 />} label="模块总数" value={overview.metrics.modules} note={`${readyModules} 个核心模块已就绪`} />
              <Metric icon={<Server />} label="API 路由" value={overview.metrics.routes} note="后台管理接口" />
              <Metric icon={<Gauge />} label="队列任务" value={overview.metrics.queued} note="当前无阻塞任务" />
              <Metric icon={<CheckCircle2 />} label="入口可用率" value={`${overview.metrics.successRate}%`} note="按服务端实际探测" />
            </div>
            <section className="admin-content-grid">
              <div className="admin-section" id="modules">
                <div className="admin-section-head"><div><span className="admin-kicker">MODULE HEALTH</span><h2>模块健康</h2></div><span className="admin-section-caption">{new Date(overview.generatedAt).toLocaleTimeString("zh-CN")}</span></div>
                <div className="module-list">{overview.modules.map((item) => <div className="module-row" key={item.name}><span className={`module-icon ${item.status}`}><Layers3 size={17} /></span><div><strong>{item.name}</strong><small>{item.entry} · {item.usage}{item.detail ? ` · ${item.detail}` : ""}</small>{item.install && <code className="module-install">{item.install}</code>}</div><span className={`module-status ${item.status}`}><CircleDot size={12} />{item.status === "ready" ? "READY" : "OPTIONAL"}</span></div>)}</div>
              </div>
              <div className="admin-section admin-run-card" id="settings">
                <div className="admin-section-head"><div><span className="admin-kicker">LIVE CHECK</span><h2>运行一次检查</h2></div><Terminal size={18} /></div>
                <p>请求会经过 Next.js API，再由 SindreJS `safe_parse_json` 校验并写入结构化日志。</p>
                <textarea value={source} onChange={(event) => setSource(event.target.value)} aria-label="后台检查 JSON" spellCheck={false} />
                <button className="admin-primary" onClick={() => { void runCheck(); }} disabled={checking}>{checking ? "检查中…" : "执行检查"} <ArrowRight size={15} /></button>
                <div className="admin-notice" role="status">{notice}</div>
              </div>
            </section>
            <section className="admin-section runs-section" id="runs">
              <div className="admin-section-head"><div><span className="admin-kicker">RECENT RUNS</span><h2>运行记录</h2></div><span className="admin-section-caption">由 `usePageLoader` 分页加载</span></div>
              <div className="runs-table" role="table"><div className="runs-table-head"><span>ID / 动作</span><span>详情</span><span>耗时</span><span>状态</span></div>{runs.items.map((run) => <div className="runs-table-row" key={run.id}><span><strong>{run.id}</strong><small>{run.action}</small></span><span>{run.detail}</span><span>{run.duration} ms</span><span className={run.status === "success" ? "run-success" : "run-failed"}>{run.status === "success" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}{run.status}</span></div>)}</div>
              <PaginationControls page={runs.page} hasMore={runs.hasMore} loading={runs.loading} total={runs.total} pageSize={5} onPageChange={runs.set_page} className="admin-pagination" />
            </section>
          </>}
        </AsyncStatus>
      </main>
    </div>
  </div>;
}

function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string | number; note: string }) {
  return <div className="admin-metric"><span className="metric-icon">{icon}</span><small>{label}</small><strong>{value}</strong><em>{note}</em></div>;
}
