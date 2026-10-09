import { load, save } from "sindrejs/general";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { admin_json, require_admin } from "../../../lib/admin-auth";
import { is_missing_file } from "../../../lib/storage-errors";

export const runtime = "nodejs";

export type Article = { id: string; title: string; slug: string; excerpt: string; content: string; status: "draft" | "published"; updatedAt: string };
const storePath = join(tmpdir(), "sindrejs-official-site-articles.json");
const seed: Article[] = [{ id: "article-001", title: "用 SindreJS 构建可观测的后台", slug: "sindrejs-admin", excerpt: "从模块健康到运行记录，把库本身变成产品基础设施。", status: "draft", updatedAt: new Date().toISOString(), content: "# 用 SindreJS 构建后台\n\n这个编辑器使用 `utilsui/markdown` 预览，保存时通过 `general` 写入本地数据。\n\n## 下一步\n\n接入真实数据库后，可以继续复用同一套 API。" }];
let writeQueue = Promise.resolve();

const slugPattern = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
const MAX_TITLE_LENGTH = 200;
const MAX_SLUG_LENGTH = 200;
const MAX_EXCERPT_LENGTH = 500;
const MAX_CONTENT_LENGTH = 200_000;

async function getArticles() {
  try {
    const items = await load<Article[]>(storePath);
    if (!Array.isArray(items)) throw new TypeError("文章存储必须是数组");
    return items;
  } catch (error) {
    if (!is_missing_file(error)) throw error;
    await save(seed, storePath);
    return seed.map((item) => ({ ...item }));
  }
}

function enqueue<T>(operation: () => Promise<T>) {
  const run = writeQueue.then(operation);
  writeQueue = run.then(() => undefined, () => undefined);
  return run;
}

export async function GET() {
  const unauthorized = await require_admin();
  if (unauthorized) return unauthorized;
  await writeQueue;
  return admin_json({ items: await getArticles() });
}

export async function POST(request: Request) {
  const unauthorized = await require_admin();
  if (unauthorized) return unauthorized;
  const body = await request.json().catch(() => null) as Partial<Article> | null;
  const input = body ?? {};
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const rawSlug = typeof input.slug === "string" ? input.slug.trim() : "";
  const excerpt = typeof input.excerpt === "string" ? input.excerpt.trim() : "";
  const content = typeof input.content === "string" ? input.content.trim() : "";
  if (!title || !rawSlug || !content) return admin_json({ error: "标题、slug 和正文不能为空" }, { status: 422 });
  const slug = rawSlug.toLowerCase().replace(/\s+/g, "-");
  if (!slugPattern.test(slug) || slug.length > MAX_SLUG_LENGTH) return admin_json({ error: "slug 只能包含字母、数字和单个连字符，且最多 200 字" }, { status: 422 });
  if (title.length > MAX_TITLE_LENGTH || excerpt.length > MAX_EXCERPT_LENGTH || content.length > MAX_CONTENT_LENGTH) return admin_json({ error: "文章字段超过长度限制" }, { status: 422 });
  const id = typeof input.id === "string" ? input.id.trim() : "";
  const updatedAt = typeof input.updatedAt === "string" ? input.updatedAt : undefined;
  const item: Article = { id: id || `article-${randomUUID()}`, title, slug, excerpt, content, status: input.status === "published" ? "published" : "draft", updatedAt: new Date().toISOString() };
  const result = await enqueue(async () => {
    const current = await getArticles();
    const previous = current.find((entry) => entry.id === item.id);
    if (previous && previous.updatedAt !== updatedAt) return { stale: true as const };
    if (current.some((entry) => entry.slug === slug && entry.id !== item.id)) return { conflict: true as const };
    const next = [item, ...current.filter((entry) => entry.id !== item.id)];
    await save(next, storePath);
    return { conflict: false as const, item };
  });
  if ("stale" in result && result.stale) return admin_json({ error: "文章已被其他页面更新，请重新加载后再保存" }, { status: 409 });
  if ("conflict" in result && result.conflict) return admin_json({ error: "这个 slug 已被其他文章使用" }, { status: 409 });
  return admin_json({ success: true, item: result.item });
}

export async function DELETE(request: Request) {
  const unauthorized = await require_admin();
  if (unauthorized) return unauthorized;
  const body = await request.json().catch(() => null) as { id?: string; updatedAt?: string } | null;
  if (!body?.id) return admin_json({ error: "文章 id 不能为空" }, { status: 422 });
  const result = await enqueue(async () => {
    const current = await getArticles();
    const next = current.filter((item) => item.id !== body.id);
    const previous = current.find((item) => item.id === body.id);
    if (!previous) return { missing: true as const };
    if (previous.updatedAt !== body.updatedAt) return { stale: true as const };
    await save(next, storePath);
    return { deleted: true as const };
  });
  if ("missing" in result && result.missing) return admin_json({ error: "文章不存在" }, { status: 404 });
  if ("stale" in result && result.stale) return admin_json({ error: "文章已被其他页面更新，请重新加载后再删除" }, { status: 409 });
  return admin_json({ success: true, id: body.id });
}
