"use client";

import { useCallback, useEffect, useState } from "react";

/* RAG шалгагч — "AI энэ асуултад аль хэсгийг татаж авах вэ?" гэдгийг
   чатлахаас өмнө харуулна. Ижил төстэй байдал %, аль аргаар олдсон
   (утгаар / түлхүүр үгээр), хугацаа. Мөн векторжуулалтын төлөв. */

type Hit = { id: string; source: string; text: string; sim: number | null; viaText: boolean };
type Res = { stats: { total: number; embedded: number; model: string }; ms?: number; mode?: string; knowledge?: Hit[]; voice?: Hit[] };

export default function RagTester({ refreshKey = 0 }: { refreshKey?: number }) {
  const [q, setQ] = useState("");
  const [r, setR] = useState<Res | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const stats = useCallback(async () => {
    const d = await fetch("/api/admin/companion-docs/rag").then((x) => x.json()).catch(() => null);
    if (d?.stats) setR((p) => ({ ...(p || {}), stats: d.stats }));
  }, []);
  useEffect(() => { void stats(); }, [stats, refreshKey]);

  const search = async () => {
    if (!q.trim()) return; setBusy("q"); setErr("");
    const d = await fetch(`/api/admin/companion-docs/rag?q=${encodeURIComponent(q)}`).then((x) => x.json()).catch(() => null);
    setBusy(""); if (d?.stats) setR(d); else setErr("Хайлт амжилтгүй");
  };
  const embed = async () => {
    setBusy("e"); setErr("");
    const d = await fetch("/api/admin/companion-docs/rag", { method: "POST" }).then((x) => x.json()).catch(() => null);
    setBusy(""); if (d?.stats) setR((p) => ({ ...(p || {}), stats: d.stats })); else setErr(d?.error || "Векторжуулах амжилтгүй");
  };

  const s = r?.stats;
  const pending = s ? s.total - s.embedded : 0;
  const Hits = ({ list, label }: { list?: Hit[]; label: string }) => !list ? null : (
    <div className="mt-3">
      <div className="mb-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#9C9CA6]">{label} · {list.length}</div>
      {!list.length && <p className="text-[13px] text-[#9C9CA6]">Хамааралтай хэсэг олдсонгүй — AI энэ сэдвээр зохиохгүй, &quot;мэдэхгүй&quot; гэнэ.</p>}
      <div className="space-y-1.5">{list.map((h, i) => (
        <div key={h.id} className="rounded-[4px] bg-[#0A0A0A] p-2.5">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <b className="text-[#FCEE0A]">[{i + 1}]</b><span className="font-bold text-[#F2F2F4]">{h.source}</span>
            {h.sim !== null && <span className="rounded-[3px] bg-[#1E1E1E] px-1.5 py-0.5 tabular-nums text-[#F2F2F4]">утга {Math.round(h.sim * 100)}%</span>}
            {h.viaText && <span className="rounded-[3px] bg-[#1E1E1E] px-1.5 py-0.5 text-[#F2F2F4]">түлхүүр үг</span>}
          </div>
          <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-[#C9C9D1]">{h.text}</p>
        </div>
      ))}</div>
    </div>
  );

  return (
    <div className="mt-4 rounded-[4px] border border-white/10 bg-[#101010] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-extrabold text-[#F2F2F4]">🔎 Хайлтыг шалгах (RAG)</div>
        {s && <div className="flex items-center gap-2 text-[12px]">
          <span className="rounded-[4px] bg-[#1E1E1E] px-2 py-1 tabular-nums text-[#F2F2F4]">Вектор {s.embedded}/{s.total}</span>
          {pending > 0 && <button onClick={embed} disabled={!!busy} className="rounded-[4px] bg-[#FCEE0A] px-2.5 py-1 font-bold text-[#0A0A0A] disabled:opacity-50">{busy === "e" ? "Векторжуулж байна…" : `${pending}-г векторжуулах`}</button>}
        </div>}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void search()} placeholder="Хүмүүсийн асуух асуулт — жишээ: үнэ хэд вэ, яаж эхлэх вэ"
          className="h-10 flex-1 rounded-[4px] bg-[#0A0A0A] px-3 text-[14px] text-[#F2F2F4] outline-none placeholder:text-[#9C9CA6] focus:ring-1 focus:ring-[#FCEE0A]" />
        <button onClick={search} disabled={!!busy || !q.trim()} className="h-10 rounded-[4px] bg-[#2E29FF] px-4 text-[14px] font-extrabold text-white disabled:opacity-40">{busy === "q" ? "…" : "Хайх"}</button>
      </div>
      {err && <p className="mt-2 text-[13px] text-[#FCA5A5]">{err}</p>}
      {r?.ms !== undefined && <p className="mt-2 text-[12px] text-[#9C9CA6]">{r.mode === "hybrid" ? "Утга + түлхүүр үг (hybrid)" : "Зөвхөн түлхүүр үг (embedding ажиллахгүй байна)"} · {r.ms}мс</p>}
      <Hits list={r?.knowledge} label="Мэдлэг — AI-д өгөгдөх" />
      <Hits list={r?.voice} label="Хэв маягийн жишээ" />
    </div>
  );
}
