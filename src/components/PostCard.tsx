"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "@/lib/utils";
import { isAdminEmail } from "@/lib/adminClient";
import { REACTION_ORDER, ReactionKey, normalizeReactions } from "@/lib/reactions";
import { findAgent } from "@/lib/empireAgents";
import { useMembership } from "@/lib/useMembership";
import ReactionSheet from "./ReactionSheet";
import PromptFile from "./PromptFile";

interface ReactionData {
  count: number;
  reacted: boolean;
}

// Per-category accent. Unknown categories fall back to neon pink so any
// admin-added category (e.g. судалгаа, туслаач, пост) still renders cleanly.
const CATEGORY_COLORS: Record<string, string> = {
  "мэдээлэл": "#1080CA",
  "ялалт": "#1080CA",
  "промт": "#1080CA",
  "бүтээл": "#1080CA",
  "танилцуулга": "#1080CA",
  "судалгаа": "#06B6D4",
  "туслаач": "#14B8A6",
  "пост": "#6b7280",
};
function categoryStyle(name: string | undefined): { color: string; bg: string; label: string } | null {
  if (!name) return null;
  const color = CATEGORY_COLORS[name] || "#1080CA";
  return {
    color,
    bg: `${color}26`, // ~15% alpha
    label: name.toUpperCase(),
  };
}

interface PostCardProps {
  post: {
    _id: string;
    content: string;
    image?: string;
    images?: string[];
    visibility?: string;
    category?: string;
    agentSlug?: string;
    aiPrompt?: string;     // present only when viewer is a paid member
    hasAiPrompt?: boolean; // signals the post has a prompt even if stripped
    video?: string;
    videoDurationSec?: number;
    likes: string[];
    reactions?: Record<string, string[]>;
    commentsCount: number;
    viewsCount?: number;
    createdAt: string;
    authorLevel?: number;
    // Latest comment populated server-side so we can preview it inline
    // without an extra fetch per card. Falls back to lazy-loading on expand.
    latestComment?: {
      _id: string;
      content: string;
      createdAt: string;
      author: { _id: string; name: string; avatar?: string } | null;
    } | null;
    author: {
      _id: string;
      name: string;
      avatar?: string;
      level?: number;
    } | null;
  };
  locked?: boolean;
  onDelete?: (id: string) => void;
}

function levelColor(lvl: number): string {
  if (lvl >= 96) return "#F472B6"; // Legend
  if (lvl >= 81) return "#FF4473"; // Emperor
  if (lvl >= 61) return "#1080CA"; // Entaqor
  if (lvl >= 41) return "#1080CA"; // Conqueror
  if (lvl >= 26) return "#1080CA"; // Entrepreneur
  if (lvl >= 16) return "#1080CA"; // Engineer
  if (lvl >= 6)  return "#1080CA"; // Creator
  return "#5b6573";                 // Punk
}

function LevelChip({ level }: { level: number }) {
  const color = levelColor(level);
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-black leading-none"
      style={{ background: `${color}1F`, color }}
    >
      L{level}
    </span>
  );
}

function buildReactions(post: PostCardProps["post"], userId: string | null): { reactions: Record<ReactionKey, ReactionData>; userReaction: ReactionKey | null } {
  const raw: Record<string, string[]> = { ...(post.reactions || {}) };
  // Fold legacy likes into love if love is empty
  if (post.likes && post.likes.length > 0 && !raw["love"] && !raw["heart"]) {
    raw["love"] = post.likes.map(String);
  }
  const normalized = normalizeReactions(raw);
  const reactions = {} as Record<ReactionKey, ReactionData>;
  let userReaction: ReactionKey | null = null;
  for (const key of REACTION_ORDER) {
    const users = normalized[key];
    const reacted = userId ? users.includes(userId) : false;
    reactions[key] = { count: users.length, reacted };
    if (reacted) userReaction = key;
  }
  return { reactions, userReaction };
}

