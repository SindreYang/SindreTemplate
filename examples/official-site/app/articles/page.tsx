import { load } from "sindrejs/general";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const dynamic = "force-dynamic";
type Article = { id: string; title: string; slug: string; excerpt: string; content: string; status: "draft" | "published"; updatedAt: string };

async function publishedArticles() {
  return load<Article[]>(join(tmpdir(), "sindrejs-official-site-articles.json")).catch(() => []).then((items) => items.filter((item) => item.status === "published"));
}

export default async function ArticlesPage() {
  const items = await publishedArticles();
  return <main className="public-articles"><header className="public-articles-header"><a className="admin-brand" href="/">S<span>.</span> SindreJS <small>ARTICLES</small></a><a href="/">返回官网</a></header><section className="public-articles-inner"><span className="admin-kicker">SINDREJS NOTES</span><h1>文章</h1><p>从真实项目中整理模块设计、工程实践与使用经验。</p>{items.length ? <div className="article-card-grid">{items.map((item) => <a className="article-card" href={`/articles/${item.slug}`} key={item.id}><span>{new Date(item.updatedAt).toLocaleDateString("zh-CN")}</span><h2>{item.title}</h2><p>{item.excerpt}</p><strong>阅读文章 →</strong></a>)}</div> : <div className="article-empty">还没有发布文章，登录后台后将草稿状态改为“已发布”。</div>}</section></main>;
}
