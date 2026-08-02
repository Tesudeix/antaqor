"use client";

import { useEffect, useState } from "react";
import { Btn, Card, T } from "@/components/admin/kit";

type Audience = "new7" | "new30" | "paid" | "all";

const AUDIENCES: { id: Audience; label: string; desc: string }[] = [
  { id: "new7", label: "Шинэ · 7 хоног", desc: "Сүүлийн 7 хоногт бүртгүүлсэн" },
  { id: "new30", label: "Шинэ · 30 хоног", desc: "Сүүлийн 30 хоногт бүртгүүлсэн" },
  { id: "paid", label: "Төлбөрт гишүүд", desc: "Идэвхтэй гишүүнчлэлтэй" },
  { id: "all", label: "Бүгд", desc: "Бүх бүртгэлтэй хэрэглэгч" },
];

// ─── Бүртгүүлсэн хүмүүс рүү email илгээх ───
export default function AdminEmailPage() {
  const [audience, setAudience] = useState<Audience>("new7");
  const [count, setCount] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<"test" | "send" | null>(null);
  const [result, setResult] = useState<string>("");

  useEffect(() => {
    setCount(null);
    fetch(`/api/admin/email-broadcast?audience=${audience}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCount(d?.count ?? 0))
      .catch(() => setCount(0));
  }, [audience]);

  const valid = subject.trim().length >= 3 && message.trim().length >= 10;

  const sendTest = async () => {
    if (!valid || !testTo.includes("@")) return;
    setBusy("test");
    setResult("");
    try {
      const res = await fetch("/api/admin/email-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, testTo }),
      });
      const d = await res.json();
      setResult(res.ok ? `✓ Туршилт ${testTo} руу илгээгдлээ` : `Алдаа: ${d.error || res.status}`);
    } catch {
      setResult("Сүлжээний алдаа");
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!valid || !count) return;
    const n = Math.min(count, 100);
    if (!confirm(`${n} хаяг руу "${subject}" илгээх үү? Буцаах боломжгүй.`)) return;
    setBusy("send");
    setResult("");
    try {
      const res = await fetch("/api/admin/email-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, audience }),
      });
      const d = await res.json();
      setResult(
        res.ok
          ? `✓ Илгээсэн: ${d.sent} · Алдаа: ${d.failed}${d.errors?.length ? ` (${d.errors[0]})` : ""}`
          : `Алдаа: ${d.error || res.status}`
      );
    } catch {
      setResult("Сүлжээний алдаа");
    } finally {
      setBusy(null);
    }
  };

  const inputCls =
    "w-full rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#0a0a0c] px-3 py-2.5 text-[13px] text-[#F4F0E8] outline-none transition focus:border-[#1080CA]";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="chrome flex items-center gap-2 text-[9px] font-bold">
          <span className="text-[#1080CA]">[EMAIL]</span>
          <span className="text-[#1080CA]">/////</span>
          <span style={{ color: T.faint }}>BROADCAST</span>
        </div>
        <h1 className="mt-1 text-[24px] font-bold" style={{ color: "#1080CA", fontFamily: "var(--font-display)" }}>
          Email илгээх
        </h1>
        <p className="mt-1 text-[12px]" style={{ color: T.muted }}>
          Бүртгүүлсэн хүмүүс рүү Resend-ээр илгээнэ · нэг удаад дээд тал нь 100 хаяг.
        </p>
      </div>

      {/* Audience */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {AUDIENCES.map((a) => (
          <button
            key={a.id}
            onClick={() => setAudience(a.id)}
            className={`rounded-[4px] border p-3 text-left transition ${
              audience === a.id
                ? "border-[#1080CA] bg-[rgba(16,128,202,0.06)]"
                : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)]"
            }`}
          >
            <div className={`text-[12px] font-bold ${audience === a.id ? "text-[#1080CA]" : "text-[#F4F0E8]"}`}>
              {a.label}
            </div>
            <div className="mt-0.5 text-[10px]" style={{ color: T.faint }}>{a.desc}</div>
          </button>
        ))}
      </div>

      <Card hud className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="chrome text-[9px] font-bold" style={{ color: T.faint }}>ХҮЛЭЭН АВАГЧ</span>
          <span className="chrome rounded-[4px] bg-[#1080CA] px-2.5 py-1 text-[9px] font-bold text-[#161618]">
            {count === null ? "…" : `${count} ХАЯГ`}
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="chrome mb-1.5 block text-[8px] font-bold" style={{ color: T.faint }}>ГАРЧИГ</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} placeholder="ж: Day 1 өнөөдөр 6 цагт эхэлнэ" className={inputCls} />
          </div>
          <div>
            <label className="chrome mb-1.5 block text-[8px] font-bold" style={{ color: T.faint }}>МЕССЕЖ (энгийн текст — мөр шинэчлэл хадгалагдана)</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} maxLength={5000} placeholder={"Сайн уу!\n\nDay 1: ChatGPT хичээл өнөөдөр 6 цагт эхэлнэ…"} className={`${inputCls} resize-y`} />
          </div>

          {/* Туршилт */}
          <div className="flex flex-wrap items-end gap-2 rounded-[4px] border border-[rgba(255,255,255,0.08)] p-3">
            <div className="min-w-[220px] flex-1">
              <label className="chrome mb-1.5 block text-[8px] font-bold" style={{ color: T.faint }}>ЭХЛЭЭД ӨӨРТӨӨ ТУРШ</label>
              <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="tany@mail.com" className={inputCls} />
            </div>
            <Btn variant="secondary" size="sm" onClick={sendTest} disabled={!valid || !testTo.includes("@")} loading={busy === "test"}>
              Туршилт илгээх
            </Btn>
          </div>

          <Btn onClick={send} disabled={!valid || !count} loading={busy === "send"} className="w-full">
            {count ? `${Math.min(count, 100)} хаяг руу илгээх` : "Илгээх"}
          </Btn>

          {result && (
            <p className="text-[13px]" style={{ color: result.startsWith("✓") ? "#4ADE80" : "#4FA8E8" }}>
              {result}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
