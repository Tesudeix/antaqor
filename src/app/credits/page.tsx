"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { CreditIcon } from "@/components/CreditIcon";

/* ─── /credits — миний кредит ─────────────────────────────────────────────
   Баланс · юунд зарцуулав / хаанаас олов (CreditTx) · цэнэглэх · студи руу.
   2026-05-д /clan руу redirect болгосон байсан; AI зураг кредитээр
   ажилладаг болсон тул (2026-09-02) дахин жинхэнэ хуудас.                 */

const NEON = "var(--accent-ink, #2E29FF)";

interface Tx { _id: string; kind: "earn" | "spend"; amount: number; reason: string; balanceAfter: number; createdAt: string; meta?: Record<string, unknown> }

const LABELS: Record<string, string> = {
  AI_STUDIO: "AI Studio",
  AI_STUDIO_REFUND: "AI Studio · буцаалт",
  MEMBERSHIP_BONUS: "Гишүүнчлэлийн бэлэг",
  rebase_1kr_1mnt: "1 кр = 1₮ болгосон (×100)",
  AI_IMAGE_GEN: "AI зураг",
  AI_IMAGE_GEN_REFUND: "AI зураг · буцаалт",
  PURCHASE: "Цэнэглэлт",
  LIKE_RECEIVED: "Лайк → кредит",
  SIGNUP_BONUS: "Тавтай морил",
  REFERRAL_SIGNUP: "Найз бүртгүүлсэн",
  REFERRAL_PAID: "Найз гишүүн болсон",
  SHARE_POST: "Пост хуваалцсан",
  POST_CREATE: "Пост нийтэлсэн",
  DAILY_LOGIN: "Өдөр тутмын нэвтрэлт",
  ADMIN_ADJUST: "Админ тохируулга",
  REDEEM_MEMBERSHIP: "Гишүүнчлэл",
  AI_COMPOSE: "AI compose",
  AI_CHARACTER_SHEET: "Character sheet",
  AI_SWAP_PRODUCT: "Product swap",
  PROMPT_UNLOCK: "Промпт нээсэн",
  AGENT_CHAT: "Агенттай ярьсан",
};

function label(reason: string): string {
  if (LABELS[reason]) return LABELS[reason];
  if (reason.endsWith("_REFUND")) return `${label(reason.replace(/_REFUND$/, ""))} · буцаалт`;
  if (reason.endsWith("_MEMBER")) return "AI чат";
  return reason.toLowerCase().replace(/_/g, " ");
}

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("mn-MN", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
}

