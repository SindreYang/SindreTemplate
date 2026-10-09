import type { ReactNode } from "react";

function inline(source: string): ReactNode[] {
  const parts = source.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\((?:https?:\/\/|\/|#|mailto:)[^)]+\))/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link && safeHref(link[2])) {
      const external = /^https?:\/\//i.test(link[2]);
      return <a key={index} href={link[2]} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>{link[1]}</a>;
    }
    return <span key={index}>{part}</span>;
  });
}

function safeHref(value: string): boolean {
  try {
    const protocol = new URL(value, "https://sindrejs.local").protocol;
    return protocol === "http:" || protocol === "https:" || protocol === "mailto:";
  } catch {
    return false;
  }
}

/** Dependency-free Markdown subset for dashboards and lightweight editors. */
export function MarkdownView({ source, className }: { source: string; className?: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/).filter((block) => block.trim());
  return <div className={className}>{blocks.map((block, index) => {
    const lines = block.split("\n");
    const heading = lines[0].match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const content = inline(heading[2]);
      if (heading[1].length === 1) return <h1 key={index}>{content}</h1>;
      if (heading[1].length === 2) return <h2 key={index}>{content}</h2>;
      if (heading[1].length === 3) return <h3 key={index}>{content}</h3>;
      return <h4 key={index}>{content}</h4>;
    }
    if (lines[0].startsWith("```") && lines.at(-1)?.startsWith("```")) return <pre key={index}><code>{lines.slice(1, -1).join("\n")}</code></pre>;
    if (lines.every((line) => /^[-*]\s+/.test(line))) return <ul key={index}>{lines.map((line, itemIndex) => <li key={itemIndex}>{inline(line.replace(/^[-*]\s+/, ""))}</li>)}</ul>;
    return <p key={index}>{inline(lines.join(" "))}</p>;
  })}</div>;
}
