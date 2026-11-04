import type { ReactNode } from "react";
import { releaseData } from "./site-data.generated";
import { sitePath } from "./site-path";
import styles from "./docs.module.css";

export const REPO = "https://github.com/AnranS/godot_for_minigame";
export const RELEASE = `${REPO}/releases/latest`;
export const VERSION = releaseData.pluginVersion;
export const GUIDE_ZH = `${REPO}/blob/main/docs/USAGE_zh.md`;
export { styles };

// Every certified editor from support-matrix.json, with where its engine
// template comes from: bundled with the plugin or a template release.
export const certifiedTemplates = releaseData.certified.map((row) => ({
  version: row.godotVersion,
  commit: row.godotCommit,
  bundled: row.template.source === "bundled",
  releaseUrl: "releaseTag" in row.template ? `${REPO}/releases/tag/${row.template.releaseTag}` : RELEASE,
}));

type DocsPage = "quick-start" | "guide";

const pages: { id: DocsPage; href: string; label: string }[] = [
  { id: "quick-start", href: "/quick-start/", label: "快速开始" },
  { id: "guide", href: "/guide/", label: "接入指引" },
];

export function DocsShell({
  current,
  title,
  lead,
  meta,
  toc,
  children,
}: {
  current: DocsPage;
  title: string;
  lead: string;
  meta: string[];
  toc: { id: string; label: string }[];
  children: ReactNode;
}) {
  const currentLabel = pages.find((page) => page.id === current)?.label ?? "";
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.brand} href={sitePath("/")} aria-label="返回 Godot Mini Game 官网">
            <span><img src={sitePath("/godot.svg")} alt="" /></span>
            <strong>Godot <b>Mini Game</b></strong>
          </a>
          <nav className={styles.headerNav} aria-label="文档导航">
            {pages.map((page) => (
              <a key={page.id} href={sitePath(page.href)} aria-current={page.id === current ? "page" : undefined}>
                {page.label}
              </a>
            ))}
            <a href={sitePath("/api/")}>API 参考</a>
          </nav>
          <a className={styles.github} href={REPO} target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.breadcrumb}>
            <a href={sitePath("/")}>官网</a><span>/</span><strong>{currentLabel}</strong>
          </div>
          <h1>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          <div className={styles.heroMeta}>
            {meta.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
      </section>

      <div className={styles.layout}>
        <aside className={styles.toc} aria-label="本页目录">
          <p>On this page</p>
          <ol>
            {toc.map((item) => <li key={item.id}><a href={`#${item.id}`}>{item.label}</a></li>)}
          </ol>
        </aside>
        <article className={styles.content}>{children}</article>
      </div>

      <footer className={styles.footer}>
        <a className={styles.brand} href={sitePath("/")}>
          <span><img src={sitePath("/godot.svg")} alt="" /></span>
          <strong>Godot <b>Mini Game</b></strong>
        </a>
        <p>文档基于插件 v{VERSION}。截图来自真实导出与微信开发者工具运行结果。</p>
        <nav>
          <a href={sitePath("/quick-start/")}>快速开始</a>
          <a href={sitePath("/guide/")}>接入指引</a>
          <a href={sitePath("/api/")}>API</a>
          <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">Issues</a>
        </nav>
      </footer>
    </main>
  );
}

export function Section({ id, step, title, children }: { id: string; step?: string; title: string; children: ReactNode }) {
  return (
    <section id={id}>
      <h2>{step ? <span className={styles.stepNo}>{step}</span> : null}{title}</h2>
      {children}
    </section>
  );
}

export function Code({ label, children }: { label?: string; children: string }) {
  return (
    <div className={styles.code}>
      {label ? <span>{label}</span> : null}
      <pre><code>{children}</code></pre>
    </div>
  );
}

export function Shot({
  src,
  alt,
  width,
  height,
  caption,
  narrow = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption: ReactNode;
  narrow?: boolean;
}) {
  return (
    <figure className={narrow ? `${styles.figure} ${styles.figureNarrow}` : styles.figure}>
      <img src={sitePath(`/screenshots/${src}`)} alt={alt} width={width} height={height} loading="lazy" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function Callout({ title, warn = false, children }: { title: string; warn?: boolean; children: ReactNode }) {
  return (
    <div className={warn ? `${styles.callout} ${styles.calloutWarn}` : styles.callout}>
      <b>{title}</b>
      {children}
    </div>
  );
}
