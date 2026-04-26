"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { useMembership } from "@/lib/useMembership";
import { formatDistanceToNow } from "@/lib/utils";
import ShareButton from "@/components/ShareButton";

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
  Agents: "#EF2C58",
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

  const categoryColor = useMemo(() => CATEGORY_COLORS[article.category], [article]);

  return (
    <article className="mx-auto max-w-3xl pb-16">
      {/* Reading progress */}
      <div className="fixed left-0 right-0 top-0 z-[60] h-[3px] bg-[rgba(255,255,255,0.04)]">
        <div
          className="h-full transition-[width] duration-150"
          style={{
            width: `${progress}%`,
            background: categoryColor,
            boxShadow: `0 0 8px ${categoryColor}66`,
          }}
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
            <ShareButton
              kind="news"
              resourceId={article.slug}
              path={`/news/${article.slug}`}
              title={article.title}
              excerpt={article.excerpt}
              size="md"
            />
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
          className="relative mb-8 overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A]"
        >
          <div className="relative aspect-[16/9]">
            <img src={article.coverImage} alt={article.title} className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        </motion.div>
      )}

      {/* Body */}
      <div
        className="news-article text-[16px] leading-[1.85] text-[#C8C8C8] md:text-[18px] md:leading-[1.85]"
        dangerouslySetInnerHTML={renderContent(article.content)}
      />

      {/* Tags */}
      {article.tags?.length > 0 && (
        <div className="mt-12 flex flex-wrap items-center gap-1.5 border-t border-[rgba(255,255,255,0.06)] pt-6">
          <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#555]">Tags</span>
          {article.tags.map((t) => (
            <Link
              key={t}
              href={`/news?q=${encodeURIComponent(t)}`}
              className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#111] px-2.5 py-1 text-[11px] text-[#999] transition hover:border-[rgba(239,44,88,0.3)] hover:text-[#EF2C58]"
            >
              #{t}
            </Link>
          ))}
        </div>
      )}

      {/* Author bio — trust signal */}
      <section className="mt-12 flex items-start gap-4 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0D0D0D] p-5">
        {article.authorAvatar ? (
          <img src={article.authorAvatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(239,44,88,0.12)] text-[16px] font-black text-[#EF2C58]">
            {article.authorName.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#666]">Зохиолч</span>
            <span className="text-[#2A2A2A]">·</span>
            <span className="text-[10px] text-[#555]">Antaqor редактор</span>
          </div>
          <div className="mt-0.5 text-[15px] font-bold text-[#E8E8E8]">{article.authorName}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-[#888]">
            AI, LLM, агентуудын талаарх Монгол хэл дээрх контентыг өдөр бүр редактораар шүүж нийтэлдэг.
          </p>
        </div>
      </section>

      {/* Single conversion block — primary membership, secondary Telegram */}
      <section className="mt-5 overflow-hidden rounded-[4px] border border-[rgba(239,44,88,0.22)] bg-gradient-to-br from-[rgba(239,44,88,0.10)] via-[#0D0D0D] to-[#0D0D0D] p-6 md:p-7">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-[0.2em] text-[#EF2C58]">CYBER EMPIRE</div>
            <h3 className="mt-1.5 text-[20px] font-bold leading-tight text-[#E8E8E8] md:text-[22px]">
              Бүх контент · Бүх хичээл · Хязгааргүй
            </h3>
            <p className="mt-1 text-[12px] text-[#888] md:text-[13px]">
              Member бол promt, agent, бизнесийн гарын авлагад бүрэн хандана.
            </p>
          </div>
          <Link
            href="/clan?pay=1"
            className="group relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-[4px] bg-[#EF2C58] px-6 py-3 text-[14px] font-black text-white shadow-[0_0_24px_rgba(239,44,88,0.25)] transition hover:shadow-[0_0_40px_rgba(239,44,88,0.4)]"
          >
            <span className="relative z-10">Нэгдэх · ₮49k</span>
            <svg className="relative z-10 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </Link>
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-[rgba(255,255,255,0.05)] pt-4 text-[11px] text-[#777]">
          <svg className="h-3.5 w-3.5 text-[#2AABEE]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.198 2.433a2.242 2.242 0 00-1.022.215l-16.5 7.5a2.25 2.25 0 00.126 4.147l4.012 1.484 1.48 4.012a2.25 2.25 0 004.148.126l7.5-16.5a2.25 2.25 0 00-.217-2.022 2.25 2.25 0 00-1.527-.962z" />
          </svg>
          Үнэгүй Telegram сувагт нэгдэх үү?
          <Link href="/chat" className="font-semibold text-[#2AABEE] transition hover:text-[#5BC0F8]">
            t.me/antaqor →
          </Link>
        </div>
      </section>

      {/* Comments */}
      <NewsComments slug={article.slug} />

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
                className="group overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] transition hover:border-[rgba(239,44,88,0.25)]"
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
        .news-article p { margin: 0 0 1.35em; }
        .news-article h2 {
          margin: 2em 0 0.7em;
          font-size: 24px;
          font-weight: 800;
          color: #E8E8E8;
          letter-spacing: -0.015em;
          line-height: 1.25;
        }
        @media (min-width: 768px) {
          .news-article h2 { font-size: 28px; }
          .news-article h3 { font-size: 22px; }
        }
        .news-article h3 {
          margin: 1.7em 0 0.55em;
          font-size: 20px;
          font-weight: 700;
          color: #E8E8E8;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }
        .news-article h2 + p, .news-article h3 + p { margin-top: 0; }
        .news-article blockquote {
          border-left: 3px solid #EF2C58;
          padding: 0.3em 0 0.3em 1.1em;
          margin: 1.6em 0;
          color: #B8B8B8;
          font-style: italic;
          font-size: 1.02em;
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
          margin: 2em 0;
          display: flex;
          flex-direction: column;
          gap: 0.6em;
        }
        .news-article figure img {
          width: 100%;
          height: auto;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
          background: #141414;
        }
        .news-article figcaption {
          font-size: 13px;
          color: #666;
          text-align: center;
          font-style: italic;
        }
        .news-article p img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 0.5em 0;
        }
        .news-article ul, .news-article ol {
          margin: 0 0 1.35em 1.4em;
          padding: 0;
        }
        .news-article li {
          margin-bottom: 0.55em;
        }
      `}</style>
    </article>
  );
}

interface CommentItem {
  _id: string;
  content: string;
  createdAt: string;
  author?: { _id: string; name: string; avatar?: string; clan?: string };
}

function NewsComments({ slug }: { slug: string }) {
  const { data: session } = useSession();
  const { isMember, isAdmin } = useMembership();
  const myId = (session?.user as { id?: string } | undefined)?.id;
  const canPost = isMember || isAdmin;

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    fetch(`/api/news/${encodeURIComponent(slug)}/comments`)
      .then((r) => r.json())
      .then((d) => { if (!cancel && d.comments) setComments(d.comments); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/news/${encodeURIComponent(slug)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Илгээх боломжгүй");
        return;
      }
      setComments((prev) => [data.comment, ...prev]);
      setText("");
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Сэтгэгдэл устгах уу?")) return;
    const res = await fetch(`/api/news/comments/${id}`, { method: "DELETE" });
    if (res.ok) setComments((prev) => prev.filter((c) => c._id !== id));
  };

  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#EF2C58]" />
          <span className="text-[11px] font-bold tracking-[0.12em] text-[#E8E8E8]">СЭТГЭГДЭЛ</span>
          <span className="rounded-full bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 text-[10px] font-bold text-[#888]">
            {comments.length}
          </span>
        </div>
      </div>

      {/* Composer */}
      {!session ? (
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-4 text-center">
          <p className="text-[13px] text-[#888]">Сэтгэгдэл бичихийн тулд нэвтэрнэ үү.</p>
          <Link href="/auth/signin" className="mt-3 inline-flex items-center gap-1.5 rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#D4264E]">
            Нэвтрэх
          </Link>
        </div>
      ) : !canPost ? (
        <div className="overflow-hidden rounded-[4px] border border-[rgba(239,44,88,0.22)] bg-gradient-to-r from-[rgba(239,44,88,0.08)] to-[#0D0D0D] p-4">
          <div className="text-[13px] text-[#E8E8E8]">
            Зөвхөн <span className="font-bold text-[#EF2C58]">Cyber Empire гишүүд</span> сэтгэгдэл бичих эрхтэй.
          </div>
          <Link href="/clan?pay=1" className="mt-3 inline-flex items-center gap-1.5 rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#D4264E]">
            Cyber Empire нэгдэх
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Бодлоо хуваалц..."
            maxLength={1000}
            rows={3}
            className="w-full resize-y rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] leading-relaxed text-[#E8E8E8] placeholder-[#555] outline-none transition focus:border-[rgba(239,44,88,0.4)]"
          />
          {error && (
            <div className="mt-2 rounded-[4px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-1.5 text-[11px] text-[#EF4444]">
              {error}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] text-[#555]">{text.length}/1000</span>
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#D4264E] disabled:opacity-40"
            >
              {sending ? "Илгээж байна..." : "Илгээх"}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="mt-4 space-y-2.5">
        {loading ? (
          <div className="py-6 text-center">
            <div className="inline-block h-2 w-2 animate-pulse rounded-[4px] bg-[#EF2C58]" />
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-[4px] border border-dashed border-[rgba(255,255,255,0.06)] py-8 text-center text-[12px] text-[#555]">
            Эхний сэтгэгдлийг үлдээгээрэй
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {comments.map((c) => {
              const initial = c.author?.name?.charAt(0) || "?";
              const canDelete = c.author?._id === myId || isAdmin;
              return (
                <motion.div
                  key={c._id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                  className="flex gap-3 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] p-3"
                >
                  <div className="shrink-0">
                    {c.author?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.author.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(239,44,88,0.12)] text-[12px] font-bold text-[#EF2C58]">
                        {initial}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={c.author?._id ? `/profile/${c.author._id}` : "#"}
                        className="text-[12px] font-bold text-[#E8E8E8] hover:text-[#EF2C58]"
                      >
                        {c.author?.name || "Хэрэглэгч"}
                      </Link>
                      {c.author?.clan && (
                        <span className="rounded-full bg-[rgba(239,44,88,0.12)] px-1.5 py-0.5 text-[9px] font-black text-[#EF2C58]">
                          MEMBER
                        </span>
                      )}
                      <span className="text-[10px] text-[#555]">{formatDistanceToNow(c.createdAt)}</span>
                      {canDelete && (
                        <button
                          onClick={() => remove(c._id)}
                          className="ml-auto rounded px-1.5 py-0.5 text-[10px] text-[#555] transition hover:bg-[rgba(239,68,68,0.1)] hover:text-[#EF4444]"
                          aria-label="Устгах"
                        >
                          Устгах
                        </button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#CCC]">
                      {c.content}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
