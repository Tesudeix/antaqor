"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Icon from "@/components/Icon";
import PageShell from "@/components/PageShell";

/* ─── Мэдэгдлийн төв ─────────────────────────────────────────────────────

   Энэ хуудас ӨМНӨ НЬ БАЙГААГҮЙ. Хонхны доод талын "БҮГДИЙГ ХАРАХ" товч нь
   `/notifications` руу заадаг байсан бөгөөд тэр хаяг 404 буцаадаг байв —
   өөрөөр хэлбэл мэдэгдлээ бүтнээр нь харах ямар ч зам байгаагүй, хонхон
   доторх сүүлийн 20 л бүх боломж байлаа.

   Хонх бол ХАРЦ; энэ хуудас бол АЖИЛ: шүүх, нэг бүрчлэн уншсан болгох,
   устгах, цааш нь татах, ямар төрлийг авахаа шийдэх.                    */

interface Item {
  _id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "Бүгд" },
  { key: "payment", label: "Төлбөр" },
  { key: "new_post", label: "Пост" },
  { key: "new_course", label: "Сургалт" },
  { key: "system", label: "Систем" },
];

/* Өнгө нь чимэглэл биш, ЖИН: төлбөр бол мөнгө, пост бол урсгал. Тэднийг
   ижил харагдуулсан нь 37 мянган мөрийн дунд жинхэнэ мэдэгдэл живсэн
   шалтгааны нэг байв. */
const META: Record<string, { label: string; color: string; icon: string }> = {
  payment:    { label: "Төлбөр",  color: "var(--accent-ink, #2E29FF)", icon: "payment" },
  system:     { label: "Систем",  color: "var(--t-body, #30333F)", icon: "shield" },
  new_post:   { label: "Пост",    color: "var(--t-body, #30333F)", icon: "feed" },
  new_course: { label: "Сургалт", color: "var(--t-body, #30333F)", icon: "book" },
  new_lesson: { label: "Хичээл",  color: "var(--t-body, #30333F)", icon: "book" },
};

