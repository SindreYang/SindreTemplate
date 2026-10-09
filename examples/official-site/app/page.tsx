import {
  ArrowDown,
  ArrowRight,
  Box,
  Braces,
  GitBranch,
  Image as ImageIcon,
  Layers3,
  LayoutGrid,
  Menu,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Playground } from "./components/playground";

const modules = [
  {
    name: "general",
    label: "通用能力",
    detail: "读写、请求、日志、加密与流式处理。",
    icon: Box,
    href: "general",
  },
  {
    name: "utils2d",
    label: "图像与画布",
    detail: "Canvas 绘制、标注与图像几何。",
    icon: ImageIcon,
    href: "utils2d",
  },
  {
    name: "utils3d",
    label: "三维场景",
    detail: "模型、样条、路径与局部塑形。",
    icon: Layers3,
    href: "utils3d",
  },
  {
    name: "ai",
    label: "模型接入",
    detail: "MediaPipe、TensorFlow.js 与 ONNX。",
    icon: Sparkles,
    href: "https://github.com/SindreYang/SindreJS/blob/main/docs/ai.md",
  },
  {
    name: "utilsui",
    label: "React 组件",
    detail: "交互、状态、媒体与内容组件。",
    icon: LayoutGrid,
    href: "utilsui",
  },
  {
    name: "utilsagent",
    label: "智能体",
    detail: "消息、多模态与流式输出。",
    icon: Workflow,
    href: "utilsagent",
  },
] as const;

