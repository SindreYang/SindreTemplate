"use client";

import { admin_api as api } from "../lib/admin-client";

type AdminTopbarProps = { section: string; dashboard?: boolean };

export function AdminTopbar({ section, dashboard = false }: AdminTopbarProps) {
  async function logout() {
    try { await api.post("/api/admin/logout"); }
    finally { window.location.assign("/admin/login"); }
  }

  return <header className="admin-topbar">
    <a className="admin-brand" href={dashboard ? "/" : "/admin"}>S<span>.</span> SindreJS <small>{section}</small></a>
    <div className="admin-topbar-meta">
      {dashboard && <><span className="admin-live-dot" /> 本地工作台 <a href="/">返回官网</a></>}
      {!dashboard && <a href="/admin">返回工作台</a>}
      <button className="admin-logout" onClick={() => void logout()}>退出登录</button>
    </div>
  </header>;
}
