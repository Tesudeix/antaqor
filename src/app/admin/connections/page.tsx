"use client";

import { useCallback, useEffect, useState } from "react";

/* ─── Сошиал холболт (2026-10-18) ────────────────────────────────────────
   Нэг газраас: холбогдсон FB хуудас + IG + Threads-ийн төлөв, шинэ хуудас
   2 алхмаар холбох (Facebook-ээр нэвтрэх → жагсаалтаас сонгох), идэвхгүй
   болгох/салгах. Шинэ хуудас анхдагчаар ЗӨВХӨН НИЙТЛЭХ — DM автомат хариулт
   нь тусдаа сонголт (өөр брэндийн үйлчлүүлэгч Antaqor-ийн бот руу орохгүй). */

type Health = { ok: boolean; label: string; error: string };
type Target = { key: string; label: string; facebook: Health; instagram: Health };
type Thread = { threadsUserId: string; username: string; ok: boolean; error: string };
type Row = { key: string; pageId: string; name: string; igBusinessId?: string; enabled: boolean; pageType?: string };
type Pick = { id: string; name: string; igId: string; igUsername: string; connected: boolean };

const card = "rounded-[4px] border border-white/[0.07] bg-white/[0.025]";
const Dot = ({ ok }: { ok: boolean }) => <i className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: ok ? "#4ADE80" : "#F87171" }} />;

