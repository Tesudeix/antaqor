"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMembership } from "@/lib/useMembership";

// ─────────────────────────────────────────────────────────────
// Information architecture — 38 admin pages organised into a few
// calm domains. The command palette (⌘K) indexes everything,
// including pages not surfaced in the sidebar.
// ─────────────────────────────────────────────────────────────

const I = {
  dash: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
  analytics: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  members: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  people: "M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z",
  leads: "M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z",
  chat: "M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z",
  class: "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5",
  news: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25",
  prompt: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z",
  poster: "M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.764m3.42 3.42a6.776 6.776 0 00-3.42-3.42",
  card: "M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z",
  cal: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
  event: "M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z",
  threads: "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z",
  trigger: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
  nurture: "M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z",
  broadcast: "M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v3.75a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 16.5A2.25 2.25 0 016 14.25h12a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18v-1.5z",
  proactive: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z",
  aireply: "M7.5 8.25h9m-9 3H12m9 0a8.966 8.966 0 01-2.31 6.02L21 21l-3.73-1.31A9 9 0 1121 11.25z",
  partner: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z",
  credits: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  money: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z",
  cog: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z",
  more: "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5",
  back: "M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25",
  search: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
};

interface NavItem { href: string; label: string; icon: string }

const NAV_GROUPS: { section: string; items: NavItem[] }[] = [
  { section: "Үндсэн", items: [
    { href: "/admin", label: "Хянах самбар", icon: I.dash },
    { href: "/admin/analytics", label: "Аналитик", icon: I.analytics },
  ]},
  { section: "Хүмүүс", items: [
    { href: "/admin/members", label: "Гишүүд", icon: I.members },
    { href: "/admin/email", label: "Email илгээх", icon: I.broadcast },
    { href: "/admin/meta/leads", label: "Leads", icon: I.leads },
  ]},
  { section: "Контент", items: [
    { href: "/admin/landing", label: "Нүүр ба Курс", icon: I.card },
    { href: "/admin/content", label: "Контент", icon: I.card },
    { href: "/admin/hero", label: "Нүүр слайдер", icon: I.poster },
    { href: "/admin/courses", label: "Хичээл", icon: I.class },
  ]},
  { section: "Automation", items: [
    { href: "/admin/automation", label: "Автоматжуулалт", icon: I.trigger },
    { href: "/admin/broadcast", label: "Broadcast", icon: I.proactive },
  ]},
  { section: "Орлого", items: [
    { href: "/admin/billing", label: "Төлбөр · ₮", icon: I.money },
  ]},
];

// Pages reachable via ⌘K but not pinned to the sidebar.
const EXTRA_COMMANDS: NavItem[] = [
  { href: "/admin/automation", label: "Автоматжуулалт", icon: I.trigger },
  { href: "/admin/social-automation", label: "Flow засварлагч (advanced)", icon: I.broadcast },
  { href: "/admin/broadcast", label: "Broadcast", icon: I.proactive },
  { href: "/admin/inbox", label: "Чат · DM", icon: I.chat },
  { href: "/admin/events", label: "Эвентүүд", icon: I.event },
  { href: "/admin/partnerships", label: "Хамтрах", icon: I.partner },
  { href: "/admin/people", label: "Хүмүүс", icon: I.people },
  { href: "/admin/calendar", label: "Календар", icon: I.cal },
  { href: "/admin/threads/automation", label: "Threads авто хариу", icon: I.threads },
  { href: "/admin/pages", label: "Хуудас холбох", icon: I.trigger },
  // Content editors — consolidated under /admin/content, still reachable here.
  { href: "/admin/site", label: "Сайтын контент", icon: I.card },
  { href: "/admin/homepage-cards", label: "Нүүр карт", icon: I.card },
  { href: "/admin/poster", label: "Постер", icon: I.poster },
  { href: "/admin/classroom", label: "Хичээл засварлагч", icon: I.class },
  { href: "/admin/payments", label: "Төлбөр", icon: I.money },
  { href: "/admin/services", label: "Үйлчилгээ", icon: I.cog },
  { href: "/admin/categories", label: "Ангилал", icon: I.cog },
  { href: "/admin/level-gate", label: "Level Gate", icon: I.cog },
  { href: "/admin/security", label: "Аюулгүй байдал", icon: I.cog },
  { href: "/admin/testimonials", label: "Сэтгэгдэл", icon: I.card },
  { href: "/admin/agents", label: "Агентууд", icon: I.proactive },
  { href: "/admin/agents-feed", label: "Агент фийд", icon: I.news },
  { href: "/admin/antaqor-mind", label: "Antaqor Mind", icon: I.proactive },
  { href: "/admin/clients", label: "Үйлчлүүлэгч", icon: I.people },
  { href: "/admin/threads", label: "Threads нийтлэл", icon: I.threads },
  { href: "/admin/threads/replies", label: "Threads хариулт", icon: I.chat },
  { href: "/admin/more", label: "Бусад", icon: I.more },
];