export default function Home() {
  return (
    <>
      <header className="site-header">
        <nav className="nav-shell" aria-label="主导航">
          <a href="#top" className="brand" aria-label="SindreJS 首页">
            <span className="brand-symbol">
              S<span>.</span>
            </span>
            <span>
              Sindre<span>JS</span>
            </span>
          </a>
          <div className="nav-links">
            <a href="#modules">模块</a>
            <a href="#playground">在线演示</a>
            <a href="/admin">后台工作台</a>
            <a href="/articles">文章</a>
            <a
              href="https://github.com/SindreYang/SindreJS/tree/main/docs"
              target="_blank"
              rel="noreferrer"
            >
              文档
            </a>
          </div>
          <a
            className="github-button"
            href="https://github.com/SindreYang/SindreJS"
            target="_blank"
            rel="noreferrer"
          >
            <GitBranch size={17} /> GitHub <ArrowRight size={14} />
          </a>
          <a className="mobile-menu" href="#modules" aria-label="跳转到模块">
            <Menu size={22} />
          </a>
        </nav>
      </header>
      <main id="top">
        <section className="hero section-shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="availability">
              <span /> 开源 TypeScript 工具库
            </div>
            <h1 id="hero-title">
              把基础能力，
              <br />
              <em>组合成产品。</em>
            </h1>
            <p>
              面向 Web、Node.js 与 Bun 的 TypeScript
              工具库。通用能力、图像、3D、AI 和 UI，各取所需，组合使用。
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#playground">
                体验 API <ArrowRight size={18} />
              </a>
              <a className="secondary-button" href="#modules">
                查看模块 <ArrowDown size={17} />
              </a>
            </div>
            <div className="hero-meta">
              <span className="mini-diamond" /> 一个入口，按需引入{" "}
              <span className="meta-separator" /> 在浏览器与服务端使用
            </div>
          </div>
          <div className="hero-visual" aria-label="SindreJS JSON 解析示例">
            <div className="editor-top">
              <span className="editor-dots">
                <i />
                <i />
                <i />
              </span>
              <span>quick-start.ts</span>
              <span className="ts-pill">TS</span>
            </div>
            <div className="editor-body">
              <div className="editor-code">
                <span className="line-no">01</span>
                <span>
                  <b>import</b> {"{"} <em>safe_parse_json</em> {"}"}{" "}
                </span>
                <span className="line-no">02</span>
                <span>
                  <b>from</b> <i>&quot;sindrejs/general&quot;</i>;
                </span>
                <span className="line-no">03</span>
                <span>&nbsp;</span>
                <span className="line-no">04</span>
                <span>
                  <b>const</b> source ={" "}
                  <i>&apos;{'{"name":"SindreJS"}'}&apos;</i>;
                </span>
                <span className="line-no">05</span>
                <span>
                  <b>const</b> result = <em>safe_parse_json</em>(source);
                </span>
                <span className="line-no">06</span>
                <span>&nbsp;</span>
                <span className="line-no">07</span>
                <span>
                  console.<em>log</em>(result);
                </span>
              </div>
              <div className="editor-result">
                <div className="result-title">
                  <span className="success-dot" /> 运行结果 <span>success</span>
                </div>
                <code>
                  {"{"}
                  <br />
                  &nbsp;&nbsp;<span>success</span>: <strong>true</strong>,<br />
                  &nbsp;&nbsp;<span>value</span>: {"{"} <span>name</span>:{" "}
                  <i>&quot;SindreJS&quot;</i> {"}"}
                  <br />
                  {"}"}
                </code>
              </div>
            </div>
            <div className="editor-bottom">
              <span>TypeScript</span>
              <span>
                <span className="pulse-dot" /> Ready to build
              </span>
            </div>
          </div>
        </section>
        <section
          className="modules-section"
          id="modules"
          aria-labelledby="modules-title"
        >
          <div className="section-shell">
            <div className="section-topline">
              <span className="section-number">01 / MODULES</span>
              <span className="section-rule" />
            </div>
            <div className="modules-heading">
              <div>
                <h2 id="modules-title">
                  一套工具，按需组合<span className="blue-dot">.</span>
                </h2>
                <p>从基础数据处理到交互体验，让每项能力都有清晰的入口。</p>
              </div>
              <a
                className="text-link"
                href="https://github.com/SindreYang/SindreJS/tree/main/docs"
                target="_blank"
                rel="noreferrer"
              >
                探索所有文档 <ArrowRight size={16} />
              </a>
            </div>
            <div className="modules-grid">
              {modules.map((module, index) => {
                const Icon = module.icon;
                return (
                  <a
                    className="module-item"
                    key={module.name}
                    href={module.href.startsWith("https://") ? module.href : `https://github.com/SindreYang/SindreJS/blob/main/docs/modules/${module.href}.md`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div className="module-icon">
                      <Icon size={24} strokeWidth={1.65} />
                    </div>
                    <div>
                      <span className="module-count">
                        0{index + 1} / {module.label}
                      </span>
                      <h3>{module.name}</h3>
                      <p>{module.detail}</p>
                    </div>
                    <ArrowRight className="module-arrow" size={17} />
                  </a>
                );
              })}
            </div>
          </div>
        </section>
        <Playground />
        <section className="closing-section">
          <div className="section-shell closing-inner">
            <div>
              <span className="section-number">NEXT STEP</span>
              <h2>
                从一个函数开始<span className="blue-dot">.</span>
              </h2>
              <p>打开文档，选择要用的模块。每个入口都能独立引入。</p>
            </div>
            <a
              className="closing-cta"
              href="https://github.com/SindreYang/SindreJS/tree/main/docs"
              target="_blank"
              rel="noreferrer"
            >
              开始阅读文档 <ArrowRight size={19} />
            </a>
            <Braces
              className="closing-watermark"
              size={300}
              strokeWidth={0.5}
            />
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="section-shell footer-inner">
          <a href="#top" className="brand footer-brand">
            <span className="brand-symbol">
              S<span>.</span>
            </span>
            <span>
              Sindre<span>JS</span>
            </span>
          </a>
          <span>为实际项目组合而成的 TypeScript 工具。</span>
          <a
            href="https://github.com/SindreYang/SindreJS"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowRight size={14} />
          </a>
        </div>
      </footer>
    </>
  );
}