export default function Connections() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [acc, setAcc] = useState<{ targets: Target[]; threads: Thread[] } | null>(null);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [dm, setDm] = useState<Record<string, boolean>>({});
  const [ext, setExt] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [p, a, c] = await Promise.all([
      fetch("/api/admin/meta/pages", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/admin/social/accounts?fresh=1", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/admin/social/meta-connect", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ]);
    setRows(p.pages || p.registered || p.rows || []);
    setAcc(a);
    setPicks(c.pages || []);
    setNeedsAuth(!!c.needsAuth);
  }, []);
  useEffect(() => {
    const m = new URLSearchParams(location.search).get("meta");
    if (m) { setMsg(m); history.replaceState(null, "", "/admin/connections"); }
    void load();
  }, [load]);

  const connect = async (p: Pick) => {
    setBusy(p.id); setMsg("");
    const r = await fetch("/api/admin/social/meta-connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId: p.id, dm: !!dm[p.id] }) }).then((x) => x.json()).catch(() => ({ error: "Сүлжээний алдаа" }));
    setBusy("");
    setMsg(r.ok ? `✓ ${r.page.name}${r.page.igUsername ? ` + @${r.page.igUsername}` : ""} холбогдлоо${dm[p.id] ? " (DM автомат идэвхтэй)" : " — зөвхөн нийтлэх"}` : r.error || "Холбож чадсангүй");
    await load();
  };
  const toggle = async (r: Row) => {
    setBusy(r.key);
    await fetch("/api/admin/meta/pages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: r.key, enabled: !r.enabled }) });
    setBusy(""); await load();
  };
  const remove = async (r: Row) => {
    if (r.key === "antaqor") { setMsg("Үндсэн Antaqor хуудсыг эндээс салгахгүй — DM автомат, хяналт бүгд үүн дээр тулгуурладаг."); return; }
    if (!confirm(`"${r.name}"-г салгах уу? Энэ хуудас руу нийтлэх, DM автомат хариулт зогсоно.`)) return;
    setBusy(r.key);
    await fetch(`/api/admin/meta/pages?key=${encodeURIComponent(r.key)}`, { method: "DELETE" });
    setBusy(""); await load();
  };

  const health = (key: string) => acc?.targets.find((t) => t.key === key);
  const fresh = (picks || []).filter((p) => !p.connected);

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-10 text-white">
      <div className="mb-5">
        <h1 className="text-[26px] font-bold tracking-[-0.01em]">Сошиал холболт</h1>
        <p className="mt-1 text-[13px] text-white/55">Facebook хуудас, Instagram, Threads — нийтлэх, хянах, DM автомат хариулт эндээс.</p>
      </div>
      {msg && <div className="mb-4 flex justify-between gap-3 rounded-[4px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[13px]">{msg}<button onClick={() => setMsg("")} className="text-white/50">×</button></div>}

      {/* Холбогдсон */}
      <section className={`${card} mb-4 p-5`}>
        <h2 className="mb-3 text-[15px] font-semibold">Холбогдсон аккаунтууд</h2>
        <div className="space-y-2">
          {(rows || []).map((r) => {
            const h = health(r.key);
            return (
              <div key={r.key} className={`flex flex-wrap items-center gap-3 rounded-[4px] border border-white/[0.07] p-3 ${r.enabled ? "" : "opacity-55"}`}>
                <div className="min-w-[220px] flex-1">
                  <div className="flex items-center gap-2 text-[14px] font-semibold">{r.name}{r.key === "antaqor" && <span className="rounded-[4px] bg-[rgba(46,41,255,0.15)] px-1.5 text-[10.5px] font-bold text-[#F87171]">ҮНДСЭН</span>}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-white/60">
                    <span className="flex items-center gap-1.5"><Dot ok={!!h?.facebook.ok} />Facebook {h?.facebook.ok ? "" : `· ${h?.facebook.error || "шалгаж байна"}`}</span>
                    <span className="flex items-center gap-1.5"><Dot ok={!!h?.instagram.ok} />{r.igBusinessId ? `Instagram ${h?.instagram.label && h.instagram.label !== "Instagram" ? h.instagram.label : ""}` : "Instagram холбогдоогүй"} {r.igBusinessId && !h?.instagram.ok ? `· ${h?.instagram.error || ""}` : ""}</span>
                  </div>
                </div>
                <button onClick={() => toggle(r)} disabled={busy === r.key} className="rounded-[4px] border border-white/10 px-3 py-1.5 text-[12.5px] font-semibold hover:border-white/25 disabled:opacity-50">{r.enabled ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}</button>
                {r.key !== "antaqor" && <button onClick={() => remove(r)} disabled={busy === r.key} className="rounded-[4px] px-3 py-1.5 text-[12.5px] font-semibold text-white/50 hover:text-[#F87171]">Салгах</button>}
              </div>
            );
          })}
          {(acc?.threads || []).map((t) => (
            <div key={t.threadsUserId} className="flex flex-wrap items-center gap-3 rounded-[4px] border border-white/[0.07] p-3">
              <div className="flex-1"><div className="text-[14px] font-semibold">Threads · @{t.username}</div><div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-white/60"><Dot ok={t.ok} />{t.ok ? "Холбогдсон" : t.error}</div></div>
              <a href="/api/admin/threads/auth?extended=1" className="rounded-[4px] border border-white/10 px-3 py-1.5 text-[12.5px] font-semibold hover:border-white/25">Дахин холбох / сунгах</a>
            </div>
          ))}
          {rows && !rows.length && <p className="text-[13px] text-white/50">Одоогоор холбогдсон хуудас алга.</p>}
        </div>
      </section>

      {/* Шинэ хуудас холбох */}
      <section className={`${card} p-5`}>
        <h2 className="text-[15px] font-semibold">Өөр хуудас / Instagram холбох</h2>
        <p className="mt-1 text-[12.5px] text-white/55">Instagram нь <b className="text-white/80">Business эсвэл Creator</b> аккаунт бөгөөд Facebook хуудастай холбогдсон байх ёстой (Instagram → Тохиргоо → Account type; Facebook хуудас → Тохиргоо → Linked accounts).</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[4px] border border-white/[0.07] p-4">
            <div className="text-[12px] font-bold text-white/50">АЛХАМ 1</div>
            <div className="mt-1 text-[14px] font-semibold">Facebook-ээр нэвтрэх</div>
            <p className="mt-1 text-[12.5px] text-white/55">Цонх нээгдэхэд холбох хуудсуудаа чагтлаад зөвшөөрнө. Таны нууц үг манайд хадгалагдахгүй.</p>
            <label className="mt-3 flex items-start gap-2 text-[12.5px] text-white/70"><input type="checkbox" checked={ext} onChange={(e) => setExt(e.target.checked)} className="mt-0.5 accent-[#2E29FF]" />Reach/хадгалалт ба өрсөлдөгчийн Instagram унших эрхийг ч хамт хүсэх</label>
            <a href={`/api/admin/meta/oauth/start${ext ? "?extended=1" : ""}`} className="mt-3 inline-flex items-center gap-2 rounded-[4px] bg-[#FAFAFA] px-4 py-2.5 text-[13px] font-semibold text-black hover:bg-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" /></svg>
              {needsAuth ? "Facebook-ээр нэвтрэх" : "Дахин нэвтрэх (шинэ хуудас нэмсэн бол)"}
            </a>
          </div>

          <div className="rounded-[4px] border border-white/[0.07] p-4">
            <div className="text-[12px] font-bold text-white/50">АЛХАМ 2</div>
            <div className="mt-1 text-[14px] font-semibold">Хуудсаа сонгох</div>
            {needsAuth ? <p className="mt-2 text-[12.5px] text-white/55">Эхлээд 1-р алхмыг хийнэ үү — дараа нь таны удирддаг бүх хуудас энд гарна.</p>
              : !fresh.length ? <p className="mt-2 text-[12.5px] text-white/55">{picks?.length ? "Таны бүх хуудас аль хэдийн холбогдсон байна." : "Хуудас олдсонгүй — Facebook цонхонд хуудсаа чагтласан эсэхээ шалгаад дахин нэвтэрнэ үү."}</p>
              : (
              <div className="mt-2 space-y-2">
                {fresh.map((p) => (
                  <div key={p.id} className="rounded-[4px] bg-white/[0.03] p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-semibold">{p.name}</div><div className="text-[12px] text-white/50">{p.igUsername ? `+ Instagram @${p.igUsername}` : "Instagram холбогдоогүй"}</div></div>
                      <button onClick={() => connect(p)} disabled={!!busy} className="rounded-[4px] bg-[#2E29FF] px-3 py-1.5 text-[12.5px] font-semibold hover:bg-[#1F1AD9] disabled:opacity-50">{busy === p.id ? "…" : "Холбох"}</button>
                    </div>
                    <label className="mt-2 flex items-start gap-2 text-[12px] text-white/60"><input type="checkbox" checked={!!dm[p.id]} onChange={(e) => setDm({ ...dm, [p.id]: e.target.checked })} className="mt-0.5 accent-[#2E29FF]" />DM/коммент автомат хариулт идэвхжүүлэх <span className="text-white/40">(анхдагч: зөвхөн нийтлэх)</span></label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
