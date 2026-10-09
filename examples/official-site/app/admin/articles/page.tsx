"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, ExternalLink, FileText, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { MarkdownView } from "sindrejs/utilsui/markdown/lite";
import { debounce, HttpError, to_slug } from "sindrejs/general";
import { admin_api as api, admin_error_message } from "../../lib/admin-client";
import type { Article } from "../../api/admin/articles/route";
import { AdminTopbar } from "../../components/admin-topbar";

const blank: Article = { id: "", title: "", slug: "", excerpt: "", content: "# 新文章\n\n开始写作…", status: "draft", updatedAt: "" };
const draftKey = (id: string) => `sindrejs:article-draft:${id || "new"}`;

export default function ArticlesPage() {
  const [items, setItems] = useState<Article[]>([]); const [article, setArticle] = useState<Article>(blank); const [savedArticle, setSavedArticle] = useState<Article>(blank); const [query, setQuery] = useState(""); const [statusFilter, setStatusFilter] = useState<"all" | Article["status"]>("all"); const [preview, setPreview] = useState(false); const [notice, setNotice] = useState("正在加载文章…"); const [localDraft, setLocalDraft] = useState(false); const [saving, setSaving] = useState(false); const [deleting, setDeleting] = useState(false); const [refreshing, setRefreshing] = useState(false); const [conflict, setConflict] = useState(false);
  const saveLocalDraft = useRef(debounce((key: string, value: string) => window.localStorage.setItem(key, value), 700)).current;
  const dirty = JSON.stringify(article) !== JSON.stringify(savedArticle);
  const visibleItems = items.filter((item) => (statusFilter === "all" || item.status === statusFilter) && `${item.title} ${item.slug}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => { void refreshArticleList(true); }, []);
  useEffect(() => { if (dirty) { setLocalDraft(true); saveLocalDraft(draftKey(article.id), JSON.stringify(article)); } }, [article, dirty, saveLocalDraft]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (!dirty) return; event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  function update<K extends keyof Article>(key: K, value: Article[K]) { setArticle((current) => ({ ...current, [key]: value })); }
  function updateTitle(value: string) { setArticle((current) => ({ ...current, title: value, slug: current.slug ? current.slug : to_slug(value, "") })); }
  async function refreshArticleList(initial = false) {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const data = await api.get<{ items: Article[] }>("/api/admin/articles");
      setItems(data.items);
      if (initial || !dirty) {
        const serverArticle = data.items.find((item) => item.id === article.id) ?? data.items[0] ?? blank;
        const recovered = recoverDraft(serverArticle);
        setArticle(recovered); setSavedArticle(serverArticle); setLocalDraft(recovered !== serverArticle);
      }
      setConflict(false); setNotice(`${data.items.length} 篇文章，已更新列表`);
    } catch (error) {
      setNotice(admin_error_message(error, "读取文章"));
    } finally { setRefreshing(false); }
  }
  function recoverDraft(next: Article) {
    const stored = window.localStorage.getItem(draftKey(next.id));
    if (!stored) return next;
    try {
      const candidate = JSON.parse(stored) as Article;
      if (candidate.id !== next.id || !candidate.content || JSON.stringify(candidate) === JSON.stringify(next)) return next;
      return window.confirm(`发现《${next.title || "新文章"}》的本地未提交草稿，是否恢复？`) ? candidate : next;
    } catch { window.localStorage.removeItem(draftKey(next.id)); return next; }
  }
  function selectArticle(next: Article) { if (dirty && !window.confirm("当前文章有未保存修改，确定切换吗？")) return; const recovered = recoverDraft(next); setArticle(recovered); setSavedArticle(next); setLocalDraft(recovered !== next); setConflict(false); }
  function clearLocalDraft() { saveLocalDraft.cancel(); window.localStorage.removeItem(draftKey(article.id)); setLocalDraft(false); setNotice("本地草稿已清除"); }
  async function reloadArticle() { setNotice("正在重新加载当前文章…"); try { const data = await api.get<{ items: Article[] }>("/api/admin/articles"); setItems(data.items); const latest = data.items.find((item) => item.id === article.id); if (latest) { setArticle(latest); setSavedArticle(latest); setLocalDraft(Boolean(window.localStorage.getItem(draftKey(latest.id)))); } else { setArticle(blank); setSavedArticle(blank); setLocalDraft(false); } setConflict(false); setNotice("已加载服务器最新版本"); } catch (error) { setNotice(admin_error_message(error, "重新加载")); } }
  async function saveArticle() { if (saving || !dirty) return; setSaving(true); setConflict(false); setNotice("保存中…"); try { const result = await api.post<{ item: Article }>("/api/admin/articles", article); saveLocalDraft.cancel(); setItems((current) => [result.item, ...current.filter((item) => item.id !== result.item.id)]); setArticle(result.item); setSavedArticle(result.item); window.localStorage.removeItem(draftKey(article.id)); setLocalDraft(false); setNotice("已通过 general 保存文章"); } catch (error) { if (error instanceof HttpError && error.status === 409) setConflict(true); setNotice(admin_error_message(error, "保存")); } finally { setSaving(false); } }
  async function deleteArticle() { if (deleting || !article.id || !window.confirm(`确定删除《${article.title}》吗？`)) return; setDeleting(true); setConflict(false); setNotice("删除中…"); try { await api.delete(`/api/admin/articles`, { data: { id: article.id, updatedAt: article.updatedAt } }); saveLocalDraft.cancel(); window.localStorage.removeItem(draftKey(article.id)); const next = items.filter((item) => item.id !== article.id); const selected = next[0] ?? blank; setItems(next); setArticle(selected); setSavedArticle(selected); setLocalDraft(false); setNotice("文章已删除"); } catch (error) { if (error instanceof HttpError && error.status === 409) setConflict(true); setNotice(admin_error_message(error, "删除")); } finally { setDeleting(false); } }
  return <main className="admin-shell"><AdminTopbar section="ARTICLE EDITOR" /><div className="editor-layout">
    <aside className="editor-list"><a className="editor-back" href="/admin"><ArrowLeft size={15} />后台首页</a><div className="editor-list-title"><FileText size={16} />文章 <small>{visibleItems.length}/{items.length}</small></div><button className="editor-new" onClick={() => selectArticle(blank)}>＋ 新建文章</button><div className="editor-filters"><label><Search size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或 slug" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">全部状态</option><option value="draft">草稿</option><option value="published">已发布</option></select></div>{visibleItems.map((item) => <button key={item.id} className={`editor-item ${item.id === article.id ? "selected" : ""}`} onClick={() => selectArticle(item)}><strong>{item.title}</strong><small>{item.status === "published" ? "已发布" : "草稿"} · {item.slug}</small></button>)}{visibleItems.length === 0 && <p className="editor-empty">没有匹配文章</p>}</aside>
    <section className="editor-main"><div className="editor-toolbar"><div><span className="admin-kicker">ARTICLE WORKSPACE</span><h1>文章编辑</h1></div><div className="editor-actions"><button className="admin-secondary" onClick={() => void refreshArticleList()} disabled={refreshing || saving || deleting}><RefreshCw size={15} />{refreshing ? "刷新中…" : "刷新"}</button><button className="admin-secondary" onClick={() => setPreview((value) => !value)}><Eye size={15} />{preview ? "编辑" : "预览"}</button>{!dirty && article.status === "published" && article.slug && <a className="admin-secondary" href={`/articles/${article.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={15} />查看文章</a>}<button className="admin-primary" onClick={() => void saveArticle()} disabled={!dirty || saving || deleting}><Save size={15} />{saving ? "保存中…" : "保存"}</button><button className="icon-danger editor-delete" onClick={() => void deleteArticle()} disabled={!article.id || saving || deleting} aria-label="删除文章"><Trash2 size={15} /></button></div></div><div className="admin-notice" role="status">{notice}{dirty && <span className="editor-dirty"> · 有未保存修改</span>}{localDraft && <button className="draft-clear" onClick={clearLocalDraft}>清除本地草稿</button>}{conflict && <button className="draft-clear" onClick={() => void reloadArticle()}>加载服务器版本</button>}</div>{preview ? <article className="article-preview"><MarkdownView source={article.content} /></article> : <div className="article-form"><label>标题<input maxLength={200} value={article.title} onChange={(event) => updateTitle(event.target.value)} /></label><label>Slug<input maxLength={200} value={article.slug} onChange={(event) => update("slug", event.target.value)} /></label><label>摘要<textarea maxLength={500} value={article.excerpt} onChange={(event) => update("excerpt", event.target.value)} rows={3} /></label><label>Markdown 正文<textarea maxLength={200000} className="article-content" value={article.content} onChange={(event) => update("content", event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void saveArticle(); } }} /></label><label className="editor-status">状态<select value={article.status} onChange={(event) => update("status", event.target.value as Article["status"])}><option value="draft">草稿</option><option value="published">已发布</option></select></label></div>}</section>
  </div></main>;
}
