"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMembership } from "@/lib/useMembership";
import Icon, { type IconName } from "@/components/Icon";
import DeployWatcher from "@/components/admin/DeployWatcher";
import a from "./AdminShell.module.css";

// ─────────────────────────────────────────────────────────────
// Information architecture — 38 admin pages organised into a few
// calm domains. The command palette (⌘K) indexes everything,
// including pages not surfaced in the sidebar.
// ─────────────────────────────────────────────────────────────

/* Names into the shared icon set (src/components/Icon.tsx), not path data.
   The admin used to carry its own 26-glyph Heroicons table at a different box
   size and stroke weight, which meant "settings" looked like one thing in
   /admin and another everywhere else. */
const I = {
  dash: "grid", analytics: "chart", members: "users", people: "profile",
  leads: "list", chat: "chat", class: "skills", news: "book", prompt: "spark",
  poster: "image", card: "layout", cal: "calendar", event: "ticket",
  threads: "chat", trigger: "bolt", nurture: "heart", broadcast: "megaphone",
  proactive: "star", aireply: "chat", partner: "users", credits: "money",
  money: "payment", cog: "settings", more: "menu", back: "external",
  search: "search",
} as const;

interface NavItem { href: string; label: string; icon: IconName }

const NAV_GROUPS: { section: string; items: NavItem[] }[] = [
  /* 2026-10-18: 26 → 16. 2026-10-26: «Antaqor Agent» тусдаа бүлэг (бизнес багц
     99,000₮ + гишүүд), «Нүүр слайдер» сайтын бүлэгт буцав. Бусад нь ⌘K-д — устгаагүй. */
  { section: "Өдөр бүр", items: [
    { href: "/admin", label: "Контент бүтээх", icon: I.poster },
    { href: "/admin/overview", label: "Бизнесийн тойм", icon: I.analytics },
    { href: "/admin/command", label: "Сошиал хяналт", icon: I.dash },
  ]},
  { section: "Antaqor Agent", items: [
    { href: "/admin/concierge", label: "Messenger агент", icon: I.broadcast },
    { href: "/content-agent", label: "Agent апп", icon: I.prompt },
    { href: "/content-agent?v=admin", label: "Agent хэрэглэгчид", icon: I.members },
  ]},
  { section: "Хүмүүс", items: [
    { href: "/admin/members", label: "Гишүүд", icon: I.members },
    { href: "/admin/email", label: "Email илгээх", icon: I.broadcast },
    { href: "/admin/meta/leads", label: "Leads", icon: I.leads },
  ]},
  { section: "Орлого", items: [
    { href: "/admin/economics", label: "Ашиг · Кредит", icon: I.analytics },
    { href: "/admin/billing", label: "Төлбөр · ₮", icon: I.money },
    { href: "/admin/plans", label: "Тарифын карт", icon: I.money },
    { href: "/admin/shop", label: "Дэлгүүр", icon: I.card },
  ]},
  { section: "Сайт", items: [
    { href: "/admin/brand", label: "Брэнд · SEO", icon: I.search },
    { href: "/admin/hero", label: "Нүүр слайдер", icon: I.poster },
    { href: "/admin/landing", label: "Нүүр ба Курс", icon: I.card },
    { href: "/admin/content", label: "Контент", icon: I.card },
    { href: "/admin/live", label: "Шууд сургалт", icon: I.broadcast },
    { href: "/admin/programs", label: "Хөтөлбөрүүд", icon: I.card },
    { href: "/admin/khuushuur", label: "Хуушуур меню", icon: I.card },
  ]},
  { section: "Тохиргоо", items: [
    { href: "/admin/connections", label: "Сошиал холболт", icon: I.trigger },
    { href: "/admin/automation", label: "Автоматжуулалт", icon: I.trigger },
  ]},
];

