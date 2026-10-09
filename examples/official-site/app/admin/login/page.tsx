"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code === "invalid") setError("账号或密码不正确");
    if (code === "expired") setError("登录已过期，请重新登录");
    if (code === "config") setError("生产环境登录配置不完整");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(null);
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
      if (response.ok) { window.location.assign("/admin"); return; }
      setError((await response.json().catch(() => null) as { error?: string } | null)?.error ?? "登录失败");
    } catch {
      setError("无法连接后台，请确认服务仍在运行");
    } finally {
      setLoading(false);
    }
  }

  return <main className="admin-login-shell"><section className="admin-login-card">
    <div className="admin-login-mark"><LockKeyhole size={20} /></div><span className="admin-kicker">SINDREJS ADMIN</span>
    <h1>进入工作台</h1><p>登录后管理文章、3D 素材和模块运行记录。</p>
    <form action="/api/admin/login" method="post" onSubmit={submit} className="admin-login-form">
      <label>账号<input name="username" maxLength={128} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
      <label>密码<input name="password" maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>
      {error && <div className="admin-login-error" role="alert">{error}</div>}
      <button className="admin-primary" disabled={loading}>{loading ? "正在登录…" : "登录工作台"} <ArrowRight size={15} /></button>
    </form><small>{process.env.NODE_ENV === "development" ? "本地演示默认账号：admin / sindrejs-dev；" : "生产环境不会接受默认账号；"}部署时请设置 SINDREJS_ADMIN_PASSWORD。</small>
  </section></main>;
}
