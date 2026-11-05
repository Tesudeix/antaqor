"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/* ─── /admin/restaurants — Scout агентын өгөгдлийн эх ─────────────────────
   Энэ хуудас бол агентын ТАРХИ биш, ХООЛ нь. Загвар солигдож болно; энд
   байгаа шалгасан үнэ, цэс, цагийн хуваарь бол хуулж авах боломжгүй хөрөнгө.

   `verified` унтраалга гараар л асна — "би энэ үнийг өөрөө шалгасан" гэсэн
   утгатай. Автоматаар асвал тэмдэг утгаа алдана. Баталгаажаагүй мөрийг
   нүүрэн дээр ≈ тэмдэгтэйгээр ил үзүүлдэг тул худал мэдээлэл алга болохгүй,
   зүгээр л ҮНЭНЭЭР шошголоно.                                            */

interface MenuItem {
  name: string; nameMn?: string; price: number;
  category?: string; servesPeople?: number; spicy?: boolean;
}
interface Row {
  _id: string; name: string; nameMn?: string; slug: string;
  district: string; area?: string; lat?: number; lng?: number;
  address?: string; cuisine: string[]; tags: string[];
  pricePerPerson: number; parking: boolean; soloFriendly: boolean;
  delivery: boolean; reservation: boolean;
  hours: { open: string; close: string };
  menu: MenuItem[]; phone?: string; mapUrl?: string; note?: string;
  rating?: number; verified: boolean; lastVerified: string | null;
  source?: string; active: boolean;
}

const DISTRICTS = ["Khan-Uul", "Sukhbaatar", "Bayanzurkh", "Chingeltei", "Bayangol", "Songinokhairkhan", "Nalaikh", "Unknown"];
const BLANK: Partial<Row> = {
  name: "", nameMn: "", district: "Khan-Uul", area: "", address: "", cuisine: ["Korean"],
  tags: [], pricePerPerson: 30000, parking: false, soloFriendly: true,
  delivery: false, reservation: false, hours: { open: "11:00", close: "22:00" },
  menu: [], phone: "", mapUrl: "", note: "", verified: false, active: true,
};