// Pages reachable via ⌘K but not pinned to the sidebar.
const EXTRA_COMMANDS: NavItem[] = [
  { href: "/admin/analytics", label: "Аналитик", icon: I.analytics },
  { href: "/admin/rent", label: "Түрээс", icon: I.card },
  { href: "/admin/watch", label: "Драм цуврал", icon: I.poster },
  { href: "/admin/circles", label: "Хүрээлэл", icon: I.card },
  { href: "/admin/magazine", label: "Magazine", icon: I.poster },
  { href: "/admin/ai-images", label: "AI зураг · Credits", icon: I.poster },
  { href: "/admin/social-automation", label: "Flow засварлагч (advanced)", icon: I.broadcast },
  { href: "/admin/broadcast", label: "Broadcast", icon: I.proactive },
  { href: "/admin/inbox", label: "Чат · DM", icon: I.chat },
  { href: "/admin/events", label: "Эвентүүд", icon: I.event },
  { href: "/admin/partnerships", label: "Хамтрах", icon: I.partner },
  { href: "/admin/people", label: "Хүмүүс", icon: I.people },
  { href: "/admin/calendar", label: "Календар", icon: I.cal },
  { href: "/admin/social", label: "Сошиал нийтлэл (FB · IG · Threads)", icon: I.broadcast },
  { href: "/admin/tiktok", label: "TikTok нийтлэх (Direct Post)", icon: I.poster },
  { href: "/admin/threads/automation", label: "Threads авто хариу", icon: I.threads },
  { href: "/admin/threads/ai", label: "Threads AI зохиогч", icon: I.threads },
  { href: "/admin/social/loop", label: "Сайжруулах давталт", icon: I.broadcast },
  { href: "/admin/pages", label: "Хуудас холбох", icon: I.trigger },
  { href: "/admin/health", label: "Холболтын эрүүл мэнд", icon: I.trigger },
  { href: "/admin/post-replies", label: "Пост тус бүрийн хариу", icon: I.trigger },
  { href: "/admin/prompt-packs", label: "Промт сан", icon: I.trigger },
  { href: "/admin/restaurants", label: "Ресторан сан · Scout", icon: I.trigger },
  { href: "/admin/scout", label: "Scout сурлага", icon: I.analytics },
  // Content editors — consolidated under /admin/content, still reachable here.
  { href: "/admin/site", label: "Сайтын контент", icon: I.card },
  { href: "/admin/homepage-cards", label: "Нүүр карт", icon: I.card },
  { href: "/admin/poster", label: "Постер", icon: I.poster },
  { href: "/admin/classroom", label: "Хичээл засварлагч", icon: I.class },
  { href: "/admin/payments", label: "Төлбөр", icon: I.money },
  { href: "/admin/credits", label: "Кредитийн эдийн засаг", icon: I.credits },
  { href: "/admin/services", label: "Үйлчилгээ", icon: I.cog },
  { href: "/admin/categories", label: "Ангилал", icon: I.cog },
  { href: "/admin/level-gate", label: "Level Gate", icon: I.cog },
  { href: "/admin/maintenance", label: "Засвартай горим", icon: I.cog },
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
  { href: "/admin", label: "Бүтээх", icon: I.poster },
  { href: "/admin/members", label: "Гишүүд", icon: I.members },
  { href: "/admin/automation", label: "Автомат", icon: I.trigger },
  { href: "/admin/email", label: "Email", icon: I.broadcast },
];