const COMMANDS: (NavItem & { section: string })[] = [
  ...NAV_GROUPS.flatMap((g) => g.items.map((it) => ({ ...it, section: g.section }))),
  ...EXTRA_COMMANDS.map((it) => ({ ...it, section: "Бусад" })),
];

const MOBILE_TABS: NavItem[] = [
  { href: "/admin", label: "Хянах самбар", icon: I.dash },
  { href: "/admin/members", label: "Гишүүд", icon: I.members },
  { href: "/admin/automation", label: "Автомат", icon: I.trigger },
  { href: "/admin/email", label: "Email", icon: I.broadcast },
];

const SUPER_ADMIN_EMAILS = ["antaqor@gmail.com"];

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// ⌘K Command Palette
// ─────────────────────────────────────────────────────────────
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return COMMANDS;
    return COMMANDS.filter((c) => (c.label + " " + c.section + " " + c.href).toLowerCase().includes(t));
  }, [q]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    if (open) { setQ(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const sel = results[active];
        if (sel) { router.push(sel.href); onClose(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, active, router, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0E0E12] shadow-[0_20px_70px_rgba(0,0,0,0.7)]">
        <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.06)] px-4">
          <Icon d={I.search} className="h-4 w-4 shrink-0 text-[#56565E]" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Хайх — хуудас руу шилжих…"
            className="w-full bg-transparent py-4 text-[15px] text-[#E8E8E8] outline-none placeholder:text-[#56565E]" />
          <kbd className="hidden shrink-0 rounded border border-[rgba(255,255,255,0.1)] px-1.5 py-0.5 text-[10px] text-[#8A8A92] sm:block">ESC</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-[#56565E]">Илэрц алга</div>
          ) : results.map((c, i) => (
            <button key={c.href}
              onMouseEnter={() => setActive(i)}
              onClick={() => { router.push(c.href); onClose(); }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${i === active ? "bg-[rgba(16,128,202,0.12)]" : ""}`}>
              <Icon d={c.icon} className={`h-[18px] w-[18px] shrink-0 ${i === active ? "text-[#1080CA]" : "text-[#56565E]"}`} />
              <span className={`flex-1 text-[14px] ${i === active ? "font-semibold text-white" : "text-[#8A8A92]"}`}>{c.label}</span>
              <span className="text-[10px] uppercase tracking-[0.1em] text-[#56565E]">{c.section}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-[rgba(255,255,255,0.06)] px-4 py-2.5 text-[10px] text-[#56565E]">
          <span>↑↓ сонгох</span><span>↵ нээх</span><span>esc хаах</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { isAdmin: dbAdmin } = useMembership();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [moreOpen, setMoreOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(session?.user?.email?.toLowerCase() || "");
  const isAdmin = isSuperAdmin || dbAdmin;

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  // Global ⌘K / Ctrl+K to open the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-[rgba(16,128,202,0.2)]" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#1080CA]" />
          </div>
          <p className="text-[11px] tracking-[0.1em] text-[#56565E]">LOADING</p>
        </div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-none border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(16,128,202,0.1)]">
            <Icon d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" className="h-6 w-6 text-[#1080CA]" />
          </div>
          <h2 className="text-[18px] font-bold text-[#E8E8E8]">Хандалт хориглогдсон</h2>
          <p className="mt-2 text-[13px] text-[#56565E]">Зөвхөн админ эрхтэй хэрэглэгч</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-[4px] bg-[#1080CA] px-6 py-3 text-[13px] font-bold text-[#0E0E10] transition hover:bg-[#0C669E]">
            Нүүр хуудас
          </Link>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const toggleSection = (s: string) =>
    setCollapsed((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  return (
    <div className="flex min-h-[60vh] -mx-6 -my-8 md:-mx-10">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden w-[232px] flex-col border-r border-[rgba(16,128,202,0.35)] bg-black md:flex">
        {/* Brand */}
        <div className="px-5 pt-6 pb-4">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#F4F0E8]">ANTAQOR<span className="text-[#1080CA]">///</span></div>
          <div className="mt-0.5 font-mono text-[15px] font-bold uppercase tracking-[0.08em] text-[#1080CA]">Admin</div>
        </div>

        {/* ⌘K search trigger */}
        <div className="px-3 pb-2">
          <button onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center justify-between rounded-none border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[#8A8A92] transition hover:border-[rgba(255,255,255,0.14)] hover:text-[#8A8A92]">
            <span className="flex items-center gap-2 text-[12px]"><Icon d={I.search} className="h-3.5 w-3.5" />Хайх</span>
            <kbd className="rounded border border-[rgba(255,255,255,0.1)] px-1.5 py-0.5 text-[9px] font-medium">⌘K</kbd>
          </button>
        </div>

        {/* Grouped nav */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-2">
          {NAV_GROUPS.map((group) => {
            const isCollapsed = collapsed.has(group.section);
            return (
              <div key={group.section} className="mb-3">
                <button onClick={() => toggleSection(group.section)}
                  className="group flex w-full items-center justify-between px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3f3f3f] transition hover:text-[#8A8A92]">
                  {group.section}
                  <Icon d="M19.5 8.25l-7.5 7.5-7.5-7.5" className={`h-3 w-3 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                </button>
                {!isCollapsed && group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href}
                      className={`group relative mb-0.5 flex items-center gap-3 rounded-none px-2.5 py-2 transition-all duration-150 ${
                        active ? "bg-[rgba(16,128,202,0.12)] text-[#1080CA]" : "text-[#8A8A92] hover:bg-[rgba(255,255,255,0.03)] hover:text-[#E8E8E8]"
                      }`}>
                      {active && <div className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full bg-[#1080CA]" />}
                      <Icon d={item.icon} className={`h-[17px] w-[17px] shrink-0 ${active ? "text-[#1080CA]" : "text-[#56565E] group-hover:text-[#5b6573]"}`} />
                      <span className={`text-[13px] ${active ? "font-semibold" : "font-medium"}`}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-[rgba(255,255,255,0.06)] p-3">
          <Link href="/" className="flex items-center gap-2.5 rounded-none px-2.5 py-2 text-[#8A8A92] transition hover:bg-[rgba(255,255,255,0.03)] hover:text-[#E8E8E8]">
            <Icon d={I.back} className="h-[17px] w-[17px] shrink-0" />
            <span className="text-[12px] font-medium">Сайт харах</span>
          </Link>
          {session?.user && (
            <div className="mt-2 flex items-center gap-2.5 rounded-none bg-[rgba(255,255,255,0.03)] px-2.5 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(16,128,202,0.15)] text-[10px] font-bold text-[#1080CA]">
                {session.user.name?.charAt(0) || "A"}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-[#8A8A92]">{session.user.name}</div>
                <div className="truncate text-[10px] text-[#56565E]">{isSuperAdmin ? "Super Admin" : "Admin"}</div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 overflow-x-hidden pb-24 md:pb-0">
        <div className="p-4 sm:p-6 md:p-8">{children}</div>
      </main>

      {/* ── COMMAND PALETTE ── */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* ── MOBILE BOTTOM BAR ── */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setMoreOpen(false)} />
            <div className="relative z-50 mx-3 mb-2 max-h-[70vh] overflow-y-auto rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-3 shadow-2xl">
              <button onClick={() => { setMoreOpen(false); setPaletteOpen(true); }}
                className="mb-3 flex w-full items-center gap-2 rounded-none border border-[rgba(255,255,255,0.07)] px-3 py-2.5 text-[13px] text-[#8A8A92]">
                <Icon d={I.search} className="h-4 w-4" /> Хайх…
              </button>
              {NAV_GROUPS.map((group) => (
                <div key={group.section} className="mb-3">
                  <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#56565E]">{group.section}</div>
                  <div className="grid grid-cols-4 gap-1">
                    {group.items.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link key={item.href} href={item.href}
                          className={`flex flex-col items-center gap-1.5 rounded-none px-2 py-3 transition ${active ? "bg-[rgba(16,128,202,0.12)]" : "hover:bg-[rgba(255,255,255,0.04)]"}`}>
                          <Icon d={item.icon} className={`h-5 w-5 ${active ? "text-[#1080CA]" : "text-[#8A8A92]"}`} />
                          <span className={`text-center text-[9px] font-medium leading-tight ${active ? "text-[#1080CA]" : "text-[#8A8A92]"}`}>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
              <Link href="/" className="mt-1 flex items-center gap-2 rounded-none px-3 py-2.5 text-[#8A8A92] transition hover:bg-[rgba(255,255,255,0.04)]">
                <Icon d={I.back} className="h-4 w-4" /><span className="text-[12px] font-medium">Сайт руу буцах</span>
              </Link>
            </div>
          </>
        )}
        <div className="border-t border-[rgba(255,255,255,0.08)] bg-black/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
            {MOBILE_TABS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href} className="flex flex-1 flex-col items-center gap-0.5 py-2.5">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-none transition ${active ? "bg-[rgba(16,128,202,0.15)]" : ""}`}>
                    <Icon d={item.icon} className={`h-5 w-5 ${active ? "text-[#1080CA]" : "text-[#56565E]"}`} />
                  </div>
                  <span className={`text-[9px] font-semibold ${active ? "text-[#1080CA]" : "text-[#56565E]"}`}>{item.label}</span>
                </Link>
              );
            })}
            <button onClick={() => setMoreOpen(!moreOpen)} className="flex flex-1 flex-col items-center gap-0.5 py-2.5">
              <div className={`flex h-7 w-7 items-center justify-center rounded-none transition ${moreOpen ? "bg-[rgba(16,128,202,0.15)]" : ""}`}>
                <Icon d={I.more} className={`h-5 w-5 ${moreOpen ? "text-[#1080CA]" : "text-[#56565E]"}`} />
              </div>
              <span className={`text-[9px] font-semibold ${moreOpen ? "text-[#1080CA]" : "text-[#56565E]"}`}>Бусад</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
