"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { SUPPORT_IG_URL } from "@/lib/links";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CREDIT_PACKAGES, type CreditPackage } from "@/lib/creditPackages";
import { CreditIcon } from "@/components/CreditIcon";

/* ─── /credits/buy — кредит цэнэглэх ──────────────────────────────────────

   ⚠ 2026-09-02-нд ЗАСВАРЛАВ. Өмнөх хувилбар нээгдэхдээ дуусаагүй
   хүсэлтийг ЧИМЭЭГҮЙ сэргээж, шууд төлбөрийн дэлгэц рүү үсэрдэг байсан.
   Үр дүн: эзний данс дээр 2026-05-01-ний ₮60,000-ийн хуучин хүсэлт
   сууж байсан тул хүн "кредит авах" гэж дарах бүрд ₮60,000 гарч ирдэг
   байв — өөрөө сонгоогүй дүн, ойлгомжгүй.

   ДҮРЭМ: хуудас ҮРГЭЛЖ багц сонголтоор нээгдэнэ. Дуусаагүй хүсэлт
   байвал тэр нь ЗУРВАС болж дээр гарна — үргэлжлүүлэх эсвэл цуцлахыг
   ХҮН шийднэ. Автоматаар үсрэх нь тухтай мэт боловч хүнийг өөрийн
   сонгоогүй дүнтэй нүүр тулгадаг.

   Нуруу нь /pricing-тэй ижил: `referenceCode` + ДҮН. Банкны auto-match
   хоёуланг нь тааруулж танидаг тул харуулсан дүн, төлөх дүн ХЭЗЭЭ Ч
   зөрж болохгүй — үнэ серверээс ирнэ, энд тооцохгүй. */

const NEON = "var(--accent-ink, #2E29FF)";
const LINE = "rgba(128,128,128,0.22)";
const BANK_NAME = "Хаан банк";
const BANK_ACCOUNT = "5926153085";
const BANK_RECIPIENT = "Баянбилэг Дамбадаржаа";

type Step = "pick" | "pay" | "done";
interface Pending {
  paymentId: string; referenceCode: string; amount: number;
  credits: number; packageId: string; hasReceipt: boolean;
}

export default function CreditsBuyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><div className="h-2 w-2 animate-pulse rounded-full bg-[#2E29FF]" /></div>}>
      <BuyInner />
    </Suspense>
  );
}

