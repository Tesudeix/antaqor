"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "@/lib/utils";
import { isAdminEmail } from "@/lib/adminClient";
import { REACTION_ORDER, ReactionKey, normalizeReactions } from "@/lib/reactions";
import { findAgent } from "@/lib/empireAgents";
import { useAgentDirectory } from "@/lib/useAgentDirectory";
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
  "мэдээлэл": "#2E29FF",
  "ялалт": "#2E29FF",
  "промт": "#2E29FF",
  "бүтээл": "#2E29FF",
  "танилцуулга": "#2E29FF",
  "судалгаа": "#06B6D4",
  "туслаач": "#14B8A6",
  "пост": "#E2E4E8",
};
function categoryStyle(name: string | undefined): { color: string; bg: string; label: string } | null {
  if (!name) return null;
  const color = CATEGORY_COLORS[name] || "#2E29FF";
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
    pinned?: boolean;
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
  /** "stream" — hairline-divided full-width урсгал (default, post/profile хуудас).
   *  "boxed"  — feed dashboard-ийн хүрээтэй карт. */
  variant?: "stream" | "boxed";
}

function levelColor(lvl: number): string {
  if (lvl >= 96) return "#F472B6"; // Legend
  if (lvl >= 81) return "#FF4473"; // Emperor
  if (lvl >= 61) return "#2E29FF"; // Entaqor
  if (lvl >= 41) return "#2E29FF"; // Conqueror
  if (lvl >= 26) return "#2E29FF"; // Entrepreneur
  if (lvl >= 16) return "#2E29FF"; // Engineer
  if (lvl >= 6)  return "#2E29FF"; // Creator
  return "#E2E4E8";                 // Punk
}

