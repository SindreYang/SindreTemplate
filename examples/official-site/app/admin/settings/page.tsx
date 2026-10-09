"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Database, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { AdminTopbar } from "../../components/admin-topbar";
import { admin_api as api, admin_error_message } from "../../lib/admin-client";

type Settings = { environment: string; auth: { passwordConfigured: boolean; secretConfigured: boolean }; storage: { directory: string; files: { name: string; path: string; exists: boolean }[] } };
export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null); const [notice, setNotice] = useState("正在读取设置…");
  async function refresh() { setNotice("正在读取设置…"); try { setSettings(await api.get<Settings>("/api/admin/settings")); setNotice("设置状态已更新"); } catch (error) { setNotice(admin_error_message(error, "读取设置")); } }
  useEffect(() => { void refresh(); }, []);
  return <main className="admin-shell"><AdminTopbar section="SETTINGS" /><div className="settings-main"><div className="settings-topline"><div><a className="editor-back" href="/admin"><ArrowLeft size={15} />后台首页</a><span className="admin-kicker">WORKSPACE SETTINGS</span><h1>数据设置</h1><p>查看后台认证配置和 SindreJS 持久化文件状态。</p></div><button className="admin-secondary" onClick={() => void refresh()}><RefreshCw size={15} />刷新</button></div><div className="admin-notice" role="status">{notice}</div>{settings && <div className="settings-grid"><section className="settings-card"><KeyRound size={19} /><h2>登录配置</h2><p>只显示是否配置，不展示密码或密钥内容。</p><SettingRow label="运行环境" value={settings.environment} /><SettingRow label="管理员密码" value={settings.auth.passwordConfigured ? "已配置" : "未配置"} good={settings.auth.passwordConfigured} /><SettingRow label="签名密钥" value={settings.auth.secretConfigured ? "已配置" : "开发环境可由密码派生"} good={settings.auth.secretConfigured} /></section><section className="settings-card"><Database size={19} /><h2>本地数据</h2><p className="settings-path">目录：{settings.storage.directory}</p>{settings.storage.files.map((file) => <SettingRow key={file.name} label={file.name} value={file.exists ? "已创建" : "尚未创建"} good={file.exists} />)}</section><section className="settings-card settings-health"><ShieldCheck size={19} /><h2>使用建议</h2><ul><li>生产环境必须设置 `SINDREJS_ADMIN_PASSWORD`。</li><li>建议单独设置 `SINDREJS_ADMIN_SECRET`。</li><li>示例数据位于系统临时目录，正式部署应接入数据库。</li></ul></section></div>}</div></main>;
}
function SettingRow({ label, value, good = false }: { label: string; value: string; good?: boolean }) { return <div className="setting-row"><span>{label}</span><strong className={good ? "setting-good" : ""}>{value}</strong></div>; }