function BuyInner() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const search = useSearchParams();
  const next = search?.get("next") || "/content-agent?v=image";
  const needed = Number(search?.get("need") || 0);

  const [step, setStep] = useState<Step>("pick");
  const [balance, setBalance] = useState<number | null>(null);
  /* AI Studio-ийн бодит үнэ (2026-10-26, 1 кр = 1₮) — /api/credits/prices */
  const [prices, setPrices] = useState<{ items: { label: string; credits: number }[]; image: number; video: number }>({ items: [], image: 100, video: 5620 });
  const imageCost = prices.image;
  /** Дуусаагүй хүсэлт — ЗУРВАС болж харагдана, автоматаар нээгдэхгүй. */
  const [stale, setStale] = useState<Pending | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [selected, setSelected] = useState("creator");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  /* QPay (Wire) — 2026-10-06-нд сэргээв. Нэхэмжлэх нь дүн + захиалгаа
     өөрөө авч явдаг тул код бичих, баримт хавсаргах шаардлагагүй; статусын
     асуулт (`purchase/status`) Wire-ийг шалгаад кредитийг өөрөө нэмнэ. */
  const [wireBusy, setWireBusy] = useState(false);
  const [wireErr, setWireErr] = useState("");

  useEffect(() => {
    fetch("/api/credits/prices").then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.items) && d.image && d.video) setPrices(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetch("/api/credits").then((r) => r.json())
      .then((d) => { if (typeof d.balance === "number") setBalance(d.balance); }).catch(() => {});
    fetch("/api/credits/purchase").then((r) => r.json())
      .then((d) => {
        if (!d.pending) return;
        /* ─── QPay-ээс БУЦАЖ ИРСЭН ТОХИОЛДОЛ ──────────────────────────
           Wire нь худалдан авагчийг `?wire=1`-тэй буцаана. Энэ тэмдэггүй
           бол дуусаагүй хүсэлт нь ЗУРВАС болж (`stale`) суудаг — зориуд
           тийм: хуучин мартагдсан хүсэлт хүнийг төлбөрийн дэлгэц рүү
           хүчээр чирэх ёсгүй.

           Гэвч QPay-ээс сая буцаж ирсэн хүнд тэр дүрэм эсрэгээрээ
           ажиллана: тэр мөнгөө ТӨЛЧИХСӨН байж мэднэ, атал багц сонгох
           дэлгэц рүү унана. Статусын асуулт нь зөвхөн төлбөрийн дэлгэц
           дээр ажилладаг тул кредит нь ч нэмэгдэхгүй. Тиймээс энэ ганц
           тохиолдолд шууд төлбөрийн дэлгэц рүү сэргээнэ — асуулт эхэлж,
           Wire-ийн баталгааг хараад кредит өөрөө ирнэ. */
        if (search?.get("wire")) {
          setPending(d.pending);
          setStep("pay");
        } else {
          setStale(d.pending);
        }
      }).catch(() => {});
  }, [authStatus, search]);

  // Төлбөрийн дэлгэц дээр байхад л төлөв шалгана.
  useEffect(() => {
    if (step !== "pay" || !pending?.paymentId) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/credits/purchase/status?id=${pending.paymentId}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (stop) return;
        if (typeof d.balance === "number") setBalance(d.balance);
        if (d.status === "paid") setStep("done");
        else if (d.status === "failed") {
          setNote(d.adminNote || "Төлбөр шалгагдсангүй.");
          setPending(null); setStep("pick");
        } else if (d.hasReceipt !== pending.hasReceipt) {
          setPending((p) => (p ? { ...p, hasReceipt: d.hasReceipt } : p));
        }
      } catch { /* сүлжээний түр саатал */ }
    };
    const t = setInterval(tick, 6000);
    tick();
    return () => { stop = true; clearInterval(t); };
  }, [step, pending?.paymentId, pending?.hasReceipt]);

  const start = useCallback(async (pkg: CreditPackage) => {
    setBusy(true); setErr(""); setNote("");
    try {
      const r = await fetch("/api/credits/purchase", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Алдаа");
      setPending({
        paymentId: String(d.paymentId), referenceCode: d.referenceCode, amount: d.amount,
        credits: d.credits, packageId: d.packageId, hasReceipt: !!d.hasReceipt,
      });
      setStale(null);
      setStep("pay");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Алдаа");
    } finally { setBusy(false); }
  }, []);

  const cancelStale = useCallback(async () => {
    if (!stale) return;
    setBusy(true);
    try {
      await fetch(`/api/credits/purchase?id=${stale.paymentId}`, { method: "DELETE" });
      setStale(null);
      setNote("Хуучин хүсэлт цуцлагдлаа.");
    } finally { setBusy(false); }
  }, [stale]);


  const payWithQpay = async () => {
    if (wireBusy) return;
    setWireErr(""); setWireBusy(true);
    try {
      const r = await fetch("/api/wire/checkout", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.paid) return; // аль хэдийн төлөгдсөн — poll кредитийг нэмнэ
      if (!r.ok || !d.url) {
        setWireErr(
          d.error === "wire_disabled"
            ? "QPay түр боломжгүй байна. Доорх дансаар шилжүүлнэ үү."
            : "QPay нээж чадсангүй. Доорх дансаар шилжүүлж болно."
        );
        return;
      }
      window.location.href = d.url;
    } catch {
      setWireErr("Сүлжээний алдаа. Дахин оролдоно уу.");
    } finally { setWireBusy(false); }
  };

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 1500); } catch { /* ignore */ }
  };

  const uploadReceipt = async (file: File) => {
    if (!pending) return;
    setUploading(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const ud = await up.json();
      if (!up.ok || !ud.url) throw new Error(ud.error || "Зураг хадгалж чадсангүй");
      const r = await fetch("/api/clan/receipt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptImage: ud.url, paymentId: pending.paymentId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Баримт илгээж чадсангүй");
      setPending({ ...pending, hasReceipt: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Алдаа");
    } finally { setUploading(false); }
  };

  if (authStatus === "loading") {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-2 w-2 animate-pulse rounded-full bg-[#2E29FF]" /></div>;
  }
  if (authStatus !== "authenticated") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-[22px] font-extrabold text-[var(--nav-fg-strong)]">Кредит авахын тулд нэвтэрнэ үү</h1>
        <Link href="/auth/signin?next=/credits/buy" className="press mt-5 inline-block rounded-[4px] px-6 py-3 text-[13px] font-black text-white" style={{ background: NEON }}>
          Нэвтрэх
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 pb-16 pt-2 sm:px-5">
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: NEON }}>Кредит</div>
          <h1 className="mt-1 text-[22px] font-extrabold leading-tight text-[var(--nav-fg-strong)]">
            {step === "done" ? "Кредит нэмэгдлээ" : step === "pay" ? "Шилжүүлэг хийх" : "Цэнэглэх"}
          </h1>
        </div>
        <div className="rounded-[4px] px-3 py-1.5 text-right" style={{ border: `1px solid ${LINE}` }}>
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#E2E4E8]">Үлдэгдэл</div>
          <div className="mt-0.5 flex items-center justify-end gap-1 text-[16px] font-black tabular-nums" style={{ color: NEON }}>
            <CreditIcon size={14} />{balance === null ? "…" : balance.toLocaleString("en-US")}
          </div>
        </div>
      </header>

      {needed > 0 && step === "pick" && (
        <div className="mb-3 flex items-center gap-1.5 rounded-[4px] px-3 py-2.5 text-[12.5px] text-[var(--nav-fg)]" style={{ border: `1px solid rgba(46,41,255,0.35)`, background: "rgba(46,41,255,0.06)" }}>
          Энэ үйлдэл <b className="inline-flex items-center gap-1"><CreditIcon size={11} />{needed.toLocaleString()}</b> шаардана, танд
          <b className="inline-flex items-center gap-1"><CreditIcon size={11} />{balance ?? 0}</b> байна.
        </div>
      )}
      {note && step === "pick" && (
        <div className="mb-3 rounded-[4px] px-3 py-2.5 text-[12.5px] text-[#E2E4E8]" style={{ border: `1px solid ${LINE}` }}>{note}</div>
      )}

      {/* Дуусаагүй хүсэлт — ЗУРВАС, автомат үсрэлт БИШ. */}
      {stale && step === "pick" && (
        <div className="mb-4 rounded-[4px] p-3.5" style={{ border: `1px solid ${LINE}` }}>
          <div className="text-[12.5px] font-bold text-[var(--nav-fg-strong)]">Дуусаагүй хүсэлт байна</div>
          <div className="mt-1 flex items-center gap-1 text-[11.5px] text-[#E2E4E8]">
            ₮{stale.amount.toLocaleString()} → <CreditIcon size={10} />{stale.credits.toLocaleString()} · код {stale.referenceCode}
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => { setPending(stale); setStale(null); setStep("pay"); }}
              className="press flex-1 rounded-[4px] py-2 text-[12px] font-bold text-white"
              style={{ background: NEON }}
            >
              Үргэлжлүүлэх
            </button>
            <button
              type="button"
              onClick={cancelStale}
              disabled={busy}
              className="press rounded-[4px] px-4 py-2 text-[12px] font-semibold disabled:opacity-50 border border-[#FCEE0A]/60 bg-transparent text-[#FCEE0A] hover:bg-[rgba(252,238,10,0.12)]"
            >
              Цуцлах
            </button>
          </div>
        </div>
      )}

      {err && <p className="mb-3 text-[12px] font-semibold" style={{ color: NEON }}>{err}</p>}

      {/* ═══ 1 · БАГЦ ═══════════════════════════════════════════════════ */}
      {step === "pick" && (
        <>
          {/* ═══ Higgsfield маягийн сонголт (2026-10-13): хүн кредит биш, ВИДЕО/ЗУРАГ
              худалдаж авдаг — тиймээс гол тоо нь "≈ N видео · M зураг". Видеоны
              үнэ нь серверийнхтэй ижил функц (Higgsfield токен өртөг + 25%). ═══ */}
          {(() => {
            const vid720 = prices.video;
            const idx = Math.max(0, CREDIT_PACKAGES.findIndex((x) => x.id === selected));
            const cur = CREDIT_PACKAGES[idx] || CREDIT_PACKAGES[0];
            const vids = Math.floor(cur.credits / vid720);
            const imgs = Math.floor(cur.credits / imageCost);
            return (
              <>
                <div className="rounded-[4px] p-5" style={{ border: `1px solid ${NEON}`, background: "radial-gradient(120% 120% at 100% 0%, rgba(46,41,255,0.16) 0%, transparent 60%)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[24px] font-black tracking-[-0.01em] text-[var(--nav-fg-strong)]">{cur.label.toUpperCase()}</span>
                    {cur.saving ? (
                      <span className="rounded-[4px] px-2 py-0.5 text-[12px] font-black italic" style={{ background: "#FCEE0A", color: "#0A0A0A" }}>+{cur.saving}% БОНУС</span>
                    ) : null}
                    {cur.badge && <span className="rounded-[4px] px-2 py-0.5 text-[11px] font-black" style={{ background: NEON, color: "#FFFFFF" }}>{cur.badge}</span>}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[30px] font-black leading-none tabular-nums text-[var(--nav-fg-strong)]">
                    <CreditIcon size={24} className="text-[#2E29FF]" /> {cur.credits.toLocaleString()} <span className="text-[16px] font-bold text-[#E2E4E8]">кредит{cur.saving ? ` (${Math.round(cur.credits / (1 + cur.saving / 100))} + ${cur.credits - Math.round(cur.credits / (1 + cur.saving / 100))} бонус)` : ""}</span>
                  </div>
                  <ul className="mt-3 space-y-1 text-[14.5px] text-[#E2E4E8]">
                    <li>= ≈ <b className="text-[var(--nav-fg-strong)]">{imgs.toLocaleString()}</b> AI зураг <span className="text-[12.5px]">(GPT Image 2)</span></li>
                    <li>= ≈ <b className="text-[var(--nav-fg-strong)]">{vids}</b> Kling 4.0 видео <span className="text-[12.5px]">(5с · 720p)</span></li>
                  </ul>

                  {/* Слайдер — багцуудаар гүйнэ */}
                  <input
                    type="range"
                    min={0}
                    max={CREDIT_PACKAGES.length - 1}
                    step={1}
                    value={idx}
                    onChange={(e) => setSelected(CREDIT_PACKAGES[Number(e.target.value)]?.id || selected)}
                    aria-label="Багц сонгох"
                    className="mt-5 w-full"
                    style={{ accentColor: "#2E29FF" }}
                  />
                  <div className="mt-1 flex justify-between text-[12.5px] font-bold tabular-nums">
                    {CREDIT_PACKAGES.map((p) => (
                      <button key={p.id} type="button" onClick={() => setSelected(p.id)}
                        className={p.id === selected ? "text-[var(--nav-fg-strong)]" : "text-[#9C9CA6]"}>
                        {p.credits.toLocaleString()}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="text-[34px] font-black leading-none tabular-nums text-[var(--nav-fg-strong)]">₮{cur.price.toLocaleString()}</span>
                    <span className="text-[13px] text-[#E2E4E8]">нэг удаа · 1 кредит = 1₮</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CREDIT_PACKAGES.map((p) => {
                    const sel = p.id === selected;
                    return (
                      <button key={p.id} type="button" onClick={() => setSelected(p.id)}
                        className="press rounded-[4px] p-3 text-left transition"
                        style={{ border: `1px solid ${sel ? NEON : LINE}`, background: sel ? "rgba(46,41,255,0.06)" : "transparent" }}>
                        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#E2E4E8]">{p.label}</div>
                        <div className="mt-1 text-[18px] font-black tabular-nums text-[var(--nav-fg-strong)]">{p.credits.toLocaleString()} кр{p.saving ? <span className="ml-1 text-[11px] font-black text-[#4ADE80]">+{p.saving}%</span> : null}</div>
                        <div className="text-[12.5px] font-bold tabular-nums text-[var(--nav-fg-strong)]">₮{p.price.toLocaleString()}</div>
                        <div className="mt-0.5 text-[11.5px] text-[#E2E4E8]">≈{Math.floor(p.credits / vid720)} видео · {Math.floor(p.credits / imageCost)} зураг</div>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => start(cur)}
                  className="press mt-3.5 w-full rounded-[4px] py-4 text-[16px] font-black disabled:opacity-50"
                  style={{ background: NEON, color: "#FFFFFF", boxShadow: "0 4px 0 #1E1E1E" }}
                >
                  {busy ? "Түр хүлээнэ үү…" : `Үргэлжлүүлэх · ₮${cur.price.toLocaleString()}`}
                </button>

                {/* Нэг үйлдлийн үнэ — нээлттэй, тодорхой */}
                <div className="mt-4 rounded-[4px] p-4" style={{ border: `1px solid ${LINE}` }}>
                  <div className="mb-2 text-[12px] font-black uppercase tracking-[0.14em] text-[#E2E4E8]">Нэг удаагийн үнэ</div>
                  {prices.items.map((it) => (
                    <div key={it.label} className="flex items-center justify-between py-1.5 text-[14px]">
                      <span className="text-[#E2E4E8]">{it.label}</span>
                      <span className="inline-flex items-center gap-1 font-bold tabular-nums text-[var(--nav-fg-strong)]"><CreditIcon size={12} />{it.credits.toLocaleString()} кр</span>
                    </div>
                  ))}
                  <p className="mt-2 text-[12px] text-[#9C9CA6]">1 кредит = 1₮ · AI Studio-д (antaqor.com/content-agent) ашиглана · Бүтэлгүйтвэл кредит автоматаар буцна · <Link href="/credits" className="underline">түүх</Link></p>
                </div>
              </>
            );
          })()}
        </>
      )}

      {/* ═══ 2 · ТӨЛӨХ ══════════════════════════════════════════════════ */}
      {step === "pay" && pending && (
        <>
          <button
            type="button"
            onClick={payWithQpay}
            disabled={wireBusy}
            className="press w-full rounded-[4px] bg-[#2E29FF] py-3.5 text-[14px] font-black text-white transition hover:bg-[#1F1AD9] disabled:opacity-50"
          >
            {wireBusy ? "Нээж байна…" : `QPay-ээр ₮${pending.amount.toLocaleString()} төлөх`}
          </button>
          <p className="mt-1.5 text-center text-[11px] text-[#E2E4E8]">
            Код бичих шаардлагагүй — төлмөгц кредит шууд нэмэгдэнэ.
          </p>
          {wireErr && <p className="mt-1.5 text-center text-[12px] font-semibold text-[#D81B4A]">{wireErr}</p>}
          <div className="my-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#E2E4E8]">
            <span className="h-px flex-1" style={{ background: LINE }} />эсвэл дансаар<span className="h-px flex-1" style={{ background: LINE }} />
          </div>
          <div className="rounded-[4px] p-4" style={{ border: `1px solid rgba(46,41,255,0.35)`, background: "rgba(46,41,255,0.05)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#E2E4E8]">Гүйлгээний утга</div>
                <button
                  type="button"
                  onClick={() => copy(pending.referenceCode, "code")}
                  className="mt-0.5 block text-[26px] font-black tracking-[0.14em] tabular-nums"
                  style={{ color: NEON, fontFamily: "ui-monospace, SFMono-Regular, monospace" }}
                >
                  {pending.referenceCode}
                </button>
                <div className="text-[10px] text-[#E2E4E8]">{copied === "code" ? "Хуулагдлаа ✓" : "дарж хуулна"}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#E2E4E8]">Дүн</div>
                <button type="button" onClick={() => copy(String(pending.amount), "amt")} className="mt-0.5 block text-[21px] font-black tabular-nums text-[var(--nav-fg-strong)]">
                  ₮{pending.amount.toLocaleString()}
                </button>
                <div className="flex items-center justify-end gap-1 text-[10px] text-[#E2E4E8]">
                  {copied === "amt" ? "Хуулагдлаа ✓" : <>→ <CreditIcon size={9} />{pending.credits.toLocaleString()}</>}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-[4px] p-4" style={{ border: `1px solid ${LINE}` }}>
            <div className="space-y-2 text-[12px]">
                {([
                  ["Банк", BANK_NAME, ""],
                  ["Данс", BANK_ACCOUNT, "acct"],
                  ["Хүлээн авагч", BANK_RECIPIENT, ""],
                  ["Дүн", `₮${pending.amount.toLocaleString()}`, "amt2"],
                  ["Гүйлгээний утга", pending.referenceCode, "code2"],
                ] as const).map(([k, v, ck]) => (
                  <div key={k} className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0" style={{ borderColor: LINE }}>
                    <span className="text-[#E2E4E8]">{k}</span>
                    <button
                      type="button"
                      disabled={!ck}
                      onClick={() => ck && copy(k === "Дүн" ? String(pending.amount) : String(v), ck)}
                      className="font-bold tabular-nums text-[var(--nav-fg-strong)]"
                      style={k === "Гүйлгээний утга" ? { color: NEON } : undefined}
                    >
                      {copied === ck ? "Хуулагдлаа ✓" : v}
                    </button>
                  </div>
                ))}
            </div>
          </div>

          <div className="mt-3 rounded-[4px] p-3.5 text-[12.5px] leading-relaxed" style={{ border: `1px solid rgba(46,41,255,0.35)`, background: "rgba(46,41,255,0.06)" }}>
            <b className="text-[var(--nav-fg-strong)]">Дансаар шилжүүлсэн бол:</b> гүйлгээний утга дээр <b style={{ color: NEON }}>{pending.referenceCode}</b> кодыг бичнэ.
            Шилжүүлснээс хойш <b>2 минутын дотор</b> кредит нэмэгдэнэ. Нэмэгдээгүй бол залгана уу:{" "}
            <a href="tel:94641031" className="font-black underline" style={{ color: NEON }}>94641031</a>
          </div>

          <div className="mt-3 rounded-[4px] p-4 text-center" style={{ border: `1px dashed ${LINE}` }}>
            {pending.hasReceipt ? (
              <>
                <div className="text-[12.5px] font-bold text-[var(--nav-fg-strong)]">✓ Баримт илгээгдлээ</div>
                <div className="mt-1 text-[11.5px] text-[#E2E4E8]">Админ шалгаж байна. Батлагдмагц энэ дэлгэц өөрөө шинэчлэгдэнэ.</div>
                <div className="mt-3 inline-flex items-center gap-2 text-[11px]" style={{ color: NEON }}>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: NEON }} /> Хүлээж байна…
                </div>
              </>
            ) : (
              <>
                <div className="text-[12.5px] font-bold text-[var(--nav-fg-strong)]">Шилжүүлсэн үү?</div>
                <div className="mt-1 text-[11.5px] text-[#E2E4E8]">Баримтын зургаа оруулбал хурдан батлагдана.</div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadReceipt(f); if (fileRef.current) fileRef.current.value = ""; }} />
                <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="press mt-3 rounded-[4px] px-5 py-2.5 text-[12px] font-black text-white disabled:opacity-50" style={{ background: NEON }}>
                  {uploading ? "Илгээж байна…" : "Баримт оруулах"}
                </button>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between text-[11px] text-[#E2E4E8]">
            <button type="button" onClick={() => { setStale(pending); setPending(null); setStep("pick"); }} className="underline">
              Өөр багц сонгох
            </button>
            <a href={SUPPORT_IG_URL} target="_blank" rel="noopener noreferrer" className="underline">Тусламж</a>
          </div>
        </>
      )}

      {/* ═══ 3 · БЭЛЭН ══════════════════════════════════════════════════ */}
      {step === "done" && (
        <div className="rounded-[4px] p-6 text-center" style={{ border: `1px solid rgba(46,41,255,0.4)`, background: "rgba(46,41,255,0.06)" }}>
          <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: NEON }}>Амжилттай</div>
          <div className="mt-2 flex items-center justify-center gap-2 text-[40px] font-black leading-none tabular-nums text-[var(--nav-fg-strong)]">
            <CreditIcon size={30} className="text-[#2E29FF]" />{balance ?? "…"}
          </div>
          <div className="mt-1.5 text-[12px] text-[#E2E4E8]">
            ≈{Math.floor((balance || 0) / imageCost)} зураг үүсгэх боломжтой
          </div>
          <button type="button" onClick={() => router.push(next)} className="press mt-5 w-full rounded-[4px] py-3.5 text-[14px] font-black text-white" style={{ background: NEON }}>
            Зураг үүсгэх →
          </button>
        </div>
      )}
    </div>
  );
}
