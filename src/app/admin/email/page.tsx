"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Btn, Card, T } from "@/components/admin/kit";

type Audience = "new7" | "new30" | "paid" | "all";

const AUDIENCES: { id: Audience; label: string; desc: string }[] = [
  { id: "new7", label: "Шинэ · 7 хоног", desc: "Сүүлийн 7 хоногт бүртгүүлсэн" },
  { id: "new30", label: "Шинэ · 30 хоног", desc: "Сүүлийн 30 хоногт бүртгүүлсэн" },
  { id: "paid", label: "Төлбөрт гишүүд", desc: "Идэвхтэй гишүүнчлэлтэй" },
  { id: "all", label: "Бүгд", desc: "Бүх бүртгэлтэй хэрэглэгч" },
];

interface Job {
  jobId: string;
  status: "running" | "done" | "cancelled" | "failed" | "stalled";
  total: number;
  done: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

const LIVE = (s: Job["status"]) => s === "running";

// ─── Бүртгүүлсэн хүмүүс рүү email илгээх ───
// Илгээлт нь сервер дээр арын ажлаар явна — энэ хуудас түүний
// явцыг 2 секунд тутамд асууна. Хуудсаа хааж болно, илгээлт үргэлжилнэ.
export default function AdminEmailPage() {
  const [audience, setAudience] = useState<Audience>("new7");
  const [count, setCount] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<"test" | "send" | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [result, setResult] = useState<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async (jobId: string) => {
    try {
      const r = await fetch(`/api/admin/email-broadcast?jobId=${jobId}`);
      if (!r.ok) return;
      const d: Job = await r.json();
      setJob(d);
      if (LIVE(d.status)) timer.current = setTimeout(() => poll(jobId), 2000);
      else setBusy(null);
    } catch {
      timer.current = setTimeout(() => poll(jobId), 4000);
    }
  }, []);

