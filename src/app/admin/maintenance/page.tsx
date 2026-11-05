"use client";

import { useCallback, useEffect, useState } from "react";

const DEFAULT_TEXT = "Сайт засвартай байна. Зарим хэсэг түр ажиллахгүй байж болно.";

export default function AdminMaintenancePage() {
  const [on, setOn] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/maintenance", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setOn(!!d.on);
        setText(String(d.text || ""));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(nextOn: boolean) {
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: nextOn, text }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Хадгалж чадсангүй");
      setOn(!!d.on);
      setMsg("Хадгаллаа. 30 секундын дотор бүх хуудсанд харагдана.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Алдаа");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-[13px] text-[#E2E4E8]">Ачаалж байна…</div>;

  return (
    <div className="max-w-2xl space-y-5 p-1">
      <div>
        <h1 className="text-[22px] font-black tracking-tight">Засвартай горим</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-[#E2E4E8]">
          Сайтын дээд талд шар зурвас гаргана. Сайт хэвийн ажиллана — хуудас нээгдэнэ,
          нэвтрэлт, төлбөр бүгд ажиллана. Энэ бол зөвхөн МЭДЭГДЭЛ, хаалт биш.
        </p>
      </div>

      <div className="flex items-center justify-between border border-[rgba(15,23,38,0.10)] px-4 py-3">
        <div>
          <div className="text-[14px] font-bold">{on ? "АСААЛТТАЙ" : "УНТРААЛТТАЙ"}</div>
          <div className="text-[12px] text-[#E2E4E8]">
            {on ? "Зочдод зурвас харагдаж байна" : "Зурвас харагдахгүй байна"}
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => save(!on)}
          className={`px-5 py-2 text-[12px] font-black uppercase tracking-wider transition disabled:opacity-50 ${
            on ? "bg-[#0e1726] text-white" : "bg-[#d9a441] text-[#0e1726]"
          }`}
        >
          {saving ? "…" : on ? "Унтраах" : "Асаах"}
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#E2E4E8]">
          Зурвасын текст
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={240}
          placeholder={DEFAULT_TEXT}
          className="w-full border border-[rgba(15,23,38,0.14)] px-3 py-2 text-[13px] outline-none focus:border-[#2E29FF]"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#E2E4E8]">
            Хоосон бол: “{DEFAULT_TEXT}”
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={() => save(on)}
            className="border border-[rgba(15,23,38,0.14)] px-4 py-1.5 text-[12px] font-bold disabled:opacity-50"
          >
            Текст хадгалах
          </button>
        </div>
      </div>

      {msg && <div className="text-[12px] font-semibold text-[#2E29FF]">{msg}</div>}
    </div>
  );
}