export default function PostCard({ post, locked, onDelete }: PostCardProps) {
  const { data: session } = useSession();
  const userId = session?.user ? (session.user as { id?: string }).id ?? null : null;
  const userIsAdmin = isAdminEmail(session?.user?.email);
  const initial = useState(() => buildReactions(post, userId))[0];
  const [reactions, setReactions] = useState<Record<ReactionKey, ReactionData>>(initial.reactions);
  const [userReaction, setUserReaction] = useState<ReactionKey | null>(initial.userReaction);
  const [reacting, setReacting] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<ReactionKey | "all">("all");
  const [imgLoaded, setImgLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  const copyPrompt = async () => {
    if (!aiPrompt) return;
    try {
      await navigator.clipboard.writeText(aiPrompt);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 1600);
    } catch {
      // Clipboard blocked — fall back to selection
      const ta = document.createElement("textarea");
      ta.value = aiPrompt;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setPromptCopied(true); window.setTimeout(() => setPromptCopied(false), 1600); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
  };

  const onCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== carouselIndex) setCarouselIndex(idx);
  };

  if (!post.author) return null;

  const canDelete = userId === post.author._id || userIsAdmin;
  const hasText = post.content && post.content.trim().length > 0;
  // Carousel source: prefer `images[]`, fall back to legacy single `image`.
  const allImages: string[] = (Array.isArray(post.images) && post.images.length > 0)
    ? post.images
    : (post.image ? [post.image] : []);
  const hasImage = allImages.length > 0;
  const isMulti = allImages.length > 1;
  // Single short-form video. We don't mix video + image carousel — when both
  // are set, the video wins and images are hidden. Keeps the renderer simple.
  const videoSrc = (post.video || "").trim();
  const hasVideo = videoSrc.length > 0;
  const isLongPost = hasText && post.content.length > 400;
  const displayContent = isLongPost && !expanded ? post.content.slice(0, 400) : post.content;
  const catStyle = categoryStyle(post.category);
  // Prompt-file rendering — promote any post that's either tagged as a prompt
  // OR is over 500 chars (likely a long-form prompt/agent dump) into a copy-
  // friendly file card. Members get full content + copy/download; guests get
  // the locked skeleton with stats.
  const isPromptCategory = post.category === "промт";
  const isPromptFile = hasText && (isPromptCategory || post.content.length > 500);
  // AI-generated posts: detect by category + image. Two signals carry the
  // prompt: (a) post.aiPrompt — only sent to paid members; (b) post.hasAiPrompt
  // — boolean flag the API sets even when the prompt itself is stripped, so
  // non-members can still see the locked teaser.
  const { isMember } = useMembership();
  const aiPrompt = (post.aiPrompt || "").trim();
  const hasAiPrompt = aiPrompt.length > 0 || post.hasAiPrompt === true;
  const isAiPost = post.category === "бүтээл" && hasImage && hasAiPrompt;
  const totalReactions = REACTION_ORDER.reduce((sum, k) => sum + (reactions[k]?.count || 0), 0);

  const handleReaction = async (key: ReactionKey) => {
    if (!session || reacting || locked) return;
    setReacting(true);
    const prev = userReaction;
    const isToggleOff = prev === key;
    const next: Record<ReactionKey, ReactionData> = { ...reactions };
    if (prev) next[prev] = { count: Math.max(0, next[prev].count - 1), reacted: false };
    if (!isToggleOff) next[key] = { count: (next[key]?.count || 0) + 1, reacted: true };
    setReactions(next);
    setUserReaction(isToggleOff ? null : key);

    try {
      const res = await fetch(`/api/posts/${post._id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: key }),
      });
      const data = await res.json();
      if (res.ok) {
        setReactions(data.reactions);
        setUserReaction(data.userReaction ?? null);
      } else {
        setReactions(reactions);
        setUserReaction(prev);
      }
    } finally {
      setReacting(false);
    }
  };

  const openSheet = (tab: ReactionKey | "all") => {
    setSheetTab(tab);
    setSheetOpen(true);
  };

  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!confirm("Энэ постыг устгах уу?")) return;
    const res = await fetch(`/api/posts/${post._id}`, { method: "DELETE" });
    if (!res.ok) return;
    // Entropy dissolve — glitch-shake → blur → fade, then notify parent
    // to remove from list. Total ~520ms; parent unmount is instant after.
    setDeleting(true);
    setTimeout(() => { onDelete?.(post._id); }, 480);
  };

  // ─── Agent persona override ───
  // When post.agentSlug is set, the post was authored *as* that empire agent.
  // We render the agent's identity (name/avatar/color/link) instead of the
  // underlying admin user — same Post doc, two presentations.
  const agentInfo = post.agentSlug ? findAgent(post.agentSlug) : undefined;
  const displayName = agentInfo ? agentInfo.name : post.author.name;
  const displayHandle = agentInfo ? agentInfo.handle : "";
  const displayHref = agentInfo ? `/agents/${agentInfo.slug}` : `/profile/${post.author._id}`;
  const agentColor = agentInfo?.color || "#1080CA";

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (locked) {
    return (
      <article className="rounded-none border-0 border-b border-[#2E2E33] bg-transparent p-5">
        <div className="flex items-center gap-3 mb-4">
          {agentInfo ? (
            <div
              className="grid h-9 w-9 place-items-center rounded-full font-mono text-[13px] font-black"
              style={{
                background: `linear-gradient(135deg, ${agentColor}33, ${agentColor}11)`,
                color: agentColor,
                border: `1px solid ${agentColor}55`,
              }}
            >
              {displayName.slice(0, 1)}
            </div>
          ) : post.author.avatar ? (
            <img src={post.author.avatar} alt={displayName} loading="lazy" decoding="async" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E1E21] text-[11px] font-bold text-[#6b7280]">{initials}</div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold text-[#FFFFFF]">{displayName}</p>
              {agentInfo ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[8px] font-black tracking-[0.18em]"
                  style={{ background: `${agentColor}1F`, color: agentColor }}
                >
                  AGENT
                </span>
              ) : (() => {
                const lvl = post.authorLevel ?? post.author.level ?? 0;
                return lvl > 0 ? <LevelChip level={lvl} /> : null;
              })()}
            </div>
            <p className="text-[11px] text-[#6b7280]">{formatDistanceToNow(post.createdAt)}</p>
          </div>
        </div>
        <div className="relative">
          <div className="select-none blur-[6px]">
            <p className="text-[14px] text-[#6b7280]">
              {post.content?.slice(0, 120) || "Энэ нийтлэлийн агуулгыг зөвхөн гишүүд харах боломжтой..."}
            </p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[12px] font-medium text-[#6b7280]">Гишүүдэд зориулсан</span>
            <Link href="/pricing" className="mt-2 text-[12px] font-bold text-[#1080CA]">
              Гишүүн болох
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <motion.article
      animate={
        deleting
          ? {
              opacity: [1, 0.7, 0],
              scale: [1, 0.985, 0.92],
              x: [0, 6, -6, 4, 0],
              filter: ["blur(0px)", "blur(2px)", "blur(8px)"],
              borderColor: ["rgba(255,255,255,0.06)", "rgba(16,128,202,0.45)", "rgba(16,128,202,0)"],
            }
          : { opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }
      }
      transition={
        deleting
          ? { duration: 0.48, times: [0, 0.4, 1], ease: [0.42, 0, 0.58, 1] }
          : { duration: 0 }
      }
      style={{ pointerEvents: deleting ? "none" : "auto" }}
      className="border-0 border-b border-[#2E2E33] bg-transparent transition-colors duration-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 sm:px-5">
        <Link href={displayHref} className="flex items-center gap-2.5 min-w-0">
          {agentInfo ? (
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-[13px] font-black"
              style={{
                background: `linear-gradient(135deg, ${agentColor}33, ${agentColor}11)`,
                color: agentColor,
                border: `1px solid ${agentColor}55`,
              }}
            >
              {displayName.slice(0, 1)}
            </div>
          ) : post.author.avatar ? (
            <img src={post.author.avatar} alt={displayName} loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E1E21] text-[11px] font-bold text-[#6b7280]">{initials}</div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[13px] font-semibold text-[#FFFFFF] truncate">{displayName}</p>
              {agentInfo ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[8px] font-black tracking-[0.18em]"
                  style={{ background: `${agentColor}1F`, color: agentColor }}
                >
                  <span className="inline-block h-[4px] w-[4px] animate-pulse rounded-full" style={{ background: agentColor }} />
                  AGENT
                </span>
              ) : (
                (() => {
                  // Only surface the level chip once a user is past the
                  // baseline (level 1) — avoids "LVL 1" noise on every post.
                  const lvl = post.authorLevel ?? post.author.level ?? 0;
                  return lvl > 1 ? <LevelChip level={lvl} /> : null;
                })()
              )}
              {catStyle && !agentInfo && (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold"
                  style={{ background: catStyle.bg, color: catStyle.color }}
                >
                  {catStyle.label}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#94a3b8]">
              {agentInfo ? <span className="font-mono">{displayHandle} · </span> : null}
              {formatDistanceToNow(post.createdAt)}
            </p>
          </div>
        </Link>

        {canDelete && (
          <button onClick={handleDelete} className="shrink-0 rounded-full p-2 text-[#94a3b8] transition hover:bg-[rgba(255,255,255,0.04)] hover:text-[#84848C]" aria-label="Устгах">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      {hasText && !isPromptFile && (
        <div className="px-4 mt-2.5 sm:px-5">
          <Link href={`/posts/${post._id}`} className="block">
            <p className="whitespace-pre-wrap text-[14px] leading-[1.7] text-[#F2F2F4]">
              {displayContent}
            </p>
          </Link>
          {isLongPost && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-1 text-[13px] font-medium text-[#1080CA] transition-colors duration-200 hover:text-[#1080CA]"
            >
              Цааш унших...
            </button>
          )}
        </div>
      )}

      {/* Prompt file — long-form prompts render as a copy-friendly file card */}
      {hasText && isPromptFile && (
        <div className="mt-2.5 px-4 sm:px-5">
          <PromptFile
            text={post.content}
            category={post.category}
            authorName={post.author?.name}
            unlocked={!!isMember}
          />
        </div>
      )}

      {/* Short-form video — wins over images when both fields are set.
          metadata-only preload + playsInline keeps mobile data use polite. */}
      {hasVideo && (
        <div className="relative mx-auto mt-3 aspect-[3/4] max-w-[460px] overflow-hidden rounded-none bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={videoSrc}
            poster={videoSrc.match(/\/vid-[a-f0-9-]+\.mp4$/) ? videoSrc.replace(/\.mp4$/, "-poster.jpg") : undefined}
            controls
            playsInline
            preload="metadata"
            controlsList="nodownload noplaybackrate"
            disableRemotePlayback
            disablePictureInPicture
            className="absolute inset-0 h-full w-full object-cover"
          />
          {post.videoDurationSec && post.videoDurationSec > 0 && (
            <span className="absolute bottom-2 right-2 rounded-none bg-black/70 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white backdrop-blur-sm">
              0:{String(post.videoDurationSec).padStart(2, "0")}
            </span>
          )}
        </div>
      )}

      {/* Single image — keep native aspect, max 600px height */}
      {!hasVideo && hasImage && !isMulti && (
        <Link href={`/posts/${post._id}`} className="block mt-3">
          <div className="relative overflow-hidden bg-[#161618]">
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2 w-2 animate-pulse-gold rounded-full bg-[#1080CA]" />
              </div>
            )}
            <img
              src={allImages[0]}
              alt="Пост"
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.retried) {
                  img.dataset.retried = "1";
                  img.src = img.src + (img.src.includes("?") ? "&" : "?") + "t=" + Date.now();
                } else {
                  setImgLoaded(true);
                  img.style.display = "none";
                }
              }}
              className="w-full object-cover"
              style={{ maxHeight: "600px", minHeight: imgLoaded ? undefined : "200px", opacity: imgLoaded ? 1 : 0.01 }}
            />
          </div>
        </Link>
      )}

      {/* Multi-image carousel — Threads-style scroll-snap, fixed 4:5 aspect */}
      {!hasVideo && isMulti && (
        <div className="relative mt-3">
          <div
            ref={carouselRef}
            onScroll={onCarouselScroll}
            className="flex aspect-[4/5] w-full snap-x snap-mandatory overflow-x-auto bg-[#161618] scrollbar-hide"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {allImages.map((src, i) => (
              <Link
                key={i}
                href={`/posts/${post._id}`}
                className="relative flex h-full w-full shrink-0 snap-start snap-always"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Зураг ${i + 1}`}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </Link>
            ))}
          </div>

          {/* Counter — top-right */}
          <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-black tabular-nums text-white backdrop-blur-md">
            {carouselIndex + 1} / {allImages.length}
          </div>

          {/* Dots — bottom-center */}
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
            {allImages.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all duration-200"
                style={{
                  width: i === carouselIndex ? "16px" : "6px",
                  background: i === carouselIndex ? "#1080CA" : "rgba(255,255,255,0.45)",
                  boxShadow: i === carouselIndex ? "0 0 8px rgba(16,128,202,0.6)" : "none",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── AI prompt card — gated by paid membership ─── */}
      {isAiPost && hasAiPrompt && (
        <div className="px-3 pt-3 sm:px-4">
          {isMember || aiPrompt ? (
            // ── MEMBER VIEW: real prompt with copy + use buttons ──
            <div className="overflow-hidden rounded-none border border-[rgba(16,128,202,0.18)] bg-gradient-to-br from-[rgba(16,128,202,0.04)] via-[#f2f5f8] to-[#f2f5f8]">
              <button
                type="button"
                onClick={() => setPromptOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-[rgba(16,128,202,0.04)]"
              >
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-[#1080CA]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  <span className="font-mono text-[10px] font-black tracking-[0.2em] text-[#1080CA]">AI ПРОМПТ</span>
                  {!promptOpen && (
                    <span className="ml-1 truncate text-[11px] text-[#6b7280] sm:text-[12px]" style={{ maxWidth: 220 }}>
                      {aiPrompt.slice(0, 80)}{aiPrompt.length > 80 ? "…" : ""}
                    </span>
                  )}
                </span>
                <svg className={`h-3 w-3 text-[#6b7280] transition-transform ${promptOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {promptOpen && aiPrompt && (
                <div className="border-t border-[rgba(16,128,202,0.12)] p-3">
                  <p className="mb-3 max-h-[200px] overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed text-[#FFFFFF]">
                    {aiPrompt}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={copyPrompt}
                      className="inline-flex items-center gap-1 rounded-none border border-[rgba(255,255,255,0.1)] bg-[#161618] px-2.5 py-1 font-mono text-[10px] font-black tracking-[0.18em] text-[#FFFFFF] transition hover:border-[#1080CA] hover:text-[#1080CA]"
                    >
                      {promptCopied ? (
                        <><svg className="h-3 w-3 text-[#4FE065]" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> COPIED</>
                      ) : (
                        <><svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> COPY</>
                      )}
                    </button>
                    <Link
                      href={`/tools/nano-banano?prompt=${encodeURIComponent(aiPrompt)}`}
                      className="inline-flex items-center gap-1 rounded-none bg-[#1080CA] px-2.5 py-1 font-mono text-[10px] font-black tracking-[0.18em] text-[#0E0E10] transition hover:bg-[#FF3D69]"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      USE PROMPT
                    </Link>
                    <span className="ml-auto font-mono text-[9px] tracking-wide text-[#94a3b8]">{aiPrompt.length} chars</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // ── NON-MEMBER VIEW: skeleton lock with CTA ──
            <Link
              href="/auth/signup"
              className="group block overflow-hidden rounded-none border border-[rgba(16,128,202,0.22)] bg-gradient-to-br from-[rgba(16,128,202,0.06)] via-[#f2f5f8] to-[#f2f5f8] p-3 transition hover:border-[#1080CA]"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-[#1080CA]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <span className="font-mono text-[10px] font-black tracking-[0.2em] text-[#1080CA]">AI ПРОМПТ · ТҮГЖЭЭТЭЙ</span>
                </span>
                <span className="font-mono text-[9px] tracking-[0.18em] text-[#6b7280] transition group-hover:text-[#1080CA]">
                  ГИШҮҮН БОЛОХ →
                </span>
              </div>
              {/* Skeleton lines hint at content shape without leaking the prompt */}
              <div className="space-y-1.5">
                <div className="h-2 w-[88%] animate-pulse rounded-full bg-[rgba(16,128,202,0.12)]" />
                <div className="h-2 w-[72%] animate-pulse rounded-full bg-[rgba(16,128,202,0.10)]" style={{ animationDelay: "120ms" }} />
                <div className="h-2 w-[56%] animate-pulse rounded-full bg-[rgba(16,128,202,0.08)]" style={{ animationDelay: "240ms" }} />
              </div>
              <p className="mt-2 text-[11px] leading-snug text-[#6b7280]">
                Промпт зөвхөн <span className="font-bold text-[#FFFFFF]">Edgerunners</span> гишүүдэд нээлттэй. Хуулж, өөрчилж, дахин үүсгэх боломжтой.
              </p>
            </Link>
          )}
        </div>
      )}

      {/* Multi-emoji summary strip removed — single-heart count lives on the action row. */}

      {/* Single heart toggle + comments — Threads-style minimal action row */}
      <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
        {(() => {
          // Map all legacy reactions into one "liked" signal so users with
          // historical fire/handshake/muscle reactions still see the heart lit.
          const liked = !!userReaction;
          // Total across all reaction kinds — feels honest even though the UI
          // only offers a heart now.
          const total = totalReactions;
          return (
            <motion.button
              type="button"
              onClick={() => handleReaction("love")}
              disabled={!session || reacting || locked}
              aria-label="Хайрлах"
              whileTap={{ scale: 0.85 }}
              className="inline-flex items-center gap-1.5 rounded-none px-2 py-1 transition disabled:opacity-50"
              style={liked ? { color: "#1080CA" } : { color: "#6b7280" }}
            >
              <motion.svg
                className="h-[22px] w-[22px]"
                fill={liked ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={liked ? 0 : 1.6}
                viewBox="0 0 24 24"
                animate={
                  liked
                    ? { scale: [1, 1.35, 0.95, 1.1, 1], rotate: [0, -8, 6, -3, 0] }
                    : { scale: 1, rotate: 0 }
                }
                transition={{ duration: 0.5, ease: [0.4, 0, 0.6, 1] }}
                style={
                  liked
                    ? { filter: "drop-shadow(0 0 6px rgba(16,128,202,0.55)) drop-shadow(0 0 14px rgba(16,128,202,0.3))" }
                    : undefined
                }
              >
                {/* Geometric "love" — angular hexagonal heart, Tesla-clean */}
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4 L18 8 L18 13 L12 21 L6 13 L6 8 Z" />
              </motion.svg>
              {total > 0 && (
                <motion.span
                  key={total}
                  initial={{ scale: 0.7, opacity: 0, y: 4 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-[12px] font-bold tabular-nums"
                >
                  {total}
                </motion.span>
              )}
            </motion.button>
          );
        })()}
        <Link
          href={`/posts/${post._id}`}
          className="flex items-center gap-1.5 rounded-none px-2 py-1 text-[#6b7280] transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F2F2F4]"
        >
          <svg className="h-[20px] w-[20px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
            {/* Geometric square chat bubble with chevron tail */}
            <path strokeLinecap="round" strokeLinejoin="miter" d="M4 5 H20 V15 H11 L7 19 V15 H4 Z" />
          </svg>
          {typeof post.viewsCount === "number" && post.viewsCount > 0 && (
            <span className="mr-2 flex items-center gap-1 text-[11px] tabular-nums text-[#84848C]" title="Үзсэн">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
              {post.viewsCount}
            </span>
          )}
          {post.commentsCount > 0 && (
            <span className="text-[12px] font-semibold tabular-nums">{post.commentsCount}</span>
          )}
        </Link>

        <div className="ml-auto flex items-center gap-2">
        {/* ChatGPT vision — analyze the image, return structured prompt.
            Only shown when there is an image to analyze. */}
        {((post.images && post.images.length > 0) || post.image) && (
          <button
            type="button"
            onClick={() => setAnalyzeOpen((v) => !v)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-none border transition-all duration-200 ${
              analyzeOpen
                ? "border-[rgba(16,128,202,0.5)] bg-[rgba(16,128,202,0.08)] text-[#1080CA]"
                : "border-[rgba(255,255,255,0.06)] bg-transparent text-[#6b7280] hover:border-[rgba(16,128,202,0.4)] hover:text-[#1080CA]"
            }`}
            aria-label="Зураг шинжлэх (ChatGPT)"
            title="Зураг шинжлэх (ChatGPT)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M22.408 9.80741C22.9487 8.17778 22.7685 6.37037 21.8974 4.88889C20.5758 2.60741 17.9024 1.45185 15.2891 1.98519C14.1477 0.711111 12.4656 0 10.7234 0C8.0501 0 5.70717 1.68889 4.86612 4.17778C3.15398 4.53333 1.68214 5.57037 0.811051 7.08148C-0.510601 9.36296 -0.210226 12.2074 1.56199 14.163C1.02131 15.8222 1.23158 17.6 2.10267 19.0815C3.42432 21.363 6.09766 22.5481 8.71093 21.9852C9.88239 23.2593 11.5345 24 13.2766 24C15.95 24 18.2929 22.3111 19.134 19.8222C20.8461 19.4667 22.3179 18.4296 23.189 16.9185C24.5107 14.637 24.2103 11.763 22.408 9.80741ZM13.2766 22.4296C12.1953 22.4296 11.174 22.0741 10.363 21.3926C10.393 21.363 10.4831 21.3333 10.5132 21.3037L15.3492 18.5481C15.5895 18.4 15.7397 18.163 15.7397 17.8667V11.1407L17.7823 12.2963C17.8123 12.2963 17.8123 12.3259 17.8123 12.3556V17.9259C17.8423 20.4148 15.7998 22.4296 13.2766 22.4296ZM3.48439 18.3111C2.94372 17.3926 2.76349 16.3259 2.94372 15.2889C2.97375 15.3185 3.03383 15.3481 3.0939 15.3778L7.92995 18.1333C8.17025 18.2815 8.47063 18.2815 8.71093 18.1333L14.6283 14.7556V17.0963C14.6283 17.1259 14.6283 17.1556 14.5983 17.1556L9.70216 19.9407C7.53946 21.1852 4.74597 20.4444 3.48439 18.3111ZM2.22282 7.88148C2.76349 6.96296 3.60454 6.28148 4.59578 5.8963V11.5852C4.59578 11.8519 4.74597 12.1185 4.98627 12.2667L10.9037 15.6444L8.86111 16.8C8.83108 16.8 8.80104 16.8296 8.80104 16.8L3.90492 14.0148C1.68214 12.7704 0.961239 10.0148 2.22282 7.88148ZM19.0438 11.7333L13.1264 8.35556L15.169 7.2C15.199 7.2 15.2291 7.17037 15.2291 7.2L20.1252 9.98519C22.3179 11.2296 23.0388 13.9852 21.7773 16.1185C21.2366 17.037 20.3955 17.7185 19.4043 18.0741V12.4148C19.4343 12.1481 19.2841 11.8815 19.0438 11.7333ZM21.0564 8.71111C21.0263 8.68148 20.9662 8.65185 20.9062 8.62222L16.0701 5.86667C15.8298 5.71852 15.5294 5.71852 15.2891 5.86667L9.37175 9.24444V6.9037C9.37175 6.87407 9.37175 6.84444 9.40179 6.84444L14.2979 4.05926C16.4906 2.81481 19.2541 3.55556 20.5157 5.71852C21.0564 6.60741 21.2366 7.67407 21.0564 8.71111ZM8.26036 12.8593L6.21781 11.7037C6.18777 11.7037 6.18777 11.6741 6.18777 11.6444V6.07407C6.18777 3.58519 8.23032 1.57037 10.7535 1.57037C11.8348 1.57037 12.8561 1.92593 13.6671 2.60741C13.6371 2.63704 13.577 2.66667 13.5169 2.6963L8.68089 5.45185C8.44059 5.6 8.2904 5.83704 8.2904 6.13333V12.8593H8.26036ZM9.37175 10.4889L12.0151 8.97778L14.6584 10.4889V13.4815L12.0151 14.9926L9.37175 13.4815V10.4889Z" />
            </svg>
          </button>
        )}

        {/* Grok / Ask-AI button removed per request — AskAiPanel stays mounted (closed). */}
        </div>
      </div>

      {/* ─── ChatGPT vision analysis panel ───────────────────────────── */}
      <AnalyzeImagePanel
        postId={post._id}
        open={analyzeOpen}
        onClose={() => setAnalyzeOpen(false)}
        thumbnail={(post.images && post.images[0]) || post.image || null}
      />

      {/* ─── Ask-AI inline panel ─────────────────────────────────────── */}
      <AskAiPanel postId={post._id} open={askOpen} onClose={() => setAskOpen(false)} />

      {/* ─── Inline comments — Threads-style preview + expand ─────────── */}
      <CommentsThread
        postId={post._id}
        commentsCount={post.commentsCount}
        latestComment={post.latestComment ?? null}
      />

      <ReactionSheet
        open={sheetOpen}
        postId={post._id}
        initialTab={sheetTab}
        onClose={() => setSheetOpen(false)}
      />
    </motion.article>
  );
}

// ─── ChatGPT vision panel — analyze the post's image, return structured ─
// Sends the post's first image to /api/posts/[id]/analyze-image (server
// proxies to OpenAI gpt-4o-mini vision). Renders the JSON response in
// labeled sections with a one-click copy on the generated prompt.
interface ImageAnalysis {
  description?: string;
  subject?: string;
  colorTone?: string;
  lighting?: string;
  pose?: string;
  angle?: string;
  composition?: string;
  style?: string;
  prompt?: string;
}
function AnalyzeImagePanel({
  postId,
  open,
  onClose,
  thumbnail,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
  thumbnail: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<ImageAnalysis | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const ranOnceRef = useRef(false);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/posts/${postId}/analyze-image`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || "Шинжлэх боломжгүй");
        return;
      }
      setData(j.analysis as ImageAnalysis);
    } catch {
      setErr("Сүлжээний алдаа");
    } finally {
      setBusy(false);
    }
  };

  // Auto-run on first open; subsequent opens reuse cached result.
  useState(() => {
    if (open && !ranOnceRef.current) {
      ranOnceRef.current = true;
      run();
    }
  });
  // Open after mount → kick off
  if (open && !ranOnceRef.current && !busy && !data && !err) {
    ranOnceRef.current = true;
    run();
  }

  const copy = async () => {
    if (!data?.prompt) return;
    try {
      await navigator.clipboard.writeText(data.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  if (!open) return null;
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden border-t border-[rgba(16,128,202,0.18)] bg-[rgba(16,128,202,0.025)]"
    >
      <div className="px-3 py-3 sm:px-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.26em] text-[#1080CA]">
            <span className="h-1 w-1 rotate-45 bg-[#1080CA] shadow-[0_0_6px_#1080CA]" />
            CHATGPT VISION · ЗУРГИЙН АНАЛИЗ
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#6b7280] transition hover:text-[#1080CA]"
          >
            ✕ ХААХ
          </button>
        </div>

        {busy ? (
          <div className="flex items-center gap-2 rounded-none border border-[rgba(16,128,202,0.2)] bg-[#0a0a0c] p-3">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1080CA]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#6b7280]">CHATGPT ЗУРГИЙГ ШИНЖЛЭЖ БАЙНА...</span>
          </div>
        ) : err ? (
          <div className="rounded-none border border-[#1080CA]/30 bg-[#1080CA]/5 px-2.5 py-1.5 text-[11px] text-[#8FC1EA]">{err}</div>
        ) : data ? (
          <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
            {thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnail} alt="" className="h-[100px] w-[100px] rounded-none border border-[rgba(255,255,255,0.06)] object-cover sm:h-[120px] sm:w-[100px]" loading="lazy" />
            )}
            <div className="space-y-2 text-[12px]">
              {data.description && (
                <AnalysisRow label="DESCRIPTION" value={data.description} />
              )}
              <div className="grid grid-cols-2 gap-2">
                {data.subject && <AnalysisRow label="SUBJECT" value={data.subject} compact />}
                {data.style && <AnalysisRow label="STYLE" value={data.style} compact />}
                {data.colorTone && <AnalysisRow label="COLOR TONE" value={data.colorTone} compact />}
                {data.lighting && <AnalysisRow label="LIGHTING" value={data.lighting} compact />}
                {data.pose && <AnalysisRow label="POSE" value={data.pose} compact />}
                {data.angle && <AnalysisRow label="ANGLE" value={data.angle} compact />}
                {data.composition && <AnalysisRow label="COMPOSITION" value={data.composition} compact span2 />}
              </div>
              {data.prompt && (
                <div className="mt-2 rounded-none border border-[rgba(16,128,202,0.3)] bg-[rgba(16,128,202,0.04)] p-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#1080CA]">
                      ▶ GENERATED PROMPT
                    </span>
                    <button
                      type="button"
                      onClick={copy}
                      className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#6b7280] transition hover:text-[#1080CA]"
                    >
                      {copied ? "✓ ХУУЛАГДЛАА" : "📋 ХУУЛАХ"}
                    </button>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-[#F2F2F4]">{data.prompt}</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
function AnalysisRow({ label, value, compact = false, span2 = false }: { label: string; value: string; compact?: boolean; span2?: boolean }) {
  return (
    <div className={`rounded-none border border-[rgba(255,255,255,0.05)] bg-[#1E1E21] p-2 ${span2 ? "col-span-2" : ""}`}>
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#6b7280]">{label}</p>
      <p className={`mt-0.5 ${compact ? "text-[12px]" : "text-[12.5px]"} leading-snug text-[#F2F2F4]`}>{value}</p>
    </div>
  );
}

// ─── Comments thread — Threads-style inline preview + expand + reply ────
// Renders the latest comment inline below the post. Tap "Show more" to
// fetch + reveal the rest. Reply input lives at the bottom of the expanded
// view; new comments prepend optimistically.
interface InlineComment {
  _id: string;
  content: string;
  createdAt: string;
  author: { _id?: string; name: string; avatar?: string } | null;
}
function relativeTime(s: string): string {
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "одоо";
  if (m < 60) return `${m}м`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}ц`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}ө`;
  return new Date(s).toLocaleDateString("mn-MN", { month: "short", day: "numeric" });
}
function CommentsThread({
  postId,
  commentsCount,
  latestComment,
}: {
  postId: string;
  commentsCount: number;
  latestComment: InlineComment | null;
}) {
  const { data: session } = useSession();
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<InlineComment[]>(latestComment ? [latestComment] : []);
  const [count, setCount] = useState(commentsCount);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.comments)) {
        setComments(data.comments as InlineComment[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const expand = async () => {
    setExpanded(true);
    if (comments.length < count) await fetchAll();
  };

  const submit = async () => {
    const content = text.trim();
    if (!content || posting || !session) return;
    setPosting(true);
    setErr("");
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Илгээж чадсангүй");
        return;
      }
      // Prepend new comment, bump count
      if (data.comment) setComments((prev) => [data.comment, ...prev]);
      setCount((n) => n + 1);
      setText("");
    } finally {
      setPosting(false);
    }
  };

  // Latest preview when collapsed
  const preview = comments[0] || latestComment;

  return (
    <div className="border-t border-[rgba(255,255,255,0.04)]">
      {/* Collapsed preview — single latest comment */}
      {!expanded && preview && (
        <button
          type="button"
          onClick={expand}
          className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition hover:bg-[rgba(255,255,255,0.025)] sm:px-4"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1E1E21] text-[10px] font-bold text-[#84848C]">
            {preview.author?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.author.avatar} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              (preview.author?.name?.[0] || "?").toUpperCase()
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="truncate text-[12px] font-bold text-[#FFFFFF]">{preview.author?.name || "Хэн нэгэн"}</span>
              <span className="font-mono text-[10px] tabular-nums text-[#94a3b8]">{relativeTime(preview.createdAt)}</span>
            </div>
            <p className="line-clamp-2 text-[12px] leading-snug text-[#9aa]">{preview.content}</p>
          </div>
        </button>
      )}

      {/* "Show more" CTA — only when there are unseen comments */}
      {!expanded && count > 1 && (
        <button
          type="button"
          onClick={expand}
          className="flex w-full items-center gap-1.5 border-t border-[rgba(255,255,255,0.03)] px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#6b7280] transition hover:bg-[rgba(255,255,255,0.025)] hover:text-[#1080CA] sm:px-4"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          ӨӨР {count - 1} СЭТГЭГДЭЛ
        </button>
      )}

      {/* No comments yet — show only reply input via collapse-to-expand */}
      {!expanded && !preview && session && commentsCount === 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#6b7280] transition hover:bg-[rgba(255,255,255,0.025)] hover:text-[#1080CA] sm:px-4"
        >
          + СЭТГЭГДЭЛ БИЧИХ
        </button>
      )}

      {/* Expanded list + reply input */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-3 py-3 sm:px-4">
              {/* Header w/ collapse */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.26em] text-[#1080CA]">
                  ▶ СЭТГЭГДЭЛ · {count}
                </span>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#6b7280] transition hover:text-[#1080CA]"
                >
                  ✕ ХУРААХ
                </button>
              </div>

              {loading && comments.length === 0 ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="flex gap-2">
                      <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-[#1E1E21]" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 w-1/3 animate-pulse rounded bg-[#1E1E21]" />
                        <div className="h-3 w-3/4 animate-pulse rounded bg-[#1E1E21]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <p className="py-2 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[#94a3b8]">
                  СЭТГЭГДЭЛ ХООСОН
                </p>
              ) : (
                <ul className="space-y-3">
                  {comments.map((c) => (
                    <motion.li
                      key={c._id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-start gap-2"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1E1E21] text-[10px] font-bold text-[#84848C]">
                        {c.author?.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.author.avatar} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          (c.author?.name?.[0] || "?").toUpperCase()
                        )}
                      </span>
                      <div className="min-w-0 flex-1 rounded-none bg-[rgba(255,255,255,0.025)] px-2.5 py-1.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="truncate text-[12px] font-bold text-[#FFFFFF]">{c.author?.name || "Хэн нэгэн"}</span>
                          <span className="font-mono text-[10px] tabular-nums text-[#94a3b8]">{relativeTime(c.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-[#F2F2F4]">{c.content}</p>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}

              {/* Reply input */}
              {session ? (
                <div className="flex items-end gap-2 pt-1">
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 500))}
                    onKeyDown={(e) => { if (e.key === "Enter" && !posting) submit(); }}
                    placeholder="Сэтгэгдэл бичих..."
                    disabled={posting}
                    className="flex-1 rounded-none border border-[rgba(255,255,255,0.08)] bg-[#1E1E21] px-3 py-2 text-[14px] text-[#FFFFFF] placeholder:text-[#94a3b8] focus:border-[#1080CA] focus:outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={submit}
                    disabled={posting || text.trim().length === 0}
                    className="shrink-0 rounded-none bg-[#1080CA] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0E0E10] transition hover:shadow-[0_0_14px_rgba(16,128,202,0.4)] disabled:cursor-not-allowed disabled:bg-[#1E1E21] disabled:text-[#94a3b8] disabled:shadow-none"
                  >
                    {posting ? "..." : "ИЛГЭЭХ"}
                  </button>
                </div>
              ) : (
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#94a3b8]">
                  Сэтгэгдэл бичихийн тулд нэвтрэнэ үү
                </p>
              )}

              {err && (
                <p className="rounded-none border border-[#1080CA]/30 bg-[#1080CA]/5 px-2.5 py-1.5 text-[11px] text-[#8FC1EA]">{err}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Ask AI inline panel — Grok-powered Q&A about a single post ────────
// Mounted under the action row. Slides open with a small spring, sends the
// question + post context to /api/posts/[id]/ask-ai (server proxies Grok
// via XAI_API_KEY) and renders the answer inline.
function AskAiPanel({ postId, open, onClose }: { postId: string; open: boolean; onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const q = question.trim();
    if (q.length < 2 || busy) return;
    setBusy(true);
    setError("");
    setAnswer("");
    try {
      const res = await fetch(`/api/posts/${postId}/ask-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Алдаа гарлаа");
        return;
      }
      setAnswer(data.answer || "");
    } catch {
      setError("Сүлжээний алдаа");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden border-t border-[rgba(16,128,202,0.18)] bg-[rgba(16,128,202,0.025)]"
    >
      <div className="px-3 py-3 sm:px-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.26em] text-[#1080CA]">
            <span className="h-1 w-1 rotate-45 bg-[#1080CA] shadow-[0_0_6px_#1080CA]" />
            ASK AI · GROK
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#6b7280] transition hover:text-[#1080CA]"
          >
            ✕ ХААХ
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Энэ постын талаар асуу..."
            disabled={busy}
            className="flex-1 rounded-none border border-[rgba(255,255,255,0.08)] bg-[#1E1E21] px-3 py-2 text-[14px] text-[#FFFFFF] placeholder:text-[#94a3b8] focus:border-[#1080CA] focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || question.trim().length < 2}
            className="shrink-0 rounded-none bg-[#1080CA] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0E0E10] transition hover:shadow-[0_0_14px_rgba(16,128,202,0.4)] disabled:cursor-not-allowed disabled:bg-[#1E1E21] disabled:text-[#94a3b8] disabled:shadow-none"
          >
            {busy ? "..." : "АСУУХ →"}
          </button>
        </div>

        {error && (
          <p className="mt-2 rounded-none border border-[#1080CA]/30 bg-[#1080CA]/5 px-2.5 py-1.5 text-[11px] text-[#8FC1EA]">{error}</p>
        )}

        {(busy || answer) && (
          <div className="mt-3 rounded-none border border-[rgba(16,128,202,0.18)] bg-[#0a0a0c] p-3">
            {busy ? (
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1080CA]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#6b7280]">GROK БОДОЖ БАЙНА...</span>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#F2F2F4]">{answer}</p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
