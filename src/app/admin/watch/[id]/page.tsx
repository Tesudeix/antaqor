"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { T, MONO, Card, Btn, SectionHeader, Empty, Skeleton } from "@/components/admin/kit";

/* ─── Нэг цуврал + түүний ангиуд ───────────────────────────────────────────
   Ангийн жагсаалт нь ЭНД амьдардаг: 60 анги бол цувралын гол агуулга,
   тусад нь хуудас болговол редактор хоёр цонх нээж сууна.

   Видеог `/api/upload` рүү өгнө — тэр маршрут аль хэдийн хэмжээний хязгаар,
   дискний шалгалт, хөрвүүлэлтийг хийдэг тул давхардуулж бичсэнгүй. */

interface SeriesDoc {
  _id: string; title: string; slug: string; synopsis: string; genres: string[];
  year: number; poster: string; still: string; freeEpisodes: number;
  passPriceCoins: number; published: boolean; featuredRank: number; episodeCount: number;
}
interface EpisodeDoc {
  _id: string; number: number; title: string; videoUrl: string;
  videoType: "link" | "upload"; durationSec: number; priceCoins: number; published: boolean;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export default function AdminSeriesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [s, setS] = useState<SeriesDoc | null>(null);
  const [eps, setEps] = useState<EpisodeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/watch/series/${id}`);
      const d = await r.json();
      if (d?.series) { setS(d.series); setEps(d.episodes || []); }
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const patch = (k: keyof SeriesDoc, v: unknown) => setS((p) => (p ? { ...p, [k]: v } as SeriesDoc : p));

  const save = async () => {
    if (!s || saving) return;
    setSaving(true); setMsg("");
    try {
      const r = await fetch(`/api/admin/watch/series/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      setMsg(r.ok ? "Хадгаллаа." : "Хадгалж чадсангүй.");
    } catch { setMsg("Сүлжээний алдаа."); }
    finally { setSaving(false); setTimeout(() => setMsg(""), 2500); }
  };

  const addEpisode = async () => {
    const r = await fetch(`/api/admin/watch/series/${id}/episodes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    });
    if (r.ok) load();
  };

  const patchEpisode = async (epId: string, body: Partial<EpisodeDoc>) => {
    const r = await fetch(`/api/admin/watch/episodes/${epId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) { setMsg(d?.error === "number_taken" ? `${d.number}-р анги аль хэдийн байна.` : "Засаж чадсангүй."); setTimeout(() => setMsg(""), 3000); return; }
    setEps((p) => p.map((e) => (e._id === epId ? { ...e, ...body } : e)));
  };

  const delEpisode = async (ep: EpisodeDoc) => {
    if (!confirm(`${ep.number}-р анги устгах уу?`)) return;
    const r = await fetch(`/api/admin/watch/episodes/${ep._id}`, { method: "DELETE" });
    if (r.ok) load();
  };

  /* Видео байршуулалт — ангийн мөр бүр дээр. Ямар ангид хамаарахыг
     `pendingEp`-ээр санана, учир нь input нэг л ширхэг. */
  const [pendingEp, setPendingEp] = useState<string>("");
  const pickVideo = (epId: string) => { setPendingEp(epId); fileRef.current?.click(); };
  const onFile = async (f: File | undefined) => {
    if (!f || !pendingEp) return;
    setUploading(true); setMsg("");
    try {
      const fd = new FormData(); fd.append("file", f);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const ud = await up.json();
      if (!up.ok || !ud?.url) { setMsg(ud?.error || "Байршуулж чадсангүй."); return; }
      await patchEpisode(pendingEp, { videoUrl: ud.url, videoType: "upload" });
      setMsg("Видео орлоо.");
    } catch { setMsg("Сүлжээний алдаа."); }
    finally { setUploading(false); setPendingEp(""); if (fileRef.current) fileRef.current.value = ""; setTimeout(() => setMsg(""), 2500); }
  };

  const delSeries = async () => {
    if (!confirm("Энэ цувралыг БҮХ ангийн хамт устгах уу? Буцаах боломжгүй.")) return;
    const r = await fetch(`/api/admin/watch/series/${id}`, { method: "DELETE" });
    if (r.ok) router.push("/admin/watch");
  };

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-6"><Skeleton /></div>;
  if (!s) return <div className="mx-auto max-w-4xl px-4 py-6"><Empty title="Цуврал олдсонгүй" /></div>;

  const field = "h-10 w-full rounded-[4px] border px-3 text-[13px] outline-none";
  const fst = { borderColor: T.border, background: T.surface, color: T.text };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <Link href="/admin/watch" className="mb-3 inline-block text-[12px]" style={{ color: T.faint }}>← Цувралууд</Link>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: T.text }}>{s.title}</h1>
          <div className="mt-1 text-[11.5px]" style={{ color: T.faint, fontFamily: MONO }}>/{s.slug} · {eps.length} анги</div>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-[12px]" style={{ color: T.primaryInk }}>{msg}</span>}
          <Btn onClick={save} loading={saving}>Хадгалах</Btn>
        </div>
      </div>

      {/* ─── Цувралын мэдээлэл ─── */}
      <Card className="mb-6 p-4">
        <SectionHeader title="Цувралын мэдээлэл" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-[11px]" style={{ color: T.faint }}>Нэр</span>
            <input className={field} style={fst} value={s.title} onChange={(e) => patch("title", e.target.value)} />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-[11px]" style={{ color: T.faint }}>Товч агуулга</span>
            <textarea rows={3} className="w-full rounded-[4px] border px-3 py-2 text-[13px] outline-none" style={fst}
              value={s.synopsis} onChange={(e) => patch("synopsis", e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-[11px]" style={{ color: T.faint }}>Төрөл (таслалаар)</span>
            <input className={field} style={fst} value={(s.genres || []).join(", ")}
              onChange={(e) => patch("genres", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />
          </label>
          <label>
            <span className="mb-1 block text-[11px]" style={{ color: T.faint }}>Он</span>
            <input type="number" className={field} style={fst} value={s.year} onChange={(e) => patch("year", Number(e.target.value))} />
          </label>
          <label>
            <span className="mb-1 block text-[11px]" style={{ color: T.faint }}>Постер (зургийн URL)</span>
            <input className={field} style={fst} value={s.poster} onChange={(e) => patch("poster", e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-[11px]" style={{ color: T.faint }}>Кадр (хэвтээ)</span>
            <input className={field} style={fst} value={s.still} onChange={(e) => patch("still", e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-[11px]" style={{ color: T.faint }}>Үнэгүй анги (энэ тооноос доош)</span>
            <input type="number" className={field} style={fst} value={s.freeEpisodes} onChange={(e) => patch("freeEpisodes", Number(e.target.value))} />
          </label>
          <label>
            <span className="mb-1 block text-[11px]" style={{ color: T.faint }}>7 хоногийн эрхийн үнэ (зоос)</span>
            <input type="number" className={field} style={fst} value={s.passPriceCoins} onChange={(e) => patch("passPriceCoins", Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2 pt-5">
            <input type="checkbox" checked={s.published} onChange={(e) => patch("published", e.target.checked)} />
            <span className="text-[13px]" style={{ color: T.text }}>Нийтлэх</span>
          </label>
          <label>
            <span className="mb-1 block text-[11px]" style={{ color: T.faint }}>Онцлох эрэмбэ (0 = үгүй)</span>
            <input type="number" className={field} style={fst} value={s.featuredRank} onChange={(e) => patch("featuredRank", Number(e.target.value))} />
          </label>
        </div>
      </Card>

      {/* ─── Ангиуд ─── */}
      <SectionHeader
        title={`Ангиуд (${eps.length})`}
        hint={`${s.freeEpisodes}-аас дээш анги түгжээтэй`}
        action={<Btn size="sm" onClick={addEpisode}>+ Анги нэмэх</Btn>}
      />
      <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])} />

      {eps.length === 0 ? (
        <Empty title="Анги алга" hint="Дээрээс эхний ангиа нэмнэ үү." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {eps.map((ep) => {
            const locked = ep.number > s.freeEpisodes;
            return (
              <Card key={ep._id} className="flex flex-wrap items-center gap-2 p-2.5">
                <input type="number" value={ep.number}
                  onChange={(e) => setEps((p) => p.map((x) => x._id === ep._id ? { ...x, number: Number(e.target.value) } : x))}
                  onBlur={(e) => patchEpisode(ep._id, { number: Number(e.target.value) })}
                  className="h-8 w-14 shrink-0 rounded-[3px] border px-2 text-center text-[12px] font-bold outline-none"
                  style={fst} />
                <input value={ep.title} placeholder="Ангийн нэр"
                  onChange={(e) => setEps((p) => p.map((x) => x._id === ep._id ? { ...x, title: e.target.value } : x))}
                  onBlur={(e) => patchEpisode(ep._id, { title: e.target.value })}
                  className="h-8 min-w-[140px] flex-1 rounded-[3px] border px-2 text-[12.5px] outline-none" style={fst} />
                <span className="shrink-0 text-[11px]" style={{ color: T.faint, fontFamily: MONO }}>
                  {ep.durationSec ? mmss(ep.durationSec) : "—:—"}
                </span>
                {locked && (
                  <input type="number" value={ep.priceCoins} title="Нээх үнэ (зоос)"
                    onChange={(e) => setEps((p) => p.map((x) => x._id === ep._id ? { ...x, priceCoins: Number(e.target.value) } : x))}
                    onBlur={(e) => patchEpisode(ep._id, { priceCoins: Number(e.target.value) })}
                    className="h-8 w-16 shrink-0 rounded-[3px] border px-2 text-center text-[12px] outline-none" style={fst} />
                )}
                <span className="shrink-0 rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold"
                  style={locked ? { background: "rgba(46,41,255,0.15)", color: T.primaryInk } : { background: "rgba(128,128,128,0.18)", color: T.faint }}>
                  {locked ? "ТҮГЖЭЭТЭЙ" : "ҮНЭГҮЙ"}
                </span>
                <Btn size="sm" variant={ep.videoUrl ? "ghost" : "primary"} onClick={() => pickVideo(ep._id)}
                  disabled={uploading}>
                  {ep.videoUrl ? "Видео солих" : "Видео"}
                </Btn>
                <button onClick={() => delEpisode(ep)} className="shrink-0 px-1.5 text-[13px]" style={{ color: T.faint }} title="Устгах">✕</button>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-10 border-t pt-4" style={{ borderColor: T.border }}>
        <Btn variant="ghost" size="sm" onClick={delSeries}>Цувралыг устгах</Btn>
      </div>
    </div>
  );
}