const inputCls =
  "w-full border border-[#1E1E1E] bg-[#0A0A0A] px-2.5 py-2 text-[13px] text-[#F2F2F4] outline-none focus:border-[#2E29FF]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[#E2E4E8]">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-2.5 py-1.5 text-[11px] font-bold transition ${
        on ? "border-[#2E29FF] bg-[#2E29FF]/10 text-[#2E29FF]" : "border-[#1E1E1E] text-[#E2E4E8]"
      }`}
      style={{ borderRadius: 4 }}
    >
      {label}
    </button>
  );
}

export default function AdminRestaurants() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Partial<Row> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  /* Promise-ийн гинжээр бичсэн шалтгаан: `react-hooks/set-state-in-effect`
     дүрэм effect дотроос дуудагдсан `async` функцийн `await`-ийн дараах
     setState-ийг ч мөн effect-ийн бие гэж үзнэ. `.then()`-ийн callback нь
     тусдаа функцийн хил тул дүрэм зөвшөөрнө. Үр дүн ижил, promise буцаах
     тул дуудагчид `await load()` хэвээр ажиллана. */
  const load = useCallback(
    () =>
      fetch("/api/admin/restaurants")
        .then((r) => r.json())
        .then((d) => {
          setRows(Array.isArray(d.restaurants) ? d.restaurants : []);
          setLoading(false);
        })
        .catch(() => setLoading(false)),
    []
  );

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.name, r.nameMn, r.district, ...(r.tags || [])].join(" ").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  const verifiedCount = rows.filter((r) => r.verified && r.active).length;

  async function save() {
    if (!draft?.name?.trim()) { setMsg("Нэр шаардлагатай"); return; }
    setSaving(true);
    setMsg("");
    const isNew = !draft._id;
    const res = await fetch("/api/admin/restaurants", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? draft : { ...draft, id: draft._id }),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) { setMsg(d?.error || "Хадгалж чадсангүй"); return; }
    setDraft(null);
    await load();
  }

  async function toggleVerified(r: Row) {
    await fetch("/api/admin/restaurants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r._id, verified: !r.verified }),
    });
    await load();
  }

  async function remove(r: Row) {
    if (!confirm(`"${r.name}"-г бүрмөсөн устгах уу?`)) return;
    await fetch(`/api/admin/restaurants?id=${r._id}`, { method: "DELETE" });
    await load();
  }

  const set = (patch: Partial<Row>) => setDraft((d) => ({ ...(d || {}), ...patch }));

  return (
    <div className="px-4 py-6 md:px-8">
      {/* ─── Толгой ─── */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1E1E1E] pb-5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2E29FF]">SCOUT · DATA</div>
          <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-[#F2F2F4]">Ресторан сан</h1>
          <p className="mt-1 max-w-xl text-[12px] leading-[1.6] text-[#E2E4E8]">
            Нүүрэн дээрх AI Scout ЗӨВХӨН энэ сангаас хайдаг. ◉ = координаттай. Мөр байхгүй бол агент
            &ldquo;олдсонгүй&rdquo; гэж хэлнэ — өөрөө ресторан зохиохгүй.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[22px] font-extrabold leading-none text-[#F2F2F4]" style={{ fontVariantNumeric: "tabular-nums" }}>
              {verifiedCount}<span className="text-[#3f3f3f]">/{rows.length}</span>
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#E2E4E8]">Баталгаажсан</div>
          </div>
          <button
            type="button"
            onClick={() => setDraft({ ...BLANK })}
            className="bg-[#2E29FF] px-4 py-2.5 text-[12px] font-bold text-[#0A0A0A]"
            style={{ borderRadius: 4 }}
          >
            + ШИНЭ
          </button>
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Нэр, дүүрэг, tag-аар хайх…"
        className={`${inputCls} mt-5 max-w-sm`}
        style={{ borderRadius: 4 }}
      />

      {msg && <p className="mt-3 text-[12px] font-semibold text-[#FD8E86]">{msg}</p>}

      {/* ─── Жагсаалт ─── */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#1E1E1E] text-[10px] font-bold uppercase tracking-[0.12em] text-[#E2E4E8]">
              <th className="py-2 pr-3">Нэр</th>
              <th className="py-2 pr-3">Байршил</th>
              <th className="py-2 pr-3 text-right">₮/хүн</th>
              <th className="py-2 pr-3 text-right">Цэс</th>
              <th className="py-2 pr-3">Цаг</th>
              <th className="py-2 pr-3">Баталгаа</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="py-8 text-center text-[13px] text-[#E2E4E8]">Уншиж байна…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-[13px] text-[#E2E4E8]">Мөр алга. &ldquo;+ ШИНЭ&rdquo; дарж эхлүүлээрэй.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r._id} className="border-b border-[#141414] text-[13px] text-[#F2F2F4]">
                <td className="py-2.5 pr-3">
                  <button type="button" onClick={() => setDraft(r)} className="font-bold hover:text-[#2E29FF]">
                    {r.name}
                  </button>
                  {!r.active && <span className="ml-2 text-[10px] font-bold text-[#E2E4E8]">(идэвхгүй)</span>}
                </td>
                <td className="py-2.5 pr-3 text-[#E2E4E8]">
                  {r.district === "Unknown" ? <span className="text-[#E2E4E8]">— оруулаагүй</span> : r.district}
                  {r.area ? <span className="text-[#E2E4E8]"> · {r.area}</span> : null}
                  {typeof r.lat === "number" ? <span className="ml-1.5 text-[10px] text-[#2E29FF]">◉</span> : null}
                </td>
                <td className="py-2.5 pr-3 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {r.pricePerPerson.toLocaleString("en-US")}
                </td>
                <td className="py-2.5 pr-3 text-right text-[#E2E4E8]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {r.menu?.length || 0}
                </td>
                <td className="py-2.5 pr-3 text-[#E2E4E8]">{r.hours?.open}–{r.hours?.close}</td>
                <td className="py-2.5 pr-3">
                  <button
                    type="button"
                    onClick={() => void toggleVerified(r)}
                    className={`px-2 py-1 text-[10px] font-bold ${r.verified ? "bg-[#2E29FF] text-[#0A0A0A]" : "border border-[#1E1E1E] text-[#E2E4E8]"}`}
                    style={{ borderRadius: 4 }}
                  >
                    {r.verified ? "БАТАЛГААЖСАН" : "≈ ШАЛГААГҮЙ"}
                  </button>
                </td>
                <td className="py-2.5 text-right">
                  <button type="button" onClick={() => void remove(r)} className="text-[11px] font-bold text-[#E2E4E8] hover:text-[#2E29FF]">
                    Устгах
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Засварлагч ─── */}
      {draft && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onClick={() => setDraft(null)}>
          <div
            className="h-full w-full max-w-lg overflow-y-auto border-l border-[#1E1E1E] bg-[#0A0A0A] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-extrabold text-[#F2F2F4]">
                {draft._id ? "Засах" : "Шинэ ресторан"}
              </h2>
              <button type="button" onClick={() => setDraft(null)} className="text-[20px] text-[#E2E4E8]">×</button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Field label="Нэр (Latin)">
                <input value={draft.name || ""} onChange={(e) => set({ name: e.target.value })} className={inputCls} style={{ borderRadius: 4 }} />
              </Field>
              <Field label="Нэр (Кирилл)">
                <input value={draft.nameMn || ""} onChange={(e) => set({ nameMn: e.target.value })} className={inputCls} style={{ borderRadius: 4 }} />
              </Field>
              <Field label="Дүүрэг">
                <select value={draft.district || ""} onChange={(e) => set({ district: e.target.value })} className={inputCls} style={{ borderRadius: 4 }}>
                  {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="₮ / нэг хүн">
                <input
                  type="number"
                  value={draft.pricePerPerson ?? 0}
                  onChange={(e) => set({ pricePerPerson: Number(e.target.value) })}
                  className={inputCls}
                  style={{ borderRadius: 4 }}
                />
              </Field>
              <Field label="Хороолол · Байршил">
                <input
                  value={draft.area || ""}
                  onChange={(e) => set({ area: e.target.value })}
                  placeholder="Зайсан"
                  className={inputCls}
                  style={{ borderRadius: 4 }}
                />
              </Field>
              <div />
              <div className="col-span-2">
                <Field label="Хаяг">
                  <input value={draft.address || ""} onChange={(e) => set({ address: e.target.value })} className={inputCls} style={{ borderRadius: 4 }} />
                </Field>
              </div>
              {/* Координат байвал газрын зурагны холбоосыг систем ӨӨРӨӨ угсарна —
                  админ бүр мөрд Google-ийн урт URL наах шаардлагагүй. */}
              <Field label="Өргөрөг (lat)">
                <input
                  type="number" step="0.000001"
                  value={draft.lat ?? ""}
                  onChange={(e) => set({ lat: e.target.value === "" ? undefined : Number(e.target.value) })}
                  placeholder="47.9105"
                  className={inputCls} style={{ borderRadius: 4, fontVariantNumeric: "tabular-nums" }}
                />
              </Field>
              <Field label="Уртраг (lng)">
                <input
                  type="number" step="0.000001"
                  value={draft.lng ?? ""}
                  onChange={(e) => set({ lng: e.target.value === "" ? undefined : Number(e.target.value) })}
                  placeholder="106.9155"
                  className={inputCls} style={{ borderRadius: 4, fontVariantNumeric: "tabular-nums" }}
                />
              </Field>
              <Field label="Нээх">
                <input value={draft.hours?.open || ""} placeholder="11:00"
                  onChange={(e) => set({ hours: { open: e.target.value, close: draft.hours?.close || "22:00" } })}
                  className={inputCls} style={{ borderRadius: 4 }} />
              </Field>
              <Field label="Хаах">
                <input value={draft.hours?.close || ""} placeholder="23:00"
                  onChange={(e) => set({ hours: { open: draft.hours?.open || "11:00", close: e.target.value } })}
                  className={inputCls} style={{ borderRadius: 4 }} />
              </Field>
              <Field label="Утас">
                <input value={draft.phone || ""} onChange={(e) => set({ phone: e.target.value })} className={inputCls} style={{ borderRadius: 4 }} />
              </Field>
              <Field label="Үнэлгээ (0-5)">
                <input type="number" step="0.1" value={draft.rating ?? ""} onChange={(e) => set({ rating: Number(e.target.value) })} className={inputCls} style={{ borderRadius: 4 }} />
              </Field>
              <div className="col-span-2">
                <Field label="Газрын зураг (URL)">
                  <input value={draft.mapUrl || ""} onChange={(e) => set({ mapUrl: e.target.value })} className={inputCls} style={{ borderRadius: 4 }} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Tag (таслалаар)">
                  <input
                    value={(draft.tags || []).join(", ")}
                    onChange={(e) => set({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                    className={inputCls}
                    style={{ borderRadius: 4 }}
                    placeholder="charcoal, late-night, family"
                  />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Агентад өгөх нэг мөр контекст">
                  <input value={draft.note || ""} onChange={(e) => set({ note: e.target.value })} className={inputCls} style={{ borderRadius: 4 }}
                    placeholder="Нүүрсэн галтай, солонгосчууд өөрсдөө ирдэг" />
                </Field>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Toggle on={!!draft.parking} label="Зогсоол" onClick={() => set({ parking: !draft.parking })} />
              <Toggle on={draft.soloFriendly !== false} label="Ганцаараа OK" onClick={() => set({ soloFriendly: draft.soloFriendly === false })} />
              <Toggle on={!!draft.delivery} label="Хүргэлт" onClick={() => set({ delivery: !draft.delivery })} />
              <Toggle on={!!draft.reservation} label="Захиалга" onClick={() => set({ reservation: !draft.reservation })} />
              <Toggle on={draft.active !== false} label="Идэвхтэй" onClick={() => set({ active: draft.active === false })} />
              <Toggle on={!!draft.verified} label={draft.verified ? "Баталгаажсан" : "≈ Шалгаагүй"} onClick={() => set({ verified: !draft.verified })} />
            </div>

            {/* ─── Цэс ─── */}
            <div className="mt-6 border-t border-[#1E1E1E] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#E2E4E8]">
                  Цэс · {(draft.menu || []).length}
                </span>
                <button
                  type="button"
                  onClick={() => set({ menu: [...(draft.menu || []), { name: "", price: 0 }] })}
                  className="border border-[#1E1E1E] px-2.5 py-1.5 text-[11px] font-bold text-[#E2E4E8]"
                  style={{ borderRadius: 4 }}
                >
                  + Хоол
                </button>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {(draft.menu || []).map((m, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_88px_28px] gap-2">
                    <input
                      value={m.name}
                      placeholder="Samgyeopsal"
                      onChange={(e) => {
                        const menu = [...(draft.menu || [])];
                        menu[i] = { ...menu[i], name: e.target.value };
                        set({ menu });
                      }}
                      className={inputCls}
                      style={{ borderRadius: 4 }}
                    />
                    <input
                      value={m.nameMn || ""}
                      placeholder="Самгёпсаль"
                      onChange={(e) => {
                        const menu = [...(draft.menu || [])];
                        menu[i] = { ...menu[i], nameMn: e.target.value };
                        set({ menu });
                      }}
                      className={inputCls}
                      style={{ borderRadius: 4 }}
                    />
                    <input
                      type="number"
                      value={m.price}
                      onChange={(e) => {
                        const menu = [...(draft.menu || [])];
                        menu[i] = { ...menu[i], price: Number(e.target.value) };
                        set({ menu });
                      }}
                      className={inputCls}
                      style={{ borderRadius: 4, fontVariantNumeric: "tabular-nums" }}
                    />
                    <button
                      type="button"
                      onClick={() => set({ menu: (draft.menu || []).filter((_, j) => j !== i) })}
                      className="text-[16px] text-[#E2E4E8] hover:text-[#2E29FF]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="sticky bottom-0 mt-6 flex gap-3 border-t border-[#1E1E1E] bg-[#0A0A0A] py-4">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="bg-[#2E29FF] px-5 py-2.5 text-[12px] font-bold text-[#0A0A0A] disabled:opacity-50"
                style={{ borderRadius: 4 }}
              >
                {saving ? "ХАДГАЛЖ БАЙНА…" : "ХАДГАЛАХ"}
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="border border-[#1E1E1E] px-5 py-2.5 text-[12px] font-bold text-[#E2E4E8]"
                style={{ borderRadius: 4 }}
              >
                Болих
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