const SUPER_ADMIN_EMAILS = ["antaqor@gmail.com"];

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
    <div className={a.palBg} onClick={onClose}>
      <div className={a.pal} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Хуудас хайх">
        <div className={a.palIn}>
          <Icon name={I.search} size={20} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Хайх — хуудас руу шилжих…" />
          <kbd>ESC</kbd>
        </div>
        <div className={a.palList}>
          {results.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "#8A8E9C" }}>Илэрц алга</div>
          ) : results.map((c, i) => (
            <button key={c.section + c.href} className={a.palRow} data-on={i === active ? "" : undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => { router.push(c.href); onClose(); }}>
              <Icon name={c.icon} size={20} />
              <span>{c.label}</span>
              <small>{c.section}</small>
            </button>
          ))}
        </div>
        <div className={a.palFoot}><span>↑↓ сонгох</span><span>↵ нээх</span><span>esc хаах</span></div>
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
    return <div className={a.gate}><div className={a.loader} aria-label="Ачаалж байна" /></div>;
  }

  if (!session || !isAdmin) {
    return (
      <div className={a.gate}>
        <div className={a.gateCard}>
          <div className={a.gateIcon}><Icon name="lock" size={24} /></div>
          <h2>Хандалт хориглогдсон</h2>
          <p>Зөвхөн админ эрхтэй хэрэглэгч</p>
          <Link href="/" className={a.gateBtn}>Нүүр хуудас</Link>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const toggleSection = (sec: string) =>
    setCollapsed((prev) => { const n = new Set(prev); if (n.has(sec)) n.delete(sec); else n.add(sec); return n; });
  const name = session.user?.name || "Админ";

  return (
    /* Цайвар premium бүрхүүл (2026-10-26). `adm-mono` класс хасагдсан — globals.css дахь
       админы бараан давхарга (`html:not([data-theme=light]) … .adm-mono`) хэзээ ч
       таарахгүй болсон тул dark горим бүтцээрээ боломжгүй. */
    <div className={a.shell}>
      {/* Warns when this tab is running JS from a build the server replaced. */}
      <DeployWatcher />

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className={a.side}>
        <Link href="/admin" className={a.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-192.png" alt="" />
          <b>Antaqor</b>
          <em>Admin</em>
        </Link>

        <button className={a.search} onClick={() => setPaletteOpen(true)}>
          <Icon name={I.search} size={16} />Хайх<kbd>⌘K</kbd>
        </button>

        <nav className={a.nav} aria-label="Админ цэс">
          {NAV_GROUPS.map((group) => {
            const open = !collapsed.has(group.section);
            return (
              <div key={group.section} className={a.group}>
                <button className={a.groupBtn} onClick={() => toggleSection(group.section)} aria-expanded={open}>
                  {group.section}
                  <Icon name="chevronDown" size={12} />
                </button>
                {open && group.items.map((item) => (
                  <Link key={item.href} href={item.href} className={a.item} aria-current={isActive(item.href) ? "page" : undefined}>
                    <Icon name={item.icon} size={20} />
                    {item.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className={a.foot}>
          <Link href="/" className={a.item}><Icon name={I.back} size={20} />Сайт харах</Link>
          <div className={a.user}>
            <span className={a.avatar}>{name.charAt(0).toUpperCase()}</span>
            <div><b>{name}</b><span>{isSuperAdmin ? "Super Admin" : "Admin"}</span></div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className={a.main}>
        <div key={pathname} className={`adm-page ${pathname === "/admin" || pathname === "/admin/social" ? "" : a.pad}`}>{children}</div>
      </main>

      {/* ── COMMAND PALETTE ── */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* ── MOBILE BOTTOM BAR ── */}
      {moreOpen && (
        <>
          <div className={a.sheetBg} onClick={() => setMoreOpen(false)} />
          <div className={a.sheet}>
            <button className={a.search} style={{ display: "flex", width: "100%", minHeight: 40, padding: "0 12px", borderRadius: 10, border: "1px solid #E6E8EF", background: "#F6F7FB", color: "#6B6F7D", gap: 8, alignItems: "center" }}
              onClick={() => { setMoreOpen(false); setPaletteOpen(true); }}>
              <Icon name={I.search} size={16} />Хайх…
            </button>
            {NAV_GROUPS.map((group) => (
              <div key={group.section}>
                <h4>{group.section}</h4>
                <div className={a.sheetGrid}>
                  {group.items.map((item) => (
                    <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
                      <Icon name={item.icon} size={20} />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div className={a.sheetGrid} style={{ marginTop: 8 }}>
              <Link href="/"><Icon name={I.back} size={20} />Сайт руу</Link>
            </div>
          </div>
        </>
      )}
      <nav className={a.mbar} aria-label="Админ доод цэс">
        {MOBILE_TABS.map((item) => (
          <Link key={item.href} href={item.href} className={a.mtab} aria-current={isActive(item.href) ? "page" : undefined}>
            <Icon name={item.icon} size={24} />
            {item.label}
          </Link>
        ))}
        <button className={a.mtab} onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen}>
          <Icon name={I.more} size={24} />
          Бусад
        </button>
      </nav>
    </div>
  );
}
