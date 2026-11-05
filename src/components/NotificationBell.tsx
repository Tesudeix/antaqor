"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

const NEON = "var(--accent-ink, #2E29FF)";

// Icon + accent color per notification type. Falls back to a subtle pink
// system spark for anything we don't recognize.
function iconFor(n: NotificationItem) {
  const t = n.type || "";
  const titleLc = (n.title || "").toLowerCase();
  if (titleLc.includes("react") || titleLc.includes("love") || titleLc.includes("like")) {
    return {
      color: "#F33E58",
      path: "M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z",
      strokeWidth: 1.6,
    };
  }
  if (t === "new_post") {
    return {
      color: "var(--accent-ink, #2E29FF)",
      path: "M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z",
      strokeWidth: 1.6,
    };
  }
  if (t === "new_course") {
    return {
      color: "var(--accent-ink, #2E29FF)",
      path: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25",
      strokeWidth: 1.6,
    };
  }
  if (t === "new_lesson") {
    return {
      color: "#06B6D4",
      path: "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347",
      strokeWidth: 1.6,
    };
  }
  return {
    color: NEON,
    path: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z",
    strokeWidth: 1.6,
  };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "одоо";
  if (mins < 60) return `${mins}м`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}ц`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}ө`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}7хн`;
  return new Date(dateStr).toLocaleDateString("mn-MN", { month: "short", day: "numeric" });
}

export default function NotificationBell() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Drag motion values (mobile bottom-sheet)
  const sheetY = useMotionValue(0);
  const bgOpacity = useTransform(sheetY, [0, 240], [1, 0]);
  const closingRef = useRef(false);

  // ─── Mobile breakpoint detection ───────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // ─── Smooth close — anim sheet down on mobile, instant on desktop ─────
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    if (isMobile) {
      closingRef.current = true;
      animate(sheetY, 800, {
        type: "spring",
        damping: 38,
        stiffness: 360,
        onComplete: () => {
          setOpen(false);
          closingRef.current = false;
        },
      });
    } else {
      setOpen(false);
    }
  }, [isMobile, sheetY]);

  /* Portal нь `document.body`-г шаарддаг бөгөөд тэр нь серверт байхгүй.
     Эхний зурагдалтад portal-гүй, hydration-ы дараа л гарна. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ─── Fetch + visibility-aware polling ─────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications);
        setUnread(data.unreadCount);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchNotifications();
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!id && document.visibilityState === "visible") {
        // 60s when tab visible — was 30s, halved for less load.
        id = setInterval(fetchNotifications, 60_000);
      }
    };
    const stop = () => { if (id) { clearInterval(id); id = null; } };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications(); // immediate refresh when user returns
        start();
      } else {
        stop();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", fetchNotifications);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", fetchNotifications);
    };
  }, [session, fetchNotifications]);

  // ─── Click-outside (desktop only) ─────────────────────────────────────
  useEffect(() => {
    if (isMobile || !open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMobile, open]);

  // ─── ESC to close ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  // ─── Body scroll lock on mobile ───────────────────────────────────────
  useEffect(() => {
    if (!isMobile || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, isMobile]);

  // ─── Prime sheetY for mobile slide-up to avoid first-frame flash ─────
  useEffect(() => {
    if (!open || !isMobile) return;
    closingRef.current = false;
    sheetY.set(800);
    const c = animate(sheetY, 0, { type: "spring", damping: 34, stiffness: 320 });
    return () => c.stop();
  }, [open, isMobile, sheetY]);

  /* ─── ХОНХ НЭЭХЭД БҮГД УНШСАН БОЛОХГҮЙ ─────────────────────────────
     Өмнө нь хонх нээгдэх бүрд `/read` дуудагдаж, тухайн хүний БҮХ
     уншаагүй мэдэгдэл уншсанд тооцогддог байв. 194 мэдэгдэлтэй хүн
     хонхоо нэг харснаар тэдгээрийн дунд байсан "төлбөр баталгаажлаа"
     гэсэн мэдэгдлийг УНШИЛГҮЙГЭЭР устгана. Мэдэгдэл уншигдсанд тооцох
     цорын ганц үндэслэл нь хүн түүн рүү ХАНДСАН явдал. */
  const toggleOpen = () => {
    if (open) { requestClose(); return; }
    setOpen(true);
  };

  /** Нэг мэдэгдэл дээр дарахад ЗӨВХӨН тэр нь уншсан болно. */
  const markOne = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch { /* дэлгэц аль хэдийн шинэчлэгдсэн */ }
  }, []);

  /** Тодорхой сонголт — хүн өөрөө дарж бүгдийг уншсан болгоно. */
  const markAll = useCallback(async () => {
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch { /* дэлгэц аль хэдийн шинэчлэгдсэн */ }
  }, []);

  if (!session) return null;

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={toggleOpen}
        aria-label="Мэдэгдэл"
        aria-expanded={open}
        className={`relative flex h-9 w-9 items-center justify-center rounded-[4px] transition-colors active:scale-95 ${
          open
            ? "bg-[rgba(46,41,255,0.12)] text-[#2E29FF]"
            : unread > 0
              ? "bg-[#141414] text-[#F2F2F4] hover:bg-[#1E1E1E]"
              : "bg-[#131316] text-[#E2E4E8] hover:bg-[#141414] hover:text-[#E2E4E8]"
        }`}
      >
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 16, stiffness: 360 }}
            className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-[4px] px-1 text-[10px] font-bold text-white ring-2 ring-[#0A0A0A]"
            style={{ background: NEON }}
          >
            {unread > 99 ? "99+" : unread}
          </motion.span>
        )}
      </button>

      {/* ─── ЯАГААД PORTAL ВЭ ───────────────────────────────────────────
          Энэ хонх `Navbar` дотор сууна. Navbar нь гүйлгэхэд нуугдахын тулд
          `transform: translateY(...)`-ыг ҮРГЭЛЖ агуулдаг (нуугдаагүй үед ч
          `translateY(0)`). CSS-ийн дүрмээр `transform` бүхий элемент нь
          доторх `position: fixed` элементийн харьцангуй цэг болдог —
          өөрөөр хэлбэл `fixed inset-0` хөшиг ба `fixed bottom-0` доод
          самбар нь ДЭЛГЭЦЭД биш, НАВБАРТ харьцангуй байрлана. Тиймээс
          мэдэгдлийн цонх буруу өндөрт, хагас дэлгэц дүүрч "хөвдөг" байв.

          Navbar-ийн transform-ыг авах нь нуугдах анимацийг эвдэнэ, тиймээс
          засвар нь энд: хөшиг ба самбарыг `document.body` руу гаргана.
          Тэнд transform-той өвөг байхгүй тул `fixed` жинхэнэ дэлгэцээр
          хэмжигдэнэ. */}
      {mounted
        ? createPortal(
            <>
          {/* ─── Mobile backdrop ─────────────────────────────────────────── */}
          {open && isMobile && (
            <motion.div
              style={{ opacity: bgOpacity }}
              className="fixed inset-0 z-[90] bg-black/65 backdrop-blur-sm"
              onClick={requestClose}
            />
          )}

          {/* ─── Panel ─────────────────────────────────────────────────────
              Mobile: bottom sheet (drag-to-dismiss, spring up).
              Desktop: anchored dropdown to the right of the bell. */}
          {open && (
            <motion.div
              style={isMobile ? { y: sheetY } : undefined}
              initial={isMobile ? false : { opacity: 0, y: -8, scale: 0.98 }}
              animate={isMobile ? undefined : { opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              drag={isMobile ? "y" : false}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0.04 }}
              dragMomentum={false}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  requestClose();
                } else {
                  animate(sheetY, 0, { type: "spring", damping: 30, stiffness: 320 });
                }
              }}
              className={
                isMobile
                  ? "fixed bottom-0 left-0 right-0 z-[100] max-h-[85vh] overflow-hidden rounded-t-[4px] border border-b-0 border-[rgba(46,41,255,0.22)] bg-[#0A0A0A] pb-[env(safe-area-inset-bottom)] shadow-[0_-24px_80px_rgba(0,0,0,0.8)]"
                  : "absolute right-0 top-full z-50 mt-2 w-[380px] overflow-hidden rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#0A0A0A] shadow-[0_18px_40px_rgba(0,0,0,0.6)]"
              }
            >
              {/* SKILL.md bracket corner ticks (top edges only on mobile sheet) */}
              {isMobile && (
                <>

                </>
              )}

              {/* Drag handle on mobile */}
              {isMobile && (
                <div className="flex cursor-grab items-center justify-center pb-1 pt-2 active:cursor-grabbing">
                  <span className="h-1 w-10 rounded-[4px] bg-[rgba(15,23,38,0.18)]" />
                </div>
              )}

              {/* ─── Header — SKILL.md eyebrow + LIVE-style pill ──────── */}
              <div className="flex items-center justify-between border-b border-[rgba(15,23,38,0.06)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[#F2F2F4]">
                    МЭДЭГДЭЛ
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {unread > 0 ? (
                    <>
                      <span
                        className="flex items-center rounded-[4px] bg-[#2E29FF] px-1.5 py-0.5 text-[10px] font-bold text-white"
                      >
                        {unread}
                      </span>
                      <button
                        onClick={markAll}
                        className="rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold text-[#E2E4E8] transition hover:text-[#2E29FF]"
                      >
                        Бүгдийг уншсан
                      </button>
                    </>
                  ) : notifications.length > 0 ? (
                    <span className="text-[11px] text-[#E2E4E8]">
                      {notifications.length} НИЙТ
                    </span>
                  ) : null}
                  {isMobile && (
                    <button
                      onClick={requestClose}
                      className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#141414] text-[#E2E4E8] transition hover:bg-[#1E1E1E] hover:text-[#F2F2F4]"
                      aria-label="Хаах"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* ─── List ─────────────────────────────────────────────── */}
              <div
                className="overflow-y-auto"
                style={{
                  maxHeight: isMobile ? "62vh" : "440px",
                  overscrollBehavior: "contain",
                }}
              >
                {loading ? (
                  <div className="space-y-2 p-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex gap-3 rounded-[4px] bg-[#f2f5f8] p-3">
                        <div className="h-9 w-9 shrink-0 animate-pulse rounded-[4px] bg-[#F2F2F4]" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-3/4 animate-pulse rounded-[4px] bg-[#F2F2F4]" />
                          <div className="h-2.5 w-1/2 animate-pulse rounded-[4px] bg-[#F2F2F4]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                    <div
                      className="mb-3 flex h-14 w-14 items-center justify-center rounded-[4px] border border-[rgba(46,41,255,0.18)]"
                      style={{ background: "rgba(46,41,255,0.04)" }}
                    >
                      <svg className="h-6 w-6" fill="none" stroke={NEON} strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                      </svg>
                    </div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0e1726]">
                      ЦЭВЭР ХОНОГ
                    </p>
                    <p className="mt-1.5 max-w-[220px] text-[11px] leading-relaxed text-[#E2E4E8]">
                      Шинэ мэдэгдэл хүлээж байна. Постоор оролц.
                    </p>
                  </div>
                ) : (
                  <div>
                    {notifications.map((n, i) => {
                      const ic = iconFor(n);
                      return (
                        <motion.div
                          key={n._id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18, delay: Math.min(i * 0.025, 0.3), ease: [0.16, 1, 0.3, 1] }}
                        >
                          <Link
                            href={n.link || "/"}
                            onClick={() => { if (!n.read) markOne(n._id); requestClose(); }}
                            className="group relative flex items-start gap-3 px-4 py-3 transition hover:bg-[rgba(15,23,38,0.025)]"
                            style={{
                              borderBottom: i < notifications.length - 1 ? "1px solid rgba(15,23,38,0.04)" : "none",
                            }}
                          >
                            {/* Unread strip — bright accent edge segment */}
                            {!n.read && (
                              <span
                                className="absolute left-0 top-0 h-full w-[3px]"
                                style={{ background: NEON, boxShadow: `0 0 6px ${NEON}` }}
                              />
                            )}
                            {/* Type icon tile */}
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px]"
                              style={{ background: `${ic.color}1F` }}
                            >
                              <svg className="h-4 w-4" fill="none" stroke={ic.color} strokeWidth={ic.strokeWidth} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d={ic.path} />
                              </svg>
                            </span>
                            {/* Content */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className={`truncate text-[13px] font-bold ${n.read ? "text-[#334155]" : "text-white"}`}>
                                  {n.title}
                                </p>
                                <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#E2E4E8]">
                                  {timeAgo(n.createdAt)}
                                </span>
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#E2E4E8]">{n.message}</p>
                            </div>
                            {/* Hover chevron */}
                            <span className="self-center opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100">
                              <svg className="h-3 w-3 text-[#2E29FF]" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </span>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ─── Footer ───────────────────────────────────────────── */}
              {notifications.length > 0 && (
                <div className="relative border-t border-[rgba(15,23,38,0.06)] bg-[#0A0A0A] px-4 py-2.5">
                  <span className="pointer-events-none absolute left-3 top-0 h-px w-10 bg-gradient-to-r from-[#2E29FF] via-[#2E29FF] to-transparent shadow-[0_0_6px_rgba(46,41,255,0.5)]" />
                  <Link
                    href="/notifications"
                    onClick={requestClose}
                    className="group flex items-center justify-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.26em] text-[#E2E4E8] transition hover:text-[#2E29FF]"
                  >
                    БҮГДИЙГ ХАРАХ
                    <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" />
                      </svg>
                    </span>
                  </Link>
                </div>
              )}
            </motion.div>
          )}
            </>,
            document.body
          )
        : null}
    </div>
  );
}
