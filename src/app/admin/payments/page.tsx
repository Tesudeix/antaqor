"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const BANK_ACCOUNT = "5926153085";
const BANK_NAME = "Хаан банк";

type Status = "pending" | "paid" | "failed";

type OutcomeStatus = "match" | "no-match" | "amount-mismatch" | "already-paid" | "failed" | "approved";

interface AutoMatchOutcome {
  rawLine: string;
  parsedRefCode: string;
  parsedAmount: number;
  status: OutcomeStatus;
  payment?: {
    _id: string;
    expectedAmount: number;
    status: string;
    user: { _id: string; name: string; email: string; avatar?: string } | null;
  };
  error?: string;
}

interface AutoMatchResult {
  summary: {
    parsedLines: number;
    matches: number;
    approved: number;
    amountMismatches: number;
    noMatches: number;
    alreadyPaid: number;
    failed: number;
  };
  outcomes: AutoMatchOutcome[];
  executed: boolean;
}

interface Payment {
  _id: string;
  amount: number;
  status: Status;
  referenceCode: string;
  receiptImage: string;
  receiptUploadedAt?: string;
  claimedAt?: string;
  adminNote: string;
  paidAt?: string;
  createdAt: string;
  user: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
    phone?: string;
    instagram?: string;
    level?: number;
    subscriptionExpiresAt?: string;
    clan?: string;
  } | null;
}