  useEffect(() => {
    setCount(null);
    fetch(`/api/admin/email-broadcast?audience=${audience}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setCount(d?.count ?? 0);
        setSkipped(d?.skipped ?? 0);
        // Хуудас сэргээгдсэн бол явж байгаа илгээлт рүүгээ буцаж холбогдоно.
        if (d?.active && !job) {
          setJob(d.active);
          if (LIVE(d.active.status)) {
            setBusy("send");
            poll(d.active.jobId);
          }
        }
      })
      .catch(() => setCount(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

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
    if (!confirm(`${count} хаяг руу "${subject}" илгээх үү? Буцаах боломжгүй.`)) return;
    setBusy("send");
    setResult("");
    setJob(null);
    try {
      const res = await fetch("/api/admin/email-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, audience }),
      });
      const d = await res.json();
      if (!res.ok) {
        setResult(
          d.error === "broadcast_already_running"
            ? "Өөр илгээлт яг одоо явж байна — дуустал хүлээнэ үү."
            : `Алдаа: ${d.error || res.status}`
        );
        setBusy(null);
        return;
      }
      setJob(d);
      poll(d.jobId);
    } catch {
      setResult("Сүлжээний алдаа");
      setBusy(null);
    }
  };

  const act = async (action: "cancel" | "resume") => {
    if (!job) return;
    const res = await fetch("/api/admin/email-broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, jobId: job.jobId }),
    });
    const d = await res.json();
    if (!res.ok) { setResult(`Алдаа: ${d.error || res.status}`); return; }
    setJob(d);
    if (action === "resume") { setBusy("send"); poll(job.jobId); }
  };

  const inputCls =
    "w-full rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#F4F0E8] outline-none transition focus:border-[#2E29FF]";

  const pct = job && job.total ? Math.round((job.done / job.total) * 100) : 0;
  const sending = !!job && LIVE(job.status);
  // Явж байгаа илгээлтийн үед маягтыг түгжинэ — өөрчилсөн ч
  // сервер дээрх ажилд нөлөөлөхгүй тул төөрөгдөл үүсгэнэ.
  const locked = sending || busy === "send";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="chrome flex items-center gap-2 text-[11px] font-bold">
          <span className="text-[#2E29FF]">EMAIL</span>
          <span style={{ color: T.faint }}>BROADCAST</span>
        </div>
        <h1 className="mt-1 text-[24px] font-bold" style={{ color: "#2E29FF", fontFamily: "var(--font-display)" }}>
          Email илгээх
        </h1>
        <p className="mt-1 text-[12px]" style={{ color: T.muted }}>
          Бүртгүүлсэн бүх хүн рүү Resend-ээр илгээнэ · тоон хязгааргүй.
        </p>
      </div>

      {/* Audience */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {AUDIENCES.map((a) => (
          <button
            key={a.id}
            onClick={() => !locked && setAudience(a.id)}
            disabled={locked}
            className={`rounded-[4px] border p-3 text-left transition disabled:opacity-40 ${
              audience === a.id
                ? "border-[#2E29FF] bg-[rgba(46,41,255,0.06)]"
                : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)]"
            }`}
          >
            <div className={`text-[12px] font-bold ${audience === a.id ? "text-[#2E29FF]" : "text-[#F4F0E8]"}`}>
              {a.label}
            </div>
            <div className="mt-0.5 text-[10px]" style={{ color: T.faint }}>{a.desc}</div>
          </button>
        ))}
      </div>

      <Card hud className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="chrome text-[11px] font-bold" style={{ color: T.faint }}>ХҮЛЭЭН АВАГЧ</span>
          <span className="chrome rounded-[4px] bg-[#2E29FF] px-2.5 py-1 text-[11px] font-bold text-[#0A0A0A]">
            {count === null ? "…" : `${count} ХАЯГ`}
          </span>
        </div>
        {skipped > 0 && (
          <p className="mb-4 text-[11px]" style={{ color: T.faint }}>
            + {skipped} зохиомол хаяг хасагдсан (нэрээр бүртгүүлсэн хүмүүсийн `@antaqor.dm`).
            Эдгээр рүү илгээвэл бүгд bounce болж, Resend данс түдгэлзэнэ.
          </p>
        )}
        {skipped === 0 && <div className="mb-4" />}

        {/* Явц */}
        {job && (
          <div className="mb-5 rounded-[4px] border border-[rgba(46,41,255,0.25)] bg-[rgba(46,41,255,0.04)] p-4">
            <div className="flex items-center justify-between">
              <span className="chrome text-[11px] font-bold" style={{ color: "#2E29FF" }}>
                {job.status === "running" && "ИЛГЭЭЖ БАЙНА"}
                {job.status === "done" && "ДУУСЛАА"}
                {job.status === "cancelled" && "ЗОГСООСОН"}
                {job.status === "failed" && "АЛДАА"}
                {job.status === "stalled" && "ТАСАРСАН"}
              </span>
              <span className="text-[12px] font-bold" style={{ color: "#14151C" }}>
                {job.done} / {job.total}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
              <div className="h-full bg-[#2E29FF] transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: T.muted }}>
              <span style={{ color: "#4ADE80" }}>Илгээсэн {job.sent}</span>
              <span style={{ color: job.failed ? "#FF6B6B" : T.faint }}>Алдаа {job.failed}</span>
              {job.status === "running" && (
                <span style={{ color: T.faint }}>
                  ~{Math.max(1, Math.ceil((job.total - job.done) / 120))} минут үлдлээ
                </span>
              )}
            </div>
            {job.errors.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-[10px]" style={{ color: T.faint }}>
                {job.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              {job.status === "running" && (
                <Btn variant="secondary" size="sm" onClick={() => act("cancel")}>Зогсоох</Btn>
              )}
              {(job.status === "stalled" || job.status === "cancelled" || job.status === "failed") &&
                job.done < job.total && (
                  <Btn variant="secondary" size="sm" onClick={() => act("resume")}>
                    Үлдсэн {job.total - job.done} хаягийг үргэлжлүүлэх
                  </Btn>
                )}
              {!LIVE(job.status) && (
                <Btn variant="secondary" size="sm" onClick={() => setJob(null)}>Хаах</Btn>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="chrome mb-1.5 block text-[8px] font-bold" style={{ color: T.faint }}>ГАРЧИГ</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={locked} maxLength={150} placeholder="ж: Day 1 өнөөдөр 6 цагт эхэлнэ" className={inputCls} />
          </div>
          <div>
            <label className="chrome mb-1.5 block text-[8px] font-bold" style={{ color: T.faint }}>МЕССЕЖ (энгийн текст — мөр шинэчлэл хадгалагдана)</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} disabled={locked} rows={8} maxLength={5000} placeholder={"Сайн уу!\n\nDay 1: ChatGPT хичээл өнөөдөр 6 цагт эхэлнэ…"} className={`${inputCls} resize-y`} />
          </div>

          {/* Туршилт */}
          <div className="flex flex-wrap items-end gap-2 rounded-[4px] border border-[rgba(255,255,255,0.08)] p-3">
            <div className="min-w-[220px] flex-1">
              <label className="chrome mb-1.5 block text-[8px] font-bold" style={{ color: T.faint }}>ЭХЛЭЭД ӨӨРТӨӨ ТУРШ</label>
              <input value={testTo} onChange={(e) => setTestTo(e.target.value)} disabled={locked} placeholder="tany@mail.com" className={inputCls} />
            </div>
            <Btn variant="secondary" size="sm" onClick={sendTest} disabled={!valid || !testTo.includes("@") || locked} loading={busy === "test"}>
              Туршилт илгээх
            </Btn>
          </div>

          <Btn onClick={send} disabled={!valid || !count || locked} loading={busy === "send"} className="w-full">
            {sending ? "Илгээж байна…" : count ? `${count} хаяг руу илгээх` : "Илгээх"}
          </Btn>

          {result && (
            <p className="text-[13px]" style={{ color: result.startsWith("✓") ? "#4ADE80" : "#FF6B6B" }}>
              {result}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
