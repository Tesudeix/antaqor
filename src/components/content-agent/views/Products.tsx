"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { api, upload, type Audience, type Ctx, type Product } from "../types";
import s from "../agent.module.css";

/* Бүтээгдэхүүн (курс, үйлчилгээ) ба Audience — агент зөвхөн эндээс баримт авч санал болгоно,
   audience-ийн хэлээр бичнэ. */
const bp: Omit<Product, "_id"> = { name: "", pitch: "", price: "", link: "", cta: "", imageUrl: "", active: true };
const ba: Omit<Audience, "_id"> = { name: "", who: "", pains: "", desires: "", level: "", isDefault: false };
export default function Products(ctx: Ctx) {
  const { st, reload, say, go } = ctx;
  const [tab, setTab] = useState<"products" | "audiences">("products");
  const [ep, setEp] = useState<(Omit<Product, "_id"> & { _id?: string }) | null>(null);
  const [ea, setEa] = useState<(Omit<Audience, "_id"> & { _id?: string }) | null>(null);
  const [up, setUp] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  async function photo(f?: File | null) {
    if (!f || !ep) return;
    setUp(true);
    try { const r = await upload(f); if (r.kind !== "image") throw new Error("Зураг сонгоно уу"); setEp((x) => (x ? { ...x, imageUrl: r.url } : x)); } catch (e) { say((e as Error).message, true); } finally { setUp(false); }
  }
  async function save(kind: "product" | "audience", doc: { _id?: string } & Record<string, unknown>) {
    try { const { _id, ...d } = doc; await api({ action: kind, id: _id, doc: d }); say("Хадгаллаа"); setEp(null); setEa(null); await reload(); }
    catch (e) { say((e as Error).message, true); }
  }
  async function del(kind: "product" | "audience", id: string) { try { await api({ action: kind, op: "delete", id }); await reload(); } catch (e) { say((e as Error).message, true); } }
  return (
    <div className={s.page}>
      <div className={s.pageHead}><div><h1>Бүтээгдэхүүн</h1><p>Бүтээгдэхүүн, үйлчилгээ, зургаа нэг удаа оруул — агент зөвхөн энд бичсэн үнэн баримтаар, зурагтай нь пост хийнэ.</p></div>
        <div className={s.seg}><button aria-pressed={tab === "products"} onClick={() => setTab("products")}>Бүтээгдэхүүн</button><button aria-pressed={tab === "audiences"} onClick={() => setTab("audiences")}>Хэрэглэгчид</button></div></div>
      {tab === "products" ? (
        <>
          <div className={s.rowx}><button className={s.pri} onClick={() => setEp({ ...bp })}><Icon name="plus" size={16} />Бүтээгдэхүүн нэмэх</button></div>
          {ep && (
            <section className={s.card}><div className={s.stack}>
              <div className={s.prodPhoto}>
                <button className={s.drop} data-sm onClick={() => file.current?.click()} type="button">
                  {up ? <i className={s.spinB} /> : ep.imageUrl ? <img src={ep.imageUrl} alt="" /> : <><Icon name="image" size={24} /><b>Бүтээгдэхүүний зураг</b><span>Утасны зураг ч болно</span></>}
                </button>
                <input ref={file} type="file" accept="image/*" hidden onChange={(e) => photo(e.target.files?.[0])} />
                {ep.imageUrl && <button className={s.ghost} type="button" onClick={() => setEp({ ...ep, imageUrl: "" })}>Зургийг хасах</button>}
              </div>
              <div className={s.grid2}><label className={s.field}><span>Нэр</span><input value={ep.name} onChange={(e) => setEp({ ...ep, name: e.target.value })} /></label><label className={s.field}><span>Үнэ</span><input value={ep.price} onChange={(e) => setEp({ ...ep, price: e.target.value })} placeholder="99,000₮ / сар" /></label></div>
              <label className={s.field}><span>Юу вэ — зөвхөн үнэн баримт</span><textarea rows={3} value={ep.pitch} onChange={(e) => setEp({ ...ep, pitch: e.target.value })} /></label>
              <div className={s.grid2}><label className={s.field}><span>Холбоос (заавал биш)</span><input value={ep.link} onChange={(e) => setEp({ ...ep, link: e.target.value })} placeholder="Вэб, мессенжер холбоос" /></label><label className={s.field}><span>Уриалга (заавал биш)</span><input value={ep.cta} onChange={(e) => setEp({ ...ep, cta: e.target.value })} placeholder="Ж: Захиалах бол мессеж бичээрэй" /></label></div>
              <div className={s.rowx}><label className={s.rowx}><span className={s.switch}><input type="checkbox" checked={ep.active} onChange={(e) => setEp({ ...ep, active: e.target.checked })} /><i /></span> Идэвхтэй</label><span style={{ flex: 1 }} /><button className={s.ghost} onClick={() => setEp(null)}>Болих</button><button className={s.pri} disabled={!ep.name.trim()} onClick={() => save("product", ep)}>Хадгалах</button></div>
            </div></section>
          )}
          <div className={s.grid2}>{st.products.map((p) => (
            <section key={p._id} className={s.card}>
              {p.imageUrl && <img className={s.prodImg} src={p.imageUrl} alt="" loading="lazy" />}
              <div className={s.cardHead}><h3>{p.name}</h3>{!p.active && <span className={s.pill}>Идэвхгүй</span>}</div>
              <p className={s.pcText}>{p.pitch}</p>
              <div className={s.pcNotes}>{p.price && <b>{p.price}</b>}{p.link && <span>{p.link}</span>}</div>
              {p.cta && <p className={s.muted}>CTA: {p.cta}</p>}
              <div className={s.pcActs} style={{ marginTop: 10 }}><button className={s.pri} onClick={() => go("home", { product: p._id })}><Icon name="spark" size={16} />Пост бүтээх</button><button className={s.btn} onClick={() => go("studio", { product: p._id })}><Icon name="image" size={16} />Студи ✨</button><button className={s.btn} onClick={() => setEp({ ...p })}><Icon name="edit" size={16} />Засах</button><button className={s.ghost} onClick={() => del("product", p._id)}><Icon name="trash" size={16} /></button></div>
            </section>
          ))}</div>
          {!st.products.length && !ep && <div className={s.empty}><b>Бүтээгдэхүүн алга</b><span>Курс, үйлчилгээгээ нэм — агент «Санал» постуудад ашиглана.</span></div>}
        </>
      ) : (
        <>
          <div className={s.rowx}><button className={s.pri} onClick={() => setEa({ ...ba })}><Icon name="plus" size={16} />Audience нэмэх</button></div>
          {ea && (
            <section className={s.card}><div className={s.stack}>
              <div className={s.grid2}><label className={s.field}><span>Нэр</span><input value={ea.name} onChange={(e) => setEa({ ...ea, name: e.target.value })} placeholder="Эхлэгч AI creator" /></label><label className={s.field}><span>Түвшин</span><input value={ea.level} onChange={(e) => setEa({ ...ea, level: e.target.value })} placeholder="ChatGPT-г хааяа ашигладаг" /></label></div>
              <label className={s.field}><span>Хэн бэ</span><input value={ea.who} onChange={(e) => setEa({ ...ea, who: e.target.value })} placeholder="20–30 насны, контент хийж эхэлсэн залуус" /></label>
              <div className={s.grid2}><label className={s.field}><span>Өвдөлт</span><textarea rows={2} value={ea.pains} onChange={(e) => setEa({ ...ea, pains: e.target.value })} /></label><label className={s.field}><span>Хүсэл</span><textarea rows={2} value={ea.desires} onChange={(e) => setEa({ ...ea, desires: e.target.value })} /></label></div>
              <div className={s.rowx}><label className={s.rowx}><span className={s.switch}><input type="checkbox" checked={ea.isDefault} onChange={(e) => setEa({ ...ea, isDefault: e.target.checked })} /><i /></span> Үндсэн audience</label><span style={{ flex: 1 }} /><button className={s.ghost} onClick={() => setEa(null)}>Болих</button><button className={s.pri} disabled={!ea.name.trim()} onClick={() => save("audience", ea)}>Хадгалах</button></div>
            </div></section>
          )}
          <div className={s.grid3}>{st.audiences.map((a) => (
            <section key={a._id} className={s.card}>
              <div className={s.cardHead}><h3>{a.name}</h3>{a.isDefault && <span className={s.pill} data-s="scheduled">Үндсэн</span>}</div>
              <p className={s.muted}>{a.who}</p>
              {a.pains && <p className={s.pcText} style={{ fontSize: 13 }}><b>Өвдөлт:</b> {a.pains}</p>}
              {a.desires && <p className={s.pcText} style={{ fontSize: 13 }}><b>Хүсэл:</b> {a.desires}</p>}
              <div className={s.pcActs} style={{ marginTop: 10 }}><button className={s.btn} onClick={() => setEa({ ...a })}><Icon name="edit" size={16} />Засах</button><button className={s.ghost} onClick={() => del("audience", a._id)}><Icon name="trash" size={16} /></button></div>
            </section>
          ))}</div>
          {!st.audiences.length && !ea && <div className={s.empty}><b>Audience алга</b><span>Хэнд зориулж бичихээ тодорхойл — агент тэр хүний хэлээр, өвдөлтөөр нь бичнэ.</span></div>}
        </>
      )}
    </div>
  );
}