export default function CreditsPage() {
  const { status } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [lifetime, setLifetime] = useState(0);
  const [history, setHistory] = useState<Tx[]>([]);
  const [images, setImages] = useState<{ total: number; creditsSpent: number } | null>(null);
  const [studioImage, setStudioImage] = useState(100);
  const [pricing, setPricing] = useState<{ costs: Record<string, number>; likesPerCredit: number; likeMilestoneCredits: number } | null>(null);

  useEffect(() => {
    fetch("/api/tools/image-pricing").then((r) => r.json()).then(setPricing).catch(() => {});
    /* AI Studio-ийн бодит зургийн үнэ (2026-10-26, 1 кр = 1₮) */
    fetch("/api/credits/prices").then((r) => r.json()).then((d) => { if (d?.image) setStudioImage(d.image); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/credits").then((r) => r.json()).then((d) => {
      if (typeof d.balance === "number") setBalance(d.balance);
      setLifetime(d.lifetime || 0);
      setHistory(Array.isArray(d.history) ? d.history.filter((t: Tx) => t.amount > 0) : []);
    }).catch(() => {});
    fetch("/api/tools/image-history?limit=1").then((r) => r.json()).then((d) => setImages({ total: d.total || 0, creditsSpent: d.creditsSpent || 0 })).catch(() => {});
  }, [status]);

  if (status === "loading") return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-2 w-2 animate-pulse rounded-full bg-[#2E29FF]" /></div>;
  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-[22px] font-extrabold text-[var(--nav-fg-strong)]">Кредит харахын тулд нэвтэрнэ үү</h1>
        <Link href="/auth/signin?next=/credits" className="mt-5 inline-block rounded-[4px] px-6 py-3 text-[13px] font-black text-white" style={{ background: NEON }}>Нэвтрэх</Link>
      </div>
    );
  }

  const nano2 = studioImage;
  const imagesLeft = balance != null ? Math.floor(balance / nano2) : null;

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-16 pt-2 sm:px-5">
      <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: NEON }}>Кредит</div>

      {/* Balance hero */}
      <div className="mt-2 rounded-[4px] border p-5" style={{ borderColor: "rgba(46,41,255,0.3)", background: "rgba(46,41,255,0.05)" }}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#E2E4E8]">Үлдэгдэл</div>
            <div className="mt-1 text-[44px] font-black leading-none tabular-nums text-[var(--nav-fg-strong)]">
              <CreditIcon size={30} className="mr-1.5 text-[#2E29FF]" />{balance === null ? "…" : balance.toLocaleString("en-US")}
            </div>
            <div className="mt-1.5 text-[12px] text-[#E2E4E8]">
              {imagesLeft != null ? `≈ ${imagesLeft.toLocaleString("en-US")} AI зураг (AI Studio) · 1 кр = 1₮` : ""}{lifetime ? ` · нийт ${lifetime.toLocaleString()} олсон` : ""}
            </div>
          </div>
          <Link href="/credits/buy" className="press shrink-0 rounded-[4px] px-4 py-2.5 text-[12px] font-black text-white" style={{ background: NEON, boxShadow: "0 0 14px rgba(46,41,255,0.35)" }}>
            + Цэнэглэх
          </Link>
        </div>
      </div>

      {/* Quick facts */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { k: "AI зураг", icon: false, v: images ? String(images.total) : "…", s: `${images?.creditsSpent ?? 0} кредит зарцуулсан` },
          { k: "1 зураг", icon: true, v: `${nano2}`, s: "GPT Image 2 · AI Studio" },
          { k: "Лайк", icon: false, v: `${pricing?.likesPerCredit ?? 10} = ${pricing?.likeMilestoneCredits ?? 1}`, s: "лайк тутамд кредит" },
        ].map((x) => (
          <div key={x.k} className="rounded-[4px] border border-[rgba(128,128,128,0.2)] p-3">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#E2E4E8]">{x.k}</div>
            <div className="mt-1 flex items-center gap-1 text-[16px] font-black tabular-nums text-[var(--nav-fg-strong)]">{x.icon && <CreditIcon size={12} className="text-[#2E29FF]" />}{x.v}</div>
            <div className="text-[10px] text-[#E2E4E8]">{x.s}</div>
          </div>
        ))}
      </div>

      <Link href="/content-agent?v=image" className="press mt-3 flex items-center justify-between rounded-[4px] border border-[rgba(128,128,128,0.2)] px-4 py-3 transition hover:border-[rgba(46,41,255,0.5)]">
        <span>
          <span className="block text-[13px] font-bold text-[var(--nav-fg-strong)]">AI зураг үүсгэх</span>
          <span className="block text-[11px] text-[#E2E4E8]">Nano Banana 2 · Pro · Lite · зураг засах</span>
        </span>
        <span className="text-[13px] font-black" style={{ color: NEON }}>→</span>
      </Link>

      {/* History */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#E2E4E8]">Түүх</div>
          <div className="text-[10px] text-[#E2E4E8]">сүүлийн 30</div>
        </div>
        {history.length === 0 ? (
          <div className="rounded-[4px] border border-dashed border-[rgba(128,128,128,0.25)] p-6 text-center text-[12px] text-[#E2E4E8]">
            Гүйлгээ алга. Эхний зургаа үүсгэ, эсвэл цэнэглэ.
          </div>
        ) : (
          <ul className="divide-y divide-[rgba(128,128,128,0.12)] rounded-[4px] border border-[rgba(128,128,128,0.2)]">
            {history.map((t) => (
              <li key={t._id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-semibold text-[var(--nav-fg-strong)]">{label(t.reason)}</div>
                  <div className="truncate text-[10px] text-[#E2E4E8]">
                    {when(t.createdAt)}{typeof t.meta?.model === "string" ? ` · ${t.meta.model}` : ""}{typeof t.meta?.prompt === "string" ? ` · ${t.meta.prompt}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[13px] font-black tabular-nums" style={{ color: t.kind === "earn" ? "#4ADE80" : NEON }}>
                    {t.kind === "earn" ? "+" : "−"}{t.amount}
                  </div>
                  <div className="flex items-center justify-end gap-0.5 text-[10px] tabular-nums text-[#E2E4E8]">= <CreditIcon size={9} />{t.balanceAfter}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
