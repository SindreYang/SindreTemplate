"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../styles.js";

export interface PageResult<T> { items: T[]; total?: number; hasMore?: boolean }
export interface PageLoaderOptions<T> {
  loadPage: (page: number, pageSize: number, signal: AbortSignal) => Promise<PageResult<T>>;
  pageSize?: number;
  mode?: "replace" | "append";
}

/** Page numbers start at 1. Abort stale requests on page changes and unmount. */
export function usePageLoader<T>({ loadPage, pageSize = 20, mode = "replace" }: PageLoaderOptions<T>) {
  const loader = useRef(loadPage);
  loader.current = loadPage;
  const pageStarts = useRef(new Map<number, number>());
  const moreRequested = useRef(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const controller = new AbortController();
    const start = mode === "append" && page > 1 ? (pageStarts.current.get(page) ?? items.length) : 0;
    setLoading(true);
    setError(null);
    loader.current(page, pageSize, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setItems((previous) => mode === "append" && page > 1 ? [...previous.slice(0, start), ...result.items] : result.items);
      if (mode === "append") pageStarts.current.set(page, start);
      setTotal(result.total);
      setHasMore(result.hasMore ?? (result.total !== undefined ? page * pageSize < result.total : result.items.length === pageSize));
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason); })
      .finally(() => { if (!controller.signal.aborted) { moreRequested.current = false; setLoading(false); } });
    return () => { controller.abort(); moreRequested.current = false; };
  }, [page, pageSize, mode, revision]);

  const set_page = useCallback((next: number) => {
    if (!Number.isSafeInteger(next) || next < 1) throw new RangeError("page must be a positive integer");
    if (mode === "append") throw new Error("set_page is only available in replace mode");
    setPage(next);
  }, [mode]);
  const load_more = useCallback(() => {
    if (mode !== "append") throw new Error("load_more requires append mode");
    if (!loading && !error && hasMore && !moreRequested.current) {
      moreRequested.current = true;
      setPage((current) => current + 1);
    }
  }, [mode, loading, error, hasMore]);
  const retry = useCallback(() => setRevision((current) => current + 1), []);
  const reset = useCallback(() => { pageStarts.current.clear(); moreRequested.current = false; setItems([]); setTotal(undefined); setHasMore(true); setPage(1); setRevision((current) => current + 1); }, []);
  return { items, page, total, hasMore, loading, error, set_page, load_more, retry, reset };
}

export interface InfiniteScrollProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  root?: Element | null;
  rootMargin?: string;
  className?: string;
  loadLabel?: string;
  loadingLabel?: string;
  endLabel?: string;
  error?: unknown;
  onRetry?: () => void;
  children?: ReactNode;
}

/** Observe a sentinel, with an accessible manual button when observation is unavailable. */
export function InfiniteScroll({ hasMore, loading, onLoadMore, root, rootMargin = "200px", className, loadLabel = "加载更多", loadingLabel = "加载中…", endLabel = "已经到底了", error, onRetry, children }: InfiniteScrollProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const loadRef = useRef(onLoadMore);
  loadRef.current = onLoadMore;
  useEffect(() => {
    if (!hasMore || loading || error || !sentinel.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        loadRef.current();
      }
    }, { root, rootMargin });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, loading, error, root, rootMargin]);

  return <div className={cn("space-y-3", className)}>
    {children}
    <div ref={sentinel} aria-hidden="true" />
    {error ? <div role="alert" className="text-center text-sm text-destructive">加载失败 <button type="button" onClick={onRetry} disabled={!onRetry} className="underline">重试</button></div>
      : loading ? <p role="status" className="text-center text-sm text-muted-foreground">{loadingLabel}</p>
      : hasMore ? <button type="button" onClick={onLoadMore} className="w-full rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">{loadLabel}</button>
      : <p className="text-center text-sm text-muted-foreground">{endLabel}</p>}
  </div>;
}

export function PaginationControls({ page, hasMore, loading, onPageChange, total, pageSize, className, previousLabel = "上一页", nextLabel = "下一页" }: {
  page: number; hasMore: boolean; loading?: boolean; onPageChange: (page: number) => void;
  total?: number; pageSize?: number; className?: string; previousLabel?: string; nextLabel?: string;
}) {
  const pages = total !== undefined && pageSize ? Math.max(1, Math.ceil(total / pageSize)) : undefined;
  return <nav aria-label="分页" className={cn("flex items-center justify-between gap-4 text-sm", className)}>
    <button type="button" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 disabled:opacity-50"><ChevronLeft size={16} aria-hidden="true" />{previousLabel}</button>
    <span aria-live="polite">{page}{pages !== undefined ? ` / ${pages}` : ""}</span>
    <button type="button" disabled={loading || !hasMore} onClick={() => onPageChange(page + 1)} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 disabled:opacity-50">{nextLabel}<ChevronRight size={16} aria-hidden="true" /></button>
  </nav>;
}