function relative(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "сая";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ц`;
  const d = Math.floor(h / 24);
  return `${d} өдөр`;
}

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState<Status>("pending");
  const [items, setItems] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [counts, setCounts] = useState<{ pending: number; pendingWithReceipt: number }>({ pending: 0, pendingWithReceipt: 0 });
  const [autoMatchOpen, setAutoMatchOpen] = useState(false);
  const [statementText, setStatementText] = useState("");
  const [autoMatching, setAutoMatching] = useState(false);
  const [autoMatchResult, setAutoMatchResult] = useState<AutoMatchResult | null>(null);
  const [autoApproving, setAutoApproving] = useState(false);
  const [autoMatchErr, setAutoMatchErr] = useState("");

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  };

  const load = useCallback(async (current: Status) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payments?status=${current}&limit=50`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setCounts(data.counts || { pending: 0, pendingWithReceipt: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(status); }, [status, load]);

  // Auto-refresh pending tab every 20s
  useEffect(() => {
    if (status !== "pending") return;
    const t = setInterval(() => load("pending"), 20_000);
    return () => clearInterval(t);
  }, [status, load]);

  const approve = async (p: Payment) => {
    if (!confirm(`${p.user?.name} · ₮${p.amount.toLocaleString()} · 30 хоног идэвхжүүлэх үү?`)) return;
    setProcessingId(p._id);
    try {
      const res = await fetch(`/api/admin/payments/${p._id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 30 }),
      });
      const data = await res.json();
      if (res.ok) {
        showFlash(`${p.user?.name} идэвхжлээ`);
        load(status);
      } else {
        showFlash("Алдаа: " + (data.error || "failed"));
      }
    } finally {
      setProcessingId(null);
    }
  };

  const runAutoMatch = useCallback(async (text: string, execute: boolean) => {
    if (!text.trim()) return;
    const setter = execute ? setAutoApproving : setAutoMatching;
    setter(true);
    setAutoMatchErr("");
    try {
      const res = await fetch("/api/admin/payments/auto-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statementText: text, execute, days: 30 }),
      });
      const data = await res.json();
      if (res.ok) {
        setAutoMatchResult(data);
        if (execute) {
          showFlash(`${data.summary.approved} төлбөр идэвхжлээ`);
          load(status);
        }
      } else {
        setAutoMatchErr(data.error || "parse failed");
      }
    } catch {
      setAutoMatchErr("Network error");
    } finally {
      setter(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Auto-preview-match on paste/typing (debounced 400ms)
  useEffect(() => {
    const text = statementText.trim();
    if (!text) {
      setAutoMatchResult(null);
      return;
    }
    // Don't auto-fire if we just executed — keep the success state visible
    if (autoMatchResult?.executed) return;
    const t = setTimeout(() => { runAutoMatch(text, false); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statementText]);

  const reject = async () => {
    if (!rejectingId) return;
    const note = rejectNote.trim() || "Баримт шалгагдсангүй. Дахин шилжүүлж оролдоорой.";
    setProcessingId(rejectingId);
    try {
      const res = await fetch(`/api/admin/payments/${rejectingId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (res.ok) {
        showFlash("Татгалзсан");
        setRejectingId(null);
        setRejectNote("");
        load(status);
      }
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      {flash && (
        <div className="fixed top-4 right-4 z-50 rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-4 py-2.5 text-[13px] text-[#E8E8E8] shadow-xl">
          {flash}
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <img src={lightbox} alt="Receipt full size" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {rejectingId && (
        <div onClick={() => setRejectingId(null)} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
            <h3 className="text-[16px] font-bold text-[#E8E8E8]">Татгалзах шалтгаан</h3>
            <p className="mt-1 text-[12px] text-[#888]">Хэрэглэгчид энэ мессеж push-аар очино.</p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder='Жишээ: "Дүн таарсангүй", "Reference код тохирсонгүй"'
              rows={3}
              maxLength={500}
              className="mt-3 w-full resize-y rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#EF2C58]"
            />
            <div className="mt-3 flex gap-2">
              <button onClick={() => setRejectingId(null)} className="flex-1 rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#141414] py-2.5 text-[13px] font-bold text-[#AAA]">Болих</button>
              <button onClick={reject} disabled={processingId === rejectingId} className="flex-1 rounded-[8px] bg-[#EF4444] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#DC3737] disabled:opacity-50">
                {processingId === rejectingId ? "..." : "Татгалзах"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E8E8]">Payments</h1>
          <p className="mt-0.5 text-[12px] text-[#555]">
            {counts.pending} хүлээгдэж буй · {counts.pendingWithReceipt} баримттай · 20 сек тутам шинэчлэгдэнэ
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(status)} className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#141414] px-3 py-2 text-[12px] text-[#AAA] hover:text-[#EF2C58]">
            Шинэчлэх
          </button>
        </div>
      </div>

      {/* Auto-match bank statement */}
      <div className="overflow-hidden rounded-[10px] border border-[rgba(34,197,94,0.2)] bg-gradient-to-br from-[rgba(34,197,94,0.05)] via-[#111] to-[#111]">
        <button
          onClick={() => setAutoMatchOpen(!autoMatchOpen)}
          className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[rgba(34,197,94,0.04)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(34,197,94,0.15)]">
              <svg className="h-5 w-5 text-[#22C55E]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-[#E8E8E8]">Банкны хуулга copy → auto-match</span>
                <span className="rounded-full bg-[#22C55E] px-1.5 py-0.5 text-[9px] font-black uppercase text-white">BETA</span>
              </div>
              <div className="mt-0.5 text-[11px] text-[#888]">
                {BANK_NAME} · {BANK_ACCOUNT} · refCode + дүн таарвал autoapprove
              </div>
            </div>
          </div>
          <svg className={`h-4 w-4 text-[#666] transition-transform ${autoMatchOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {autoMatchOpen && (
          <div className="space-y-3 border-t border-[rgba(255,255,255,0.06)] bg-[#0D0D0D] p-4">
            <textarea
              value={statementText}
              onChange={(e) => setStatementText(e.target.value)}
              placeholder={"Банкны апп-аас copy → энд paste.\nСистем автоматаар refCode + дүнгээр таарна.\n\nЖишээ мөр:\n+49,000₮ · AB7K9X · Bayanbileg B\n[2026.04.25 14:30] ₮49,000 · XY9K2M · Bold"}
              rows={7}
              className="w-full resize-y rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[12px] leading-relaxed text-[#E8E8E8] placeholder-[#444] outline-none focus:border-[#22C55E]"
            />
            <p className="-mt-1 text-[10px] text-[#555]">
              Paste хийхэд автоматаар таарал шалгана. Баталгаажуулахын тулд зөвхөн дээрх ногоон товчийг дар.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {autoMatching && (
                <div className="flex items-center gap-1.5 rounded-[8px] bg-[#0A0A0A] px-3 py-2 text-[11px] text-[#888]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#22C55E]" />
                  Хуулга шалгаж байна...
                </div>
              )}
              {!autoMatching && autoMatchResult && autoMatchResult.summary.matches > 0 && !autoMatchResult.executed && (
                <button
                  onClick={() => runAutoMatch(statementText, true)}
                  disabled={autoApproving}
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-[8px] bg-[#22C55E] px-6 py-2.5 text-[13px] font-black text-white shadow-[0_0_24px_rgba(34,197,94,0.25)] transition hover:shadow-[0_0_40px_rgba(34,197,94,0.45)] disabled:opacity-40"
                >
                  <span className="relative z-10">
                    {autoApproving ? "Идэвхжүүлж..." : `✓ ${autoMatchResult.summary.matches} тохирлыг идэвхжүүлэх`}
                  </span>
                  {!autoApproving && (
                    <svg className="relative z-10 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  )}
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                </button>
              )}
              {autoMatchResult?.executed && (
                <div className="flex items-center gap-2 rounded-[8px] bg-[rgba(34,197,94,0.1)] px-3 py-2 text-[12px] font-bold text-[#22C55E]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  {autoMatchResult.summary.approved} төлбөр идэвхжсэн
                </div>
              )}
              {autoMatchErr && (
                <div className="text-[11px] text-[#EF4444]">Алдаа: {autoMatchErr}</div>
              )}
              {(autoMatchResult || statementText) && (
                <button
                  onClick={() => { setAutoMatchResult(null); setStatementText(""); setAutoMatchErr(""); }}
                  className="ml-auto text-[11px] text-[#666] hover:text-[#AAA]"
                >
                  Цэвэрлэх
                </button>
              )}
            </div>

            {autoMatchResult && (
              <div className="space-y-2">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {[
                    { k: "parsedLines", label: "Олсон", color: "#888" },
                    { k: "matches", label: "Тохирсон", color: "#22C55E" },
                    { k: "approved", label: "Идэвхжсэн", color: "#22C55E" },
                    { k: "amountMismatches", label: "Дүн таарсангүй", color: "#FFC107" },
                    { k: "noMatches", label: "Тохироогүй", color: "#666" },
                    { k: "alreadyPaid", label: "Өмнө нь", color: "#3B82F6" },
                  ].map((x) => {
                    const value = (autoMatchResult.summary as unknown as Record<string, number>)[x.k];
                    return (
                      <div key={x.k} className="rounded-[6px] border border-[rgba(255,255,255,0.06)] bg-[#111] p-2 text-center">
                        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: x.color }}>{x.label}</div>
                        <div className="mt-0.5 text-[16px] font-black text-[#E8E8E8]">{value}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Per-line outcomes */}
                <div className="divide-y divide-[rgba(255,255,255,0.04)] rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#111]">
                  {autoMatchResult.outcomes.map((o, i) => {
                    const colorMap: Record<OutcomeStatus, string> = {
                      match: "#22C55E", approved: "#22C55E", "amount-mismatch": "#FFC107",
                      "no-match": "#666", "already-paid": "#3B82F6", failed: "#EF4444",
                    };
                    const labelMap: Record<OutcomeStatus, string> = {
                      match: "✓ Бэлэн", approved: "✓ Идэвхжсэн", "amount-mismatch": "⚠ Дүн",
                      "no-match": "— Код олдсонгүй", "already-paid": "✓ Өмнө нь", failed: "✕ Алдаа",
                    };
                    return (
                      <div key={i} className="flex items-center gap-3 p-2.5">
                        <div className="w-20 shrink-0 text-[9px] font-black uppercase tracking-tight" style={{ color: colorMap[o.status] }}>
                          {labelMap[o.status]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-black text-[#EF2C58]">{o.parsedRefCode}</span>
                            <span className="text-[11px] text-[#888]">₮{o.parsedAmount.toLocaleString()}</span>
                            {o.payment?.user && (
                              <span className="text-[11px] text-[#AAA]">→ {o.payment.user.name}</span>
                            )}
                            {o.status === "amount-mismatch" && o.payment && (
                              <span className="text-[10px] text-[#FFC107]">expected ₮{o.payment.expectedAmount.toLocaleString()}</span>
                            )}
                          </div>
                          <div className="truncate text-[10px] text-[#555]">{o.rawLine}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-1">
        {(["pending", "paid", "failed"] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`flex-1 rounded-[6px] px-4 py-2 text-[12px] font-bold transition ${
              status === s ? "bg-[#EF2C58] text-white" : "text-[#AAA] hover:text-[#E8E8E8]"
            }`}
          >
            {s === "pending" ? "Хүлээгдэж" : s === "paid" ? "Баталсан" : "Татгалзсан"}
            {s === "pending" && counts.pending > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black ${status === s ? "bg-white/25" : "bg-[rgba(239,44,88,0.2)] text-[#EF2C58]"}`}>
                {counts.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-[rgba(255,255,255,0.06)] bg-[#0D0D0D] py-16 text-center text-[13px] text-[#555]">
          {status === "pending" ? "Хүлээгдэж буй төлбөр алга" : "Байхгүй"}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((p) => {
            const hasReceipt = !!p.receiptImage;
            const claimed = !!p.claimedAt;
            return (
              <div key={p._id} className="overflow-hidden rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#141414]">
                <div className="flex">
                  {/* Receipt thumb — image-first scannability */}
                  <div className="w-[140px] shrink-0 bg-[#0A0A0A] sm:w-[180px]">
                    {hasReceipt ? (
                      <button
                        onClick={() => setLightbox(p.receiptImage)}
                        className="group relative block h-full w-full"
                        title="Томсгох"
                      >
                        <img src={p.receiptImage} alt="Receipt" className="h-full max-h-[200px] w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/40">
                          <svg className="h-6 w-6 text-white opacity-0 transition group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </button>
                    ) : (
                      <div className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-1 p-3 text-center">
                        <svg className="h-6 w-6 text-[#444]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                        <span className="text-[10px] text-[#555]">Баримтгүй</span>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
                    {/* Header row */}
                    <div>
                      <div className="flex items-center gap-2">
                        {p.user?.avatar ? (
                          <img src={p.user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(239,44,88,0.1)] text-[10px] font-black text-[#EF2C58]">
                            {p.user?.name?.charAt(0) || "?"}
                          </div>
                        )}
                        <span className="truncate text-[12px] font-bold text-[#E8E8E8]">{p.user?.name || "—"}</span>
                        {p.user?.level && (
                          <span className="rounded-full bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 text-[9px] font-bold text-[#888]">L{p.user.level}</span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-[#666]">{p.user?.email}</div>
                      {p.user?.instagram && (
                        <a href={`https://instagram.com/${p.user.instagram}`} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block text-[10px] text-[#EF2C58] hover:underline">
                          @{p.user.instagram}
                        </a>
                      )}
                      {p.user?.phone && (
                        <a href={`tel:${p.user.phone}`} className="ml-2 text-[10px] text-[#888]">{p.user.phone}</a>
                      )}
                    </div>

                    {/* Amount + Code */}
                    <div className="my-2 flex items-center justify-between gap-2 rounded-[6px] border border-[rgba(239,44,88,0.15)] bg-[rgba(239,44,88,0.05)] px-2.5 py-1.5">
                      <div>
                        <div className="text-[8px] uppercase tracking-wider text-[#666]">Код</div>
                        <div className="text-[13px] font-black tracking-[0.1em] text-[#EF2C58]">{p.referenceCode || "—"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[8px] uppercase tracking-wider text-[#666]">Дүн</div>
                        <div className="text-[12px] font-bold text-[#E8E8E8]">₮{p.amount.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="mb-2 space-y-0.5 text-[10px] text-[#666]">
                      <div className="flex items-center justify-between">
                        <span>Үүсгэсэн</span>
                        <span>{relative(p.createdAt)}</span>
                      </div>
                      {claimed && (
                        <div className="flex items-center justify-between">
                          <span>Шилжүүлсэн гэсэн</span>
                          <span className="font-bold text-[#22C55E]">{relative(p.claimedAt)}</span>
                        </div>
                      )}
                      {p.receiptUploadedAt && (
                        <div className="flex items-center justify-between">
                          <span>Баримт оруулсан</span>
                          <span className="font-bold text-[#22C55E]">{relative(p.receiptUploadedAt)}</span>
                        </div>
                      )}
                      {p.adminNote && (
                        <div className="mt-1 rounded-[4px] bg-[rgba(239,68,68,0.08)] px-2 py-1 text-[#EF4444]">{p.adminNote}</div>
                      )}
                    </div>

                    {/* Actions */}
                    {p.status === "pending" ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => approve(p)}
                          disabled={processingId === p._id}
                          className="flex-1 rounded-[6px] bg-[#22C55E] px-3 py-2 text-[11px] font-black text-white transition hover:bg-[#1CA04A] disabled:opacity-50"
                        >
                          {processingId === p._id ? "..." : "✓ Батлах · 30 хоног"}
                        </button>
                        <button
                          onClick={() => { setRejectingId(p._id); setRejectNote(""); }}
                          disabled={processingId === p._id}
                          className="rounded-[6px] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11px] font-black text-[#EF4444] transition hover:bg-[rgba(239,68,68,0.15)] disabled:opacity-50"
                        >
                          ✕
                        </button>
                      </div>
                    ) : p.status === "paid" ? (
                      <div className="flex items-center justify-between rounded-[6px] bg-[rgba(34,197,94,0.08)] px-3 py-2 text-[11px]">
                        <span className="font-black text-[#22C55E]">✓ Баталсан</span>
                        <span className="text-[10px] text-[#666]">{relative(p.paidAt)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-[6px] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11px]">
                        <span className="font-black text-[#EF4444]">✕ Татгалзсан</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
