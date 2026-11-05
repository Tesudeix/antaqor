"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { T, MONO, Card, Btn, SectionHeader, Empty, Skeleton } from "@/components/admin/kit";

/* ─── /admin/watch — богино драмын цувралууд ───────────────────────────────
   Ангиудыг ЭНД засахгүй: 60 ангитай цувралыг жагсаалтын мөрөнд багтаах
   гэвэл аль нь ч уншигдахгүй болно. Энэ дэлгэц зөвхөн "ямар цуврал байна,
   аль нь нийтлэгдсэн, хэдэн ангитай" гэдгийг хэлнэ; ангийн ажил цувралын
   дотор явагдана. */

interface SeriesRow {
  _id: string;
  title: string;
  slug: string;
  genres: string[];
  year: number;
  episodeCount: number;
  freeEpisodes: number;
  published: boolean;
  featuredRank: number;
  poster: string;
}

export default function AdminWatchPage() {
  const [rows, setRows] = useState<SeriesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/watch/series");
      const d = await r.json();
      if (Array.isArray(d?.series)) setRows(d.series);
    } catch { /* дараагийн ачаалалт дээр засагдана */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/watch/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d?.error === "title_required" ? "Нэр оруулна уу." : "Үүсгэж чадсангүй."); return; }
      setTitle("");
      load();
    } catch { setErr("Сүлжээний алдаа."); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-1 text-[11px] font-bold tracking-[0.18em]" style={{ color: T.primaryInk, fontFamily: MONO }}>
        ANTAQOR / WATCH
      </div>
      <h1 className="mb-6 text-[26px] font-bold" style={{ color: T.text }}>Цувралууд</h1>

      {/* ─── Шинэ цуврал ─── */}
      <Card className="mb-6 p-4">
        <SectionHeader title="Шинэ цуврал" hint="Нэр өгөөд үүсгэнэ — бусдыг нь дотор нь засна." />
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") create(); }}
            placeholder="Жишээ: НАДАД ИТГЭЭЧ"
            className="h-10 flex-1 rounded-[4px] border px-3 text-[13px] outline-none"
            style={{ borderColor: T.border, background: T.surface, color: T.text }}
          />
          <Btn onClick={create} disabled={busy || !title.trim()} loading={busy}>Үүсгэх</Btn>
        </div>
        {err && <div className="mt-2 text-[12px]" style={{ color: T.primaryInk }}>{err}</div>}
      </Card>

      {/* ─── Жагсаалт ─── */}
      <SectionHeader title={`Бүх цуврал (${rows.length})`} />
      {loading ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <Empty title="Цуврал алга" hint="Дээрээс эхний цувралаа үүсгэнэ үү." />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((s) => (
            <Link key={s._id} href={`/admin/watch/${s._id}`}>
              <Card hover className="flex items-center gap-4 p-3">
                <div
                  className="h-16 w-11 shrink-0 rounded-[3px] bg-cover bg-center"
                  style={{ background: s.poster ? `url(${s.poster}) center/cover` : "rgba(128,128,128,0.15)" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-bold" style={{ color: T.text }}>{s.title}</span>
                    <span
                      className="shrink-0 rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold"
                      style={s.published
                        ? { background: "rgba(46,41,255,0.15)", color: T.primaryInk }
                        : { background: "rgba(128,128,128,0.18)", color: T.faint }}
                    >
                      {s.published ? "НИЙТЛЭГДСЭН" : "НООРОГ"}
                    </span>
                  </div>
                  <div className="mt-1 text-[11.5px]" style={{ color: T.faint, fontFamily: MONO }}>
                    {s.episodeCount} анги · {s.freeEpisodes} үнэгүй · {s.year}
                    {s.genres?.length ? ` · ${s.genres.join(", ")}` : ""}
                  </div>
                </div>
                <span className="shrink-0 text-[12px]" style={{ color: T.faint }}>›</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
