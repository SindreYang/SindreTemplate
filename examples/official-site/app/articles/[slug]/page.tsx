import { load } from "sindrejs/general";
import { MarkdownView } from "sindrejs/utilsui/markdown/lite";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const dynamic = "force-dynamic";
type Article = { id: string; title: string; slug: string; excerpt: string; content: string; status: "draft" | "published"; updatedAt: string };

async function getPublishedArticle(slug: string) {
  const items = await load<Article[]>(join(tmpdir(), "sindrejs-official-site-articles.json")).catch(() => []);
  return items.find((item) => item.slug === slug && item.status === "published");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  return article ? { title: `${article.title} — SindreJS`, description: article.excerpt || article.title } : { title: "文章不存在 — SindreJS" };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) notFound();
  return <main className="public-article"><header className="public-articles-header"><a className="admin-brand" href="/">S<span>.</span> SindreJS <small>ARTICLE</small></a><a href="/articles">全部文章</a></header><article className="public-article-body"><a className="article-back" href="/articles">← 返回文章列表</a><span className="admin-kicker">{new Date(article.updatedAt).toLocaleDateString("zh-CN")}</span><h1>{article.title}</h1><p className="article-lead">{article.excerpt}</p><MarkdownView source={article.content} className="public-markdown" /></article></main>;
}
