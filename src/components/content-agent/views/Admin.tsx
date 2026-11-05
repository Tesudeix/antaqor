"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { api, when, type Ctx } from "../types";
import s from "../agent.module.css";

/* Хэрэглэгчид (зөвхөн эзэн) — бизнес багц (99,000₮), хуучин туршилтууд, Antaqor гишүүд:
   идэвх, холболт, хэрэглээ. Сунгах / идэвхжүүлэх / дуусгах, дэмжлэгт workspace-ийг нээх. */
type W = { wsId: string; name: string; ownerEmail: string; ownerName: string; plan: string; daysLeft: number; rawPlan: string; trialEndsAt: string | null; createdAt: string; lastActiveAt: string | null; about: string; adminNote: string; posts: number; published: number; gensTotal: number; meta: number; threads: number };
const PLAN: Record<string, string> = { active: "Бизнес", trial: "Туршилт", member: "Гишүүн", expired: "Дууссан", waitlist: "Хүлээлэг", none: "—" };

export default function Admin(ctx: Ctx) {
  const { say } = ctx;
  const [d, setD] = useState<{ seats: { used: number; left: number }; workspaces: W[] } | null>(null);
  const [f, setF] = useState("all");
  async function load() { try { setD(await api<{ seats: { used: number; left: number }; workspaces: W[] }>(undefined, "admin=1")); } catch (e) { say((e as Error).message, true); } }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function op(w: W, o: string) { try { await api({ action: "ws-admin", wsId: w.wsId, op: o }); say("Хадгаллаа"); await load(); } catch (e) { say((e as Error).message, true); } }
  if (!d) return <div className={s.page}><div className={s.skel} /></div>;
  const list = d.workspaces.filter((w) => f === "all" || w.plan === f);
  const active7 = d.workspaces.filter((w) => w.lastActiveAt && Date.now() - +new Date(w.lastActiveAt) < 7 * 864e5).length;
  const connected = d.workspaces.filter((w) => w.meta + w.threads > 0).length;
  const posting = d.workspaces.filter((w) => w.published > 0).length;
  return (
    <div className={s.page}>
      <div className={s.pageHead}><div><h1>Agent хэрэглэгчид</h1><p>Бизнес багц (99,000₮/сар), хуучин туршилтууд ба AI зураг ашигладаг гишүүд.</p></div></div>
      <div className={s.kpis}>
        <div className={s.kpi}><b>{d.workspaces.filter((w) => w.plan === "active").length}</b><span>Бизнес (төлсөн)</span></div>
        <div className={s.kpi}><b>{d.workspaces.filter((w) => w.plan === "trial").length}</b><span>Туршилт</span></div>
        <div className={s.kpi}><b>{d.workspaces.filter((w) => w.plan === "member").length}</b><span>Гишүүн</span></div>
        <div className={s.kpi}><b>{active7}</b><span>7 хоногт идэвхтэй</span></div>
        <div className={s.kpi}><b>{connected}</b><span>Хуудас холбосон</span></div>
        <div className={s.kpi}><b>{posting}</b><span>Пост нийтэлсэн</span></div>
      </div>
      <div className={s.rowx}>{["all", "active", "trial", "member", "expired"].map((k) => <button key={k} className={s.chip} aria-pressed={f === k} onClick={() => setF(k)}>{k === "all" ? "Бүгд" : PLAN[k]}</button>)}</div>
      <section className={s.card} style={{ overflowX: "auto" }}>
        <table className={s.tbl}>
          <thead><tr><th>Байгууллага</th><th>Төлөв</th><th>Холболт</th><th>Пост</th><th>Сүүлд</th><th /></tr></thead>
          <tbody>{list.map((w) => (
            <tr key={w.wsId}>
              <td className={s.txt} title={w.about}><b>{w.name}</b><br /><small className={s.muted}>{w.ownerName || w.ownerEmail}</small></td>
              <td><span className={s.pill} data-s={w.plan === "trial" || w.plan === "active" ? "scheduled" : "held"}>{PLAN[w.plan] || w.plan}{(w.plan === "trial" || w.plan === "active") && w.daysLeft ? ` · ${w.daysLeft} хоног` : ""}</span></td>
              <td>{w.meta ? `FB/IG ${w.meta}` : "—"}{w.threads ? ` · Threads ${w.threads}` : ""}</td>
              <td>{w.published}/{w.posts}<br /><small className={s.muted}>{w.gensTotal} бүтээлт</small></td>
              <td>{w.lastActiveAt ? `${when(w.lastActiveAt).day} ${when(w.lastActiveAt).time}` : "—"}</td>
              <td><div className={s.rowx} style={{ flexWrap: "nowrap" }}>
                <a className={s.ghost} href={`/content-agent?as=${w.wsId}`} title="Дэмжлэгийн горимоор нээх"><Icon name="eye" size={16} /></a>
                {w.plan === "trial" && <button className={s.btn} onClick={() => op(w, "extend")}>+7 хоног</button>}
                {w.plan !== "active" && <button className={s.ghost} onClick={() => op(w, "activate")} title="Төлбөргүйгээр 30 хоногийн бизнес багц нээнэ">Бизнес нээх</button>}
                {(w.plan === "active" || w.plan === "trial") && <button className={s.ghost} onClick={() => op(w, "expire")}>Дуусгах</button>}
              </div></td>
            </tr>
          ))}</tbody>
        </table>
        {!list.length && <div className={s.empty}><b>Одоогоор хэрэглэгч алга</b><span>Бизнес багц авсан эсвэл AI зураг ашигласан хүн энд гарна.</span></div>}
      </section>
    </div>
  );
}
