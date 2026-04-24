"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export type Category = "AI" | "LLM" | "Agents" | "Research" | "Бизнес" | "Tool" | "Монгол";

export interface Article {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: Category;
  tags: string[];
  source: string;
  sourceUrl: string;
  authorName: string;
  authorAvatar: string;
  views: number;
  readingMinutes: number;
  publishedAt: string;
}

const CATEGORY_COLORS: Record<Category, string> = {
  AI: "#EF2C58",
  LLM: "#A855F7",
  Agents: "#22C55E",
  Research: "#3B82F6",
  "Бизнес": "#F59E0B",
  Tool: "#06B6D4",
  "Монгол": "#EC4899",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isSafeUrl = (url: string): boolean => /^(https?:|\/)/i.test(url);

function inlineFormat(line: string): string {
  // 1) markdown image: ![alt](url)
  let out = line.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt: string, url: string) => {
    if (!isSafeUrl(url)) return "";
    return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" />`;
  });
  // 2) markdown link: [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text: string, url: string) => {
    if (!isSafeUrl(url)) return escapeHtml(text);
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  });
  // 3) bold **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // 4) inline code `text`
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}

export function renderContent(raw: string): { __html: string } {
  if (!raw) return { __html: "" };

  const paragraphs = raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const html = paragraphs
    .map((p) => {
      if (/^#\s+/.test(p)) return `<h2>${inlineFormat(escapeHtml(p.replace(/^#\s+/, "")))}</h2>`;
      if (/^##\s+/.test(p)) return `<h3>${inlineFormat(escapeHtml(p.replace(/^##\s+/, "")))}</h3>`;
      if (/^>\s+/.test(p)) return `<blockquote>${inlineFormat(escapeHtml(p.replace(/^>\s+/, "")))}</blockquote>`;
      // standalone image paragraph renders as figure
      const imageOnly = p.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (imageOnly && isSafeUrl(imageOnly[2])) {
        return `<figure><img src="${escapeHtml(imageOnly[2])}" alt="${escapeHtml(imageOnly[1])}" loading="lazy" />${imageOnly[1] ? `<figcaption>${escapeHtml(imageOnly[1])}</figcaption>` : ""}</figure>`;
      }
      const lines = p.split("\n").map((l) => inlineFormat(escapeHtml(l))).join("<br />");
      return `<p>${lines}</p>`;
    })
    .join("");
  return { __html: html };
}

export interface NewsArticleProps {
  article: Article;
  related: Article[];
}

export default function NewsArticleView({ article, related }: NewsArticleProps) {
  const [progress, setProgress] = useState(0);
  const [shareStatus, setShareStatus] = useState("");

  // reading progress bar
  useEffect(() => {
    const handler = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      const pct = total > 0 ? Math.min(100, Math.max(0, (h.scrollTop / total) * 100)) : 0;
      setProgress(pct);
    };
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: article.title, text: article.excerpt, url });
        setShareStatus("Хуваалцлаа");
      } else {
        await navigator.clipboard.writeText(url);
        setShareStatus("Холбоос хуулагдлаа");
      }
    } catch {
      setShareStatus("");
    }
    setTimeout(() => setShareStatus(""), 2200);
  };

  const categoryColor = useMemo(() => CATEGORY_COLORS[article.category], [article]);

  return (
    <article className="mx-auto max-w-3xl pb-16">
      {/* Reading progress */}
      <div className="fixed left-0 right-0 top-0 z-[60] h-[2px] bg-transparent">
        <div
          className="h-full transition-[width] duration-150"
          style={{ width: `${progress}%`, background: categoryColor }}
        />
      </div>

      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-[11px] text-[#555]">
        <Link href="/" className="hover:text-[#AAA]">Нүүр</Link>
        <span className="text-[#2A2A2A]">/</span>
        <Link href="/news" className="hover:text-[#AAA]">Блог</Link>
        <span className="text-[#2A2A2A]">/</span>
        <span className="truncate text-[#888]">{article.category}</span>
      </nav>

      {/* Header */}
      <header className="mb-7">
        <div className="mb-3 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em]"
            style={{ background: `${categoryColor}1F`, color: categoryColor }}
          >
            <span className="h-1 w-1 rounded-full" style={{ background: categoryColor }} />
            {article.category}
          </span>
          <span className="text-[11px] text-[#555]">{formatDate(article.publishedAt)}</span>
          <span className="text-[#2A2A2A]">·</span>
          <span className="text-[11px] text-[#555]">{article.readingMinutes} мин</span>
        </div>
        <h1 className="text-[30px] font-black leading-[1.1] tracking-tight text-[#E8E8E8] md:text-[42px]">
          {article.title}
        </h1>
        {article.excerpt && (
          <p className="mt-4 text-[15px] leading-relaxed text-[#999] md:text-[17px]">{article.excerpt}</p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-[rgba(255,255,255,0.06)] py-4">
          <div className="flex items-center gap-3">
            {article.authorAvatar ? (
              <img src={article.authorAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(239,44,88,0.12)] text-[13px] font-bold text-[#EF2C58]">
                {article.authorName.charAt(0)}
              </div>
            )}
            <div className="leading-tight">
              <div className="text-[13px] font-bold text-[#E8E8E8]">{article.authorName}</div>
              <div className="text-[10px] text-[#555]">
                {article.views.toLocaleString()} үзсэн
                {article.source && <> · эх сурвалж: <span className="text-[#888]">{article.source}</span></>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={share}
              className="flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#111] px-3.5 py-1.5 text-[11px] font-semibold text-[#AAA] transition hover:border-[rgba(239,44,88,0.3)] hover:text-[#EF2C58]"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              {shareStatus || "Хуваалцах"}
            </button>
            {article.sourceUrl && (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#111] px-3.5 py-1.5 text-[11px] font-semibold text-[#AAA] transition hover:border-[rgba(255,255,255,0.18)] hover:text-[#E8E8E8]"
              >
                Эх сурвалж
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Cover image */}
      {article.coverImage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative mb-8 overflow-hidden rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A]"
        >
          <div className="relative aspect-[16/9]">
            <img src={article.coverImage} alt={article.title} className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        </motion.div>
      )}

      {/* Body */}
      <div
        className="news-article text-[15px] leading-[1.8] text-[#C8C8C8] md:text-[16px]"
        dangerouslySetInnerHTML={renderContent(article.content)}
      />

      {/* Tags */}
      {article.tags?.length > 0 && (
        <div className="mt-10 flex flex-wrap items-center gap-1.5 border-t border-[rgba(255,255,255,0.06)] pt-6">
          <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#555]">Tags</span>
          {article.tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#111] px-2.5 py-1 text-[11px] text-[#999] transition hover:border-[rgba(239,44,88,0.3)] hover:text-[#EF2C58]"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* CTA */}
      <section className="mt-10 overflow-hidden rounded-[8px] border border-[rgba(239,44,88,0.18)] bg-gradient-to-br from-[rgba(239,44,88,0.08)] via-[#0D0D0D] to-[#0D0D0D] p-6 md:p-8">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-[#EF2C58]">ANTAQOR</div>
            <h3 className="mt-1.5 text-[18px] font-bold leading-tight text-[#E8E8E8] md:text-[20px]">
              AI-г бүтээгчийн нүдээр
            </h3>
            <p className="mt-1 text-[12px] text-[#666] md:text-[13px]">
              Cyber Empire-ийн гишүүд промт, агент, AI бизнесийн гарын авлагад хандах боломжтой.
            </p>
          </div>
          <Link href="/auth/signup" className="rounded-[8px] bg-[#EF2C58] px-6 py-3 text-[13px] font-bold text-white transition hover:shadow-[0_0_32px_rgba(239,44,88,0.3)]">
            Нэгдэх
          </Link>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-[2px] w-4 bg-[#EF2C58]" />
            <span className="text-[11px] font-bold tracking-[0.12em] text-[#E8E8E8]">УНШИХ САНАЛ</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r._id}
                href={`/news/${r.slug}`}
                className="group overflow-hidden rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] transition hover:border-[rgba(239,44,88,0.25)]"
              >
                <div className="relative aspect-[16/10] bg-[#1A1A1A]">
                  {r.coverImage ? (
                    <img src={r.coverImage} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-[#181818] to-[#0D0D0D]" />
                  )}
                </div>
                <div className="p-3">
                  <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: CATEGORY_COLORS[r.category] }}>
                    {r.category}
                  </div>
                  <div className="line-clamp-2 text-[13px] font-bold text-[#E8E8E8] group-hover:text-white">
                    {r.title}
                  </div>
                  <div className="mt-2 text-[10px] text-[#555]">{r.readingMinutes} мин унших</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <style jsx global>{`
        .news-article p { margin: 0 0 1.1em; }
        .news-article h2 { margin: 1.6em 0 0.6em; font-size: 22px; font-weight: 800; color: #E8E8E8; letter-spacing: -0.01em; }
        .news-article h3 { margin: 1.4em 0 0.5em; font-size: 18px; font-weight: 700; color: #E8E8E8; }
        .news-article blockquote {
          border-left: 2px solid #EF2C58;
          padding: 0.25em 0 0.25em 1em;
          margin: 1.2em 0;
          color: #B8B8B8;
          font-style: italic;
        }
        .news-article a { color: #EF2C58; text-decoration: none; border-bottom: 1px solid rgba(239,44,88,0.3); }
        .news-article a:hover { border-bottom-color: #EF2C58; }
        .news-article code {
          background: #1A1A1A;
          padding: 0.15em 0.4em;
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.92em;
          color: #EF9DB5;
        }
        .news-article strong { color: #E8E8E8; font-weight: 700; }
        .news-article figure {
          margin: 1.8em 0;
          display: flex;
          flex-direction: column;
          gap: 0.5em;
        }
        .news-article figure img {
          width: 100%;
          height: auto;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.06);
          background: #141414;
        }
        .news-article figcaption {
          font-size: 12px;
          color: #666;
          text-align: center;
          font-style: italic;
        }
        .news-article p img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
          margin: 0.3em 0;
        }
      `}</style>
    </article>
  );
}
