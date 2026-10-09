"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  RotateCcw,
  Terminal,
  Zap,
} from "lucide-react";
import { get_http_client, HttpError } from "sindrejs/general";

const samples = {
  object:
    '{\n  "name": "SindreJS",\n  "runtime": ["Web", "Node.js", "Bun"],\n  "ready": true\n}',
  array:
    '[\n  { "module": "general", "ready": true },\n  { "module": "utils3d", "ready": true }\n]',
  invalid: '{ "name": "SindreJS", "ready": }',
} as const;

type Result =
  | {
      success: true;
      data: unknown;
      meta: { kind: string; entries: number; bytes: number };
    }
  | { success: false; error: string };

const client = get_http_client({ baseURL: "/", timeout: 8000 });

export function Playground() {
  const [source, setSource] = useState<string>(samples.object);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      setResult(await client.post<Result>("/api/inspect", { source }));
    } catch (reason) {
      if (reason instanceof HttpError) {
        try {
          const parsed = JSON.parse(reason.body) as { error?: string };
          setResult({
            success: false,
            error: parsed.error ?? `HTTP ${reason.status}`,
          });
        } catch {
          setResult({ success: false, error: `HTTP ${reason.status}` });
        }
      } else {
        setResult({
          success: false,
          error: "连接失败，请确认开发服务器仍在运行。",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Clipboard access may be unavailable outside a secure context. */
    }
  }

  return (
    <section
      className="playground-section section-shell"
      id="playground"
      aria-labelledby="playground-title"
    >
      <div className="section-topline">
        <span className="section-number">02 / LIVE API</span>
        <span className="section-rule" />
      </div>
      <div className="playground-heading">
        <div>
          <h2 id="playground-title">
            让代码直接回应<span className="blue-dot">.</span>
          </h2>
          <p>
            输入 JSON，交给服务端的 SindreJS 解析。你看到的是实际 API
            返回的数据。
          </p>
        </div>
        <a
          className="text-link"
          href="https://github.com/SindreYang/SindreJS/blob/main/docs/modules/general.md"
          target="_blank"
          rel="noreferrer"
        >
          阅读 general 文档 <ArrowRight size={16} />
        </a>
      </div>
      <div className="playground-panel">
        <div className="panel-toolbar">
          <div className="toolbar-title">
            <span className="toolbar-icon">
              <Terminal size={15} />
            </span>
            <strong>API Playground</strong>
            <span className="toolbar-divider" /> <span>POST /api/inspect</span>
          </div>
          <span className="online-pill">
            <i /> 本地 API
          </span>
        </div>
        <div className="playground-grid">
          <div className="play-column input-column">
            <div className="column-heading">
              <span>01</span>
              <strong>请求输入</strong>
              <small>JSON</small>
            </div>
            <label className="sr-only" htmlFor="json-source">
              待解析的 JSON
            </label>
            <textarea
              id="json-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              spellCheck={false}
              aria-describedby="sample-help"
            />
            <div className="sample-row" id="sample-help">
              <span>试试示例</span>
              <button
                onClick={() => {
                  setSource(samples.object);
                  setResult(null);
                }}
              >
                对象
              </button>
              <button
                onClick={() => {
                  setSource(samples.array);
                  setResult(null);
                }}
              >
                数组
              </button>
              <button
                onClick={() => {
                  setSource(samples.invalid);
                  setResult(null);
                }}
              >
                错误输入
              </button>
            </div>
          </div>
          <div className="play-column output-column">
            <div className="column-heading">
              <span>02</span>
              <strong>响应结果</strong>
              <small>
                {result?.success ? "200 OK" : result ? "ERROR" : "等待运行"}
              </small>
            </div>
            <div
              className={`output-code ${result && !result.success ? "error-code" : ""}`}
              aria-live="polite"
            >
              {busy ? (
                <div className="result-placeholder">
                  <span className="loading-dots">···</span>
                  <p>正在解析</p>
                </div>
              ) : result ? (
                <pre>{JSON.stringify(result, null, 2)}</pre>
              ) : (
                <div className="result-placeholder">
                  <Zap size={24} strokeWidth={1.6} />
                  <p>运行后，结果将显示在这里</p>
                </div>
              )}
            </div>
            <div className="output-footer">
              <span>
                {result?.success
                  ? `${result.meta.kind} · ${result.meta.entries} 项 · ${result.meta.bytes} B`
                  : result
                    ? "请检查输入内容"
                    : "由 SindreJS / general 处理"}
              </span>
              <button
                onClick={copyResult}
                disabled={!result}
                aria-label="复制响应结果"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>
        <div className="panel-bottom">
          <span>
            前端 <code>get_http_client</code> <ArrowRight size={13} /> Next.js
            API <ArrowRight size={13} /> <code>safe_parse_json</code>
          </span>
          <div>
            <button
              className="reset-button"
              onClick={() => {
                setSource(samples.object);
                setResult(null);
              }}
            >
              <RotateCcw size={14} /> 重置
            </button>
            <button className="run-button" onClick={run} disabled={busy}>
              {busy ? "运行中" : "运行代码"} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