function timeAgo(s: string) {
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "одоо";
  if (m < 60) return `${m}м`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}ц`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}ө`;
  return new Date(s).toLocaleDateString("mn-MN", { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<Item[] | null>(null);
  const [tab, setTab] = useState("all");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [byType, setByType] = useState<Record<string, number>>({});
  const [unread, setUnread] = useState(0);
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);

  const load = useCallback(
    async (opts: { after?: string | null; type?: string; unread?: boolean } = {}) => {
      const qs = new URLSearchParams({ limit: "30" });
      const t = opts.type ?? tab;
      if (t !== "all") qs.set("type", t);
      if (opts.unread ?? onlyUnread) qs.set("unread", "1");
      if (opts.after) qs.set("cursor", opts.after);
      const r = await fetch(`/api/notifications?${qs}`);
      return r.json();
    },
    [tab, onlyUnread]
  );

  const refresh = useCallback(
    async (t = tab, u = onlyUnread) => {
      const d = await load({ type: t, unread: u });
      setItems(Array.isArray(d.notifications) ? d.notifications : []);
      setCursor(d.nextCursor || null);
      setMore(!!d.nextCursor);
      setByType(d.byType || {});
      setUnread(d.unreadCount || 0);
    },
    [load, tab, onlyUnread]
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    refresh();
    fetch("/api/notifications/prefs")
      .then((r) => r.json())
      .then((d) => setPrefs(d?.prefs || null))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const switchTab = (k: string) => {
    setTab(k);
    setItems(null);
    refresh(k, onlyUnread);
  };

  const toggleUnread = () => {
    const v = !onlyUnread;
    setOnlyUnread(v);
    setItems(null);
    refresh(tab, v);
  };

  /* Нэг мэдэгдэл дээр дарахад ЗӨВХӨН тэр нь уншсан болно. Өмнөх зан
     байдал (хонх нээхэд бүгд уншсан болох) нь жинхэнэ мэдэгдлийг
     хараагүй байхад нь устгадаг байсан. */
  const markOne = async (id: string) => {
    setItems((p) => (p || []).map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tab === "all" ? { all: true } : { type: tab }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const removeOne = async (id: string) => {
    setItems((p) => (p || []).filter((n) => n._id !== id));
    await fetch(`/api/notifications?id=${id}`, { method: "DELETE" }).catch(() => {});
  };

  const clearRead = async () => {
    setBusy(true);
    try {
      await fetch("/api/notifications?scope=read", { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    if (!cursor || busy) return;
    setBusy(true);
    try {
      const d = await load({ after: cursor });
      setItems((p) => [...(p || []), ...(Array.isArray(d.notifications) ? d.notifications : [])]);
      setCursor(d.nextCursor || null);
      setMore(!!d.nextCursor);
    } finally {
      setBusy(false);
    }
  };

  const savePref = async (key: string, value: boolean) => {
    setPrefs((p) => ({ ...(p || {}), [key]: value }));
    await fetch("/api/notifications/prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
  };

  if (status === "loading") {
    return (
      <PageShell>
        <div className="px-4 pt-4 lg:px-0">
          <div className="h-6 w-40 animate-pulse rounded-[4px] bg-[#0A0A0A]" />
        </div>
      </PageShell>
    );
  }

  if (!session) {
    return (
      <PageShell>
        <div className="px-4 pt-10 text-center lg:px-0">
          <p className="text-[14px] text-[#E2E4E8]">Мэдэгдэл харахын тулд нэвтэрнэ үү.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-[4px] bg-[#2E29FF] px-4 py-2.5 text-[13px] font-bold text-white"
          >
            Нэвтрэх
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="w-full px-4 pt-4 lg:px-0">
        <div className="mb-1.5 flex items-center gap-2.5">
          <Icon name="bell" size={24} />
          <h1 className="text-[24px] font-bold leading-tight text-[#F2F2F4]">Мэдэгдэл</h1>
          {unread > 0 && (
            <span
              className="rounded-[4px] bg-[#2E29FF] px-1.5 py-0.5 text-[11px] font-bold text-white"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {unread}
            </span>
          )}
        </div>
        <p className="mb-5 text-[13px] text-[#E2E4E8]">
          Шинэ нь дээрээ. Дарсан мэдэгдэл уншсанд тооцогдоно.
        </p>

        {/* ── Шүүлтүүр ── */}
        <div className="-mx-4 mb-3 overflow-x-auto px-4 lg:mx-0 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max items-center gap-2">
            {TABS.map((t) => {
              const n = t.key === "all" ? unread : byType[t.key] || 0;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => switchTab(t.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-[4px] border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                    active
                      ? "border-[#2E29FF] bg-[rgba(46,41,255,0.12)] text-[#2E29FF]"
                      : "border-[#1E1E1E] text-[#E2E4E8] hover:text-[#F2F2F4]"
                  }`}
                >
                  {t.label}
                  {n > 0 && (
                    <span
                      className="rounded-[4px] bg-[#1E1E1E] px-1 text-[10px] font-bold text-[#E2E4E8]"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={toggleUnread}
            className={`rounded-[4px] border px-3 py-1.5 text-[12px] font-semibold transition ${
              onlyUnread
                ? "border-[#2E29FF] text-[#2E29FF]"
                : "border-[#1E1E1E] text-[#E2E4E8] hover:text-[#F2F2F4]"
            }`}
          >
            {onlyUnread ? "Зөвхөн уншаагүй ✓" : "Зөвхөн уншаагүй"}
          </button>
          <button
            onClick={markAll}
            disabled={busy || unread === 0}
            className="rounded-[4px] border border-[#1E1E1E] px-3 py-1.5 text-[12px] font-semibold text-[#E2E4E8] transition hover:text-[#F2F2F4] disabled:opacity-40"
          >
            Уншсан болгох
          </button>
          <button
            onClick={clearRead}
            disabled={busy}
            className="rounded-[4px] border border-[#1E1E1E] px-3 py-1.5 text-[12px] font-semibold text-[#E2E4E8] transition hover:text-[#2E29FF] disabled:opacity-40"
          >
            Уншсаныг цэвэрлэх
          </button>
        </div>

        {/* ── Жагсаалт ── */}
        {items === null && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[64px] animate-pulse rounded-[4px] bg-[#0A0A0A]" />
            ))}
          </div>
        )}

        {items !== null && items.length === 0 && (
          <div className="rounded-[4px] border border-[#1E1E1E] bg-[#0A0A0A] px-5 py-10 text-center">
            <p className="text-[14px] text-[#E2E4E8]">
              {onlyUnread ? "Уншаагүй мэдэгдэл алга." : "Мэдэгдэл алга."}
            </p>
            <p className="mt-1.5 text-[13px] text-[#E2E4E8]">Цэвэрхэн байна.</p>
          </div>
        )}

        {items !== null && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((n) => {
              const m = META[n.type] || META.system;
              return (
                <li
                  key={n._id}
                  className={`group relative flex items-start gap-3 rounded-[4px] border bg-[#0A0A0A] px-3 py-3 transition ${
                    n.read ? "border-[#1E1E1E]" : "border-[rgba(46,41,255,0.35)]"
                  }`}
                >
                  {!n.read && (
                    <span className="absolute left-0 top-0 h-full w-[2px] rounded-l-[4px] bg-[#2E29FF]" />
                  )}

                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px]"
                    style={{ background: `${m.color}1F`, color: m.color }}
                  >
                    <Icon name={m.icon as never} size={16} />
                  </span>

                  <Link
                    href={n.link || "/"}
                    onClick={() => !n.read && markOne(n._id)}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={`truncate text-[13.5px] font-bold ${
                          n.read ? "text-[#E2E4E8]" : "text-[#F2F2F4]"
                        }`}
                      >
                        {n.title}
                      </p>
                      <span
                        className="shrink-0 text-[10.5px] text-[#E2E4E8]"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[#E2E4E8]">
                      {n.message}
                    </p>
                  </Link>

                  <button
                    onClick={() => removeOne(n._id)}
                    aria-label="Устгах"
                    className="mt-0.5 shrink-0 text-[#333333] opacity-0 transition hover:text-[#2E29FF] focus:opacity-100 group-hover:opacity-100"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {more && (
          <div className="mt-5 flex justify-center">
            <button
              onClick={loadMore}
              disabled={busy}
              className="rounded-[4px] border border-[#262626] px-5 py-2.5 text-[13px] font-semibold text-[#E2E4E8] transition hover:border-[#2E29FF] hover:text-[#2E29FF] disabled:opacity-50"
            >
              {busy ? "Уншиж байна…" : "Дараагийнх"}
            </button>
          </div>
        )}

        {/* ── Тохиргоо ──
            Хуудасны ЁС ЁСООР доор: хүн энд эхлээд мэдэгдлээ хардаг,
            дараа нь "энэ төрлийг битгий илгээ" гэж шийддэг. Төлбөр ба
            системийн мэдэгдэл жагсаалтад БАЙХГҮЙ — тэднийг унтраах товч
            санал болгох нь хүнд өөрт нь хохиролтой. */}
        {prefs && (
          <div className="mt-8 rounded-[4px] border border-[#1E1E1E] bg-[#0A0A0A] p-4">
            <div className="chrome mb-3 text-[10px] font-bold tracking-[0.14em] text-[#E2E4E8]">
              ЮУ ХҮЛЭЭЖ АВАХ
            </div>
            {[
              { k: "newPosts", label: "Шинэ пост", hint: "Гишүүд шинэ пост нийтлэхэд" },
              { k: "newCourses", label: "Шинэ сургалт", hint: "Шинэ хичээл, курс нэмэгдэхэд" },
            ].map((row) => (
              <label
                key={row.k}
                className="flex cursor-pointer items-center justify-between gap-4 border-t border-[#1E1E1E] py-3 first:border-t-0 first:pt-0"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[#F2F2F4]">{row.label}</span>
                  <span className="block text-[11.5px] text-[#E2E4E8]">{row.hint}</span>
                </span>
                <input
                  type="checkbox"
                  checked={prefs[row.k] !== false}
                  onChange={(e) => savePref(row.k, e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-[#2E29FF]"
                />
              </label>
            ))}
            <p className="mt-3 border-t border-[#1E1E1E] pt-3 text-[11.5px] leading-relaxed text-[#E2E4E8]">
              Төлбөр болон эрхийн мэдэгдэл үргэлж ирнэ — тэдгээр нь таны
              гишүүнчлэлийн нэг хэсэг.
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