function LevelChip({ level }: { level: number }) {
  const color = levelColor(level);
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-[4px] px-1.5 py-0.5 text-[8px] font-black leading-none"
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

export default function PostCard({ post, locked, onDelete, variant = "stream" }: PostCardProps) {
  const boxed = variant === "boxed";
  // Картын бүрхүүл — доторх бүтэц хоёр хувилбарт ижил, зөвхөн хүрээ/дэвсгэр солигдоно.
  const shellClass = boxed
    ? "bg-[#141414] bg-[#0A0A0A]"
    : "border-0 border-b border-[#262626] bg-transparent";
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
  const [pinned, setPinned] = useState(!!post.pinned);
  const [pinning, setPinning] = useState(false);

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
  /* Дээр тогтоох — зөвхөн админ. Сервер мөн адил админ эсэхийг шалгана;
     энэ нь UI-ийн тав тух, хамгаалалт биш. */
  const togglePin = async () => {
    if (pinning) return;
    setPinning(true);
    const next = !pinned;
    try {
      const res = await fetch(`/api/posts/${post._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: next }),
      });
      if (res.ok) setPinned(next);
    } finally {
      setPinning(false);
    }
  };

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
  /* Кодын өгөгдмөл + админаас байршуулсан ЗУРАГ. `findAgent` дангаараа
     хангалтгүй: тэнд эзний оруулсан зураг хэзээ ч байхгүй тул урсгал дээр
     агент зөвхөн үсгэн хавтангаар харагддаг байв. Лавлах ирээгүй үед
     кодын хувилбар руу буцна — пост ямар ч тохиолдолд зурагдана. */
  const directory = useAgentDirectory();
  const agentBase = post.agentSlug ? findAgent(post.agentSlug) : undefined;
  const agentOverride = post.agentSlug ? directory[post.agentSlug] : undefined;
  const agentInfo = agentBase || agentOverride
    ? { ...(agentBase || {}), ...(agentOverride || {}) } as { slug: string; name: string; handle: string; color: string; avatar?: string }
    : undefined;
  const displayName = agentInfo ? agentInfo.name : post.author.name;
  const displayHandle = agentInfo ? agentInfo.handle : "";
  const displayHref = agentInfo ? `/agents/${agentInfo.slug}` : `/profile/${post.author._id}`;
  const agentColor = agentInfo?.color || "#2E29FF";
  const agentAvatar = agentInfo?.avatar || "";

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (locked) {
    return (
      <article className={`rounded-[4px] p-5 ${shellClass}`}>
        <div className="flex items-center gap-3 mb-4">
          {agentInfo ? (
            agentAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={agentAvatar}
                alt={displayName}
                loading="lazy"
                decoding="async"
                className="h-9 w-9 rounded-[4px] object-cover"
                style={{ border: `1px solid ${agentColor}55` }}
              />
            ) : (
              <div
                className="grid h-9 w-9 place-items-center rounded-[4px] font-mono text-[13px] font-black"
                style={{
                  background: `linear-gradient(135deg, ${agentColor}33, ${agentColor}11)`,
                  color: agentColor,
                  border: `1px solid ${agentColor}55`,
                }}
              >
                {displayName.slice(0, 1)}
              </div>
            )
          ) : post.author.avatar ? (
            <img src={post.author.avatar} alt={displayName} loading="lazy" decoding="async" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#0A0A0A] text-[11px] font-bold text-[#E2E4E8]">{initials}</div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold text-[#FFFFFF]">{displayName}</p>
              {agentInfo ? (
                <span
                  className="inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 font-mono text-[8px] font-black tracking-[0.18em]"
                  style={{ background: `${agentColor}1F`, color: agentColor }}
                >
                  AGENT
                </span>
              ) : (() => {
                const lvl = post.authorLevel ?? post.author.level ?? 0;
                return lvl > 0 ? <LevelChip level={lvl} /> : null;
              })()}
            </div>
            <p className="text-[11px] text-[#E2E4E8]">{formatDistanceToNow(post.createdAt)}</p>
          </div>
        </div>
        <div className="relative">
          <div className="select-none blur-[6px]">
            <p className="text-[14px] text-[#E2E4E8]">
              {post.content?.slice(0, 120) || "Энэ нийтлэлийн агуулгыг зөвхөн гишүүд харах боломжтой..."}
            </p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[12px] font-medium text-[#E2E4E8]">Гишүүдэд зориулсан</span>
            <Link href="/pricing" className="mt-2 text-[12px] font-bold text-[#2E29FF]">
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
              borderColor: ["rgba(255,255,255,0.06)", "rgba(46,41,255,0.45)", "rgba(46,41,255,0)"],
            }
          : { opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }
      }
      transition={
        deleting
          ? { duration: 0.48, times: [0, 0.4, 1], ease: [0.42, 0, 0.58, 1] }
          : { duration: 0 }
      }
      style={{ pointerEvents: deleting ? "none" : "auto" }}
      className={`transition-colors duration-200 ${shellClass}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-3.5 sm:px-5">
        <Link href={displayHref} className="flex items-center gap-2.5 min-w-0">
          {agentInfo ? (
            agentAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={agentAvatar}
                alt={displayName}
                loading="lazy"
                decoding="async"
                className="h-9 w-9 shrink-0 rounded-[4px] object-cover"
                style={{ border: `1px solid ${agentColor}55` }}
              />
            ) : (
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[4px] font-mono text-[13px] font-black"
                style={{
                  background: `linear-gradient(135deg, ${agentColor}33, ${agentColor}11)`,
                  color: agentColor,
                  border: `1px solid ${agentColor}55`,
                }}
              >
                {displayName.slice(0, 1)}
              </div>
            )
          ) : post.author.avatar ? (
            <img src={post.author.avatar} alt={displayName} loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-[#0A0A0A] text-[11px] font-bold text-[#E2E4E8]">{initials}</div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[13px] font-semibold text-[#FFFFFF] truncate">{displayName}</p>
              {agentInfo ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-[4px] px-1.5 py-0.5 font-mono text-[8px] font-black tracking-[0.18em]"
                  style={{ background: `${agentColor}1F`, color: agentColor }}
                >
                  <span className="inline-block h-[4px] w-[4px] animate-pulse rounded-[4px]" style={{ background: agentColor }} />
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
                  className="shrink-0 rounded-[4px] px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: catStyle.bg, color: catStyle.color }}
                >
                  {catStyle.label}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#E2E4E8]">
              {agentInfo ? <span className="font-mono">{displayHandle} · </span> : null}
              {formatDistanceToNow(post.createdAt)}
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-0.5">
        {userIsAdmin && (
          <button
            onClick={togglePin}
            disabled={pinning}
            className={`shrink-0 rounded-[4px] p-2 transition hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-40 ${
              pinned ? "text-[#2E29FF]" : "text-[#E2E4E8] hover:text-[#E2E4E8]"
            }`}
            aria-label={pinned ? "Тогтоолтыг тайлах" : "Дээр тогтоох"}
            aria-pressed={pinned}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3h6" />
              <path d="M10 3v5.5L7.5 12v1.5h9V12L14 8.5V3" fill={pinned ? "currentColor" : "none"} />
              <path d="M12 13.5V21" />
            </svg>
          </button>
        )}

        {canDelete && (
          <button onClick={handleDelete} className="shrink-0 rounded-[4px] p-2 text-[#E2E4E8] transition hover:bg-[rgba(255,255,255,0.04)] hover:text-[#E2E4E8]" aria-label="Устгах">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        </div>
      </div>

      {pinned && (
        <div className="chrome flex items-center gap-1.5 px-4 pt-2 text-[10px] font-bold tracking-[0.14em] text-[#2E29FF] sm:px-5">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6z" />
          </svg>
          ОНЦЛОХ
        </div>
      )}

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
              className="mt-1 text-[13px] font-medium text-[#2E29FF] transition-colors duration-200 hover:text-[#2E29FF]"
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
        <div className="relative mx-auto mt-3 aspect-[9/16] max-w-[360px] overflow-hidden rounded-[4px] bg-black">
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
            /* contain: хэвтээ клип 9:16 хүрээнд тайрагдахгүй, хар зурвастай. */
            className="absolute inset-0 h-full w-full object-contain"
          />
          {post.videoDurationSec && post.videoDurationSec > 0 && (
            <span className="absolute bottom-2 right-2 rounded-[4px] bg-black/70 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white backdrop-blur-sm">
              {Math.floor(post.videoDurationSec / 60)}:{String(post.videoDurationSec % 60).padStart(2, "0")}
            </span>
          )}
        </div>
      )}

      {/* Single image — keep native aspect, max 600px height */}
      {!hasVideo && hasImage && !isMulti && (
        <Link href={`/posts/${post._id}`} className="block mt-3">
          <div className="relative overflow-hidden bg-[#0A0A0A]">
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2 w-2 animate-pulse-gold rounded-full bg-[#2E29FF]" />
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
            className="flex aspect-[4/5] w-full snap-x snap-mandatory overflow-x-auto bg-[#0A0A0A] scrollbar-hide"
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
          <div className="pointer-events-none absolute right-2 top-2 rounded-[4px] bg-black/65 px-2 py-0.5 text-[10px] font-black tabular-nums text-white backdrop-blur-md">
            {carouselIndex + 1} / {allImages.length}
          </div>

          {/* Dots — bottom-center */}
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
            {allImages.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-[4px] transition-all duration-200"
                style={{
                  width: i === carouselIndex ? "16px" : "6px",
                  background: i === carouselIndex ? "#2E29FF" : "rgba(255,255,255,0.45)",
                  boxShadow: i === carouselIndex ? "0 0 8px rgba(46,41,255,0.6)" : "none",
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
            <div className="overflow-hidden rounded-[4px] border border-[rgba(46,41,255,0.18)] bg-gradient-to-br from-[rgba(46,41,255,0.04)] via-[#f2f5f8] to-[#f2f5f8]">
              <button
                type="button"
                onClick={() => setPromptOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-[rgba(46,41,255,0.04)]"
              >
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-[#2E29FF]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  <span className="font-mono text-[10px] font-black tracking-[0.2em] text-[#2E29FF]">AI ПРОМПТ</span>
                  {!promptOpen && (
                    <span className="ml-1 truncate text-[11px] text-[#E2E4E8] sm:text-[12px]" style={{ maxWidth: 220 }}>
                      {aiPrompt.slice(0, 80)}{aiPrompt.length > 80 ? "…" : ""}
                    </span>
                  )}
                </span>
                <svg className={`h-3 w-3 text-[#E2E4E8] transition-transform ${promptOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {promptOpen && aiPrompt && (
                <div className="border-t border-[rgba(46,41,255,0.12)] p-3">
                  <p className="mb-3 max-h-[200px] overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed text-[#FFFFFF]">
                    {aiPrompt}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={copyPrompt}
                      className="inline-flex items-center gap-1 rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] px-2.5 py-1 font-mono text-[10px] font-black tracking-[0.18em] text-[#FFFFFF] transition hover:border-[#2E29FF] hover:text-[#2E29FF]"
                    >
                      {promptCopied ? (
                        <><svg className="h-3 w-3 text-[#4FE065]" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> COPIED</>
                      ) : (
                        <><svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> COPY</>
                      )}
                    </button>
                    <Link
                      href={`/content-agent?v=image&prompt=${encodeURIComponent(aiPrompt)}`}
                      className="inline-flex items-center gap-1 rounded-[4px] bg-[#2E29FF] px-2.5 py-1 font-mono text-[10px] font-black tracking-[0.18em] text-white transition hover:bg-[#FF3D69]"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      USE PROMPT
                    </Link>
                    <span className="ml-auto font-mono text-[11px] tracking-wide text-[#E2E4E8]">{aiPrompt.length} chars</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // ── NON-MEMBER VIEW: skeleton lock with CTA ──
            <Link
              href="/auth/signup"
              className="group block overflow-hidden rounded-[4px] border border-[rgba(46,41,255,0.22)] bg-gradient-to-br from-[rgba(46,41,255,0.06)] via-[#f2f5f8] to-[#f2f5f8] p-3 transition hover:border-[#2E29FF]"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-[#2E29FF]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <span className="font-mono text-[10px] font-black tracking-[0.2em] text-[#2E29FF]">AI ПРОМПТ · ТҮГЖЭЭТЭЙ</span>
                </span>
                <span className="font-mono text-[11px] tracking-[0.18em] text-[#E2E4E8] transition group-hover:text-[#2E29FF]">
                  ГИШҮҮН БОЛОХ →
                </span>
              </div>
              {/* Skeleton lines hint at content shape without leaking the prompt */}
              <div className="space-y-1.5">
                <div className="h-2 w-[88%] animate-pulse rounded-[4px] bg-[rgba(46,41,255,0.12)]" />
                <div className="h-2 w-[72%] animate-pulse rounded-[4px] bg-[rgba(46,41,255,0.10)]" style={{ animationDelay: "120ms" }} />
                <div className="h-2 w-[56%] animate-pulse rounded-[4px] bg-[rgba(46,41,255,0.08)]" style={{ animationDelay: "240ms" }} />
              </div>
              <p className="mt-2 text-[11px] leading-snug text-[#E2E4E8]">
                Промпт зөвхөн <span className="font-bold text-[#FFFFFF]">Antaqor хүрээлэл</span> гишүүдэд нээлттэй. Хуулж, өөрчилж, дахин үүсгэх боломжтой.
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
              className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 transition disabled:opacity-50"
              style={liked ? { color: "var(--accent-ink, #2E29FF)" } : { color: "var(--t-body, #30333F)" }}
            >
              <motion.svg
                className="h-[19px] w-[19px]"
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
                    ? { filter: "drop-shadow(0 0 6px rgba(46,41,255,0.55)) drop-shadow(0 0 14px rgba(46,41,255,0.3))" }
                    : undefined
                }
              >
                {/* Geometric "love" — angular hexagonal heart, Tesla-clean */}
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.3 C6.6 16.1 3.2 13.2 3.2 9.4 C3.2 6.7 5.4 4.6 8.1 4.6 C9.7 4.6 11.2 5.4 12 6.6 C12.8 5.4 14.3 4.6 15.9 4.6 C18.6 4.6 20.8 6.7 20.8 9.4 C20.8 13.2 17.4 16.1 12 20.3 Z" />
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
          className="flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-[#E2E4E8] transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F2F2F4]"
        >
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
            {/* Geometric square chat bubble with chevron tail */}
            <path strokeLinecap="round" strokeLinejoin="miter" d="M4 5 H20 V15 H11 L7 19 V15 H4 Z" />
          </svg>
          {typeof post.viewsCount === "number" && post.viewsCount > 0 && (
            <span className="mr-2 flex items-center gap-1 text-[11px] tabular-nums text-[#E2E4E8]" title="Үзсэн">
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
        {/* ChatGPT "Зураг шинжлэх" товч 2026-10-06-нд хасагдав (эзний хүсэлт;
            OpenAI түлхүүр ч идэвхгүй). AnalyzeImagePanel-ийн код доор хэвээр. */}
        {/* Grok / Ask-AI button removed per request — AskAiPanel stays mounted (closed). */}
        </div>
      </div>


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
      className="overflow-hidden border-t border-[rgba(46,41,255,0.18)] bg-[rgba(46,41,255,0.025)]"
    >
      <div className="px-3 py-3 sm:px-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.26em] text-[#2E29FF]">
            <span className="h-1 w-1 rotate-45 bg-[#2E29FF] shadow-[0_0_6px_#2E29FF]" />
            CHATGPT VISION · ЗУРГИЙН АНАЛИЗ
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#E2E4E8] transition hover:text-[#2E29FF]"
          >
            ✕ ХААХ
          </button>
        </div>

        {busy ? (
          <div className="flex items-center gap-2 rounded-[4px] border border-[rgba(46,41,255,0.2)] bg-[#0A0A0A] p-3">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2E29FF]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#E2E4E8]">CHATGPT ЗУРГИЙГ ШИНЖЛЭЖ БАЙНА...</span>
          </div>
        ) : err ? (
          <div className="rounded-[4px] border border-[#2E29FF]/30 bg-[#2E29FF]/5 px-2.5 py-1.5 text-[11px] text-[#8FC1EA]">{err}</div>
        ) : data ? (
          <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
            {thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnail} alt="" className="h-[100px] w-[100px] rounded-[4px] border border-[rgba(255,255,255,0.06)] object-cover sm:h-[120px] sm:w-[100px]" loading="lazy" />
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
                <div className="mt-2 rounded-[4px] border border-[rgba(46,41,255,0.3)] bg-[rgba(46,41,255,0.04)] p-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#2E29FF]">
                      ▶ GENERATED PROMPT
                    </span>
                    <button
                      type="button"
                      onClick={copy}
                      className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#E2E4E8] transition hover:text-[#2E29FF]"
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
    <div className={`rounded-[4px] border border-[rgba(255,255,255,0.05)] bg-[#0A0A0A] p-2 ${span2 ? "col-span-2" : ""}`}>
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8]">{label}</p>
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
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-[#0A0A0A] text-[10px] font-bold text-[#E2E4E8]">
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
              <span className="font-mono text-[10px] tabular-nums text-[#E2E4E8]">{relativeTime(preview.createdAt)}</span>
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
          className="flex w-full items-center gap-1.5 border-t border-[rgba(255,255,255,0.03)] px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8] transition hover:bg-[rgba(255,255,255,0.025)] hover:text-[#2E29FF] sm:px-4"
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
          className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8] transition hover:bg-[rgba(255,255,255,0.025)] hover:text-[#2E29FF] sm:px-4"
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
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.26em] text-[#2E29FF]">
                  ▶ СЭТГЭГДЭЛ · {count}
                </span>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#E2E4E8] transition hover:text-[#2E29FF]"
                >
                  ✕ ХУРААХ
                </button>
              </div>

              {loading && comments.length === 0 ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="flex gap-2">
                      <div className="h-7 w-7 shrink-0 animate-pulse rounded-[4px] bg-[#0A0A0A]" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 w-1/3 animate-pulse rounded bg-[#0A0A0A]" />
                        <div className="h-3 w-3/4 animate-pulse rounded bg-[#0A0A0A]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <p className="py-2 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[#E2E4E8]">
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
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-[#0A0A0A] text-[10px] font-bold text-[#E2E4E8]">
                        {c.author?.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.author.avatar} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          (c.author?.name?.[0] || "?").toUpperCase()
                        )}
                      </span>
                      <div className="min-w-0 flex-1 rounded-[4px] bg-[rgba(255,255,255,0.025)] px-2.5 py-1.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="truncate text-[12px] font-bold text-[#FFFFFF]">{c.author?.name || "Хэн нэгэн"}</span>
                          <span className="font-mono text-[10px] tabular-nums text-[#E2E4E8]">{relativeTime(c.createdAt)}</span>
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
                    className="flex-1 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[14px] text-[#FFFFFF] placeholder:text-[#E2E4E8] focus:border-[#2E29FF] focus:outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={submit}
                    disabled={posting || text.trim().length === 0}
                    className="shrink-0 rounded-[4px] bg-[#2E29FF] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-white transition hover:shadow-[0_0_14px_rgba(46,41,255,0.4)] disabled:cursor-not-allowed disabled:bg-[#0A0A0A] disabled:text-[#E2E4E8] disabled:shadow-none"
                  >
                    {posting ? "..." : "ИЛГЭЭХ"}
                  </button>
                </div>
              ) : (
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#E2E4E8]">
                  Сэтгэгдэл бичихийн тулд нэвтрэнэ үү
                </p>
              )}

              {err && (
                <p className="rounded-[4px] border border-[#2E29FF]/30 bg-[#2E29FF]/5 px-2.5 py-1.5 text-[11px] text-[#8FC1EA]">{err}</p>
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
      className="overflow-hidden border-t border-[rgba(46,41,255,0.18)] bg-[rgba(46,41,255,0.025)]"
    >
      <div className="px-3 py-3 sm:px-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.26em] text-[#2E29FF]">
            <span className="h-1 w-1 rotate-45 bg-[#2E29FF] shadow-[0_0_6px_#2E29FF]" />
            ASK AI · GROK
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#E2E4E8] transition hover:text-[#2E29FF]"
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
            className="flex-1 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[14px] text-[#FFFFFF] placeholder:text-[#E2E4E8] focus:border-[#2E29FF] focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || question.trim().length < 2}
            className="shrink-0 rounded-[4px] bg-[#2E29FF] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-white transition hover:shadow-[0_0_14px_rgba(46,41,255,0.4)] disabled:cursor-not-allowed disabled:bg-[#0A0A0A] disabled:text-[#E2E4E8] disabled:shadow-none"
          >
            {busy ? "..." : "АСУУХ →"}
          </button>
        </div>

        {error && (
          <p className="mt-2 rounded-[4px] border border-[#2E29FF]/30 bg-[#2E29FF]/5 px-2.5 py-1.5 text-[11px] text-[#8FC1EA]">{error}</p>
        )}

        {(busy || answer) && (
          <div className="mt-3 rounded-[4px] border border-[rgba(46,41,255,0.18)] bg-[#0A0A0A] p-3">
            {busy ? (
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2E29FF]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#E2E4E8]">GROK БОДОЖ БАЙНА...</span>
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
