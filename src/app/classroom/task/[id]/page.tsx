"use client";

import { useEffect, useRef, useState, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import PaywallGate from "@/components/PaywallGate";
import { motion } from "framer-motion";

interface Task {
  _id: string;
  title: string;
  description: string;
  deadline?: string;
  maxScore: number;
  course: string;
  subsection: string;
}

interface Submission {
  _id: string;
  answerText: string;
  attachments: { url: string; name: string }[];
  score?: number;
  feedback: string;
  state: "submitted" | "graded";
  submittedAt: string;
  gradedAt?: string;
}

export default function TaskPageWrapper({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PaywallGate>
      <TaskPage params={params} />
    </PaywallGate>
  );
}

function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();

  const fileRef = useRef<HTMLInputElement>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

  const [answer, setAnswer] = useState("");
  const [attachments, setAttachments] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/classroom/lesson-tasks/${id}`).then((r) => r.json()),
      fetch(`/api/classroom/lesson-tasks/${id}/submission`).then((r) => r.json()),
    ])
      .then(([t, s]) => {
        setTask(t.task || null);
        if (s.submission) {
          setSubmission(s.submission);
          setAnswer(s.submission.answerText || "");
          setAttachments(s.submission.attachments || []);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok && data.url) {
          setAttachments((p) => [...p, { url: data.url, name: file.name }].slice(0, 5));
        }
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    if (submitting) return;
    if (!answer.trim() && attachments.length === 0) {
      setError("Хариу эсвэл хавсралт оруулна уу");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch(`/api/classroom/lesson-tasks/${id}/submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerText: answer, attachments }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Илгээх амжилтгүй");
        return;
      }
      setSubmission(data.submission);
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-3 w-3 animate-pulse rounded-[4px] bg-[#EF2C58]" /></div>;
  }
  if (!task) {
    return <div className="py-20 text-center text-[14px] text-[#888]">Даалгавар олдсонгүй</div>;
  }

  const isGraded = submission?.state === "graded" && typeof submission.score === "number";
  const pct = isGraded ? Math.round((submission!.score! / task.maxScore) * 100) : 0;
  const deadlineMs = task.deadline ? +new Date(task.deadline) : null;
  const deadlinePast = deadlineMs ? Date.now() > deadlineMs : false;

  return (
    <div className="mx-auto max-w-[760px] pb-12">
      <Link href={`/classroom/course/${task.course}`} className="mb-3 inline-flex items-center gap-1 text-[11px] text-[#666] transition hover:text-[#EF2C58]">
        ← Курс руу буцах
      </Link>

      {/* Task header */}
      <div className="mb-5 rounded-[4px] border border-[rgba(239,44,88,0.22)] bg-gradient-to-br from-[rgba(239,44,88,0.06)] via-[#0E0E0E] to-[#0B0B0B] p-5">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#EF2C58] px-2 py-1 text-[9px] font-black tracking-[0.18em] text-white">
            ДААЛГАВАР
          </span>
          {isGraded && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(239,44,88,0.4)] bg-[rgba(239,44,88,0.08)] px-2 py-1 text-[10px] font-black text-[#EF2C58]">
              {submission!.score}/{task.maxScore} · {pct}%
            </span>
          )}
        </div>
        <h1 className="mt-2 text-[22px] font-black leading-tight text-[#E8E8E8] sm:text-[26px]">{task.title}</h1>
        {task.description && (
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[#AAA]">{task.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[#888]">
          <span>Хамгийн их оноо: <strong className="text-[#E8E8E8]">{task.maxScore}</strong></span>
          {task.deadline && (
            <>
              <span className="text-[#333]">·</span>
              <span className={deadlinePast ? "text-[#EF4444] font-bold" : ""}>
                Хугацаа: {new Date(task.deadline).toLocaleDateString("mn-MN", { year: "numeric", month: "long", day: "numeric" })}
                {deadlinePast && " (өнгөрсөн)"}
              </span>
            </>
          )}
        </div>
      </div>

      {!session ? (
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-6 text-center">
          <p className="text-[13px] text-[#888]">Даалгавар илгээхийн тулд нэвтэрнэ үү</p>
          <Link href="/auth/signin" className="mt-3 inline-block rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-black text-white">Нэвтрэх</Link>
        </div>
      ) : (
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-5">
          {/* Status */}
          {submission && (
            <div className={`mb-4 rounded-[4px] border px-3 py-2 ${isGraded ? "border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.06)]" : "border-[rgba(255,193,7,0.3)] bg-[rgba(255,193,7,0.06)]"}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${isGraded ? "text-[#EF2C58]" : "text-[#FFC107]"}`}>
                  {isGraded ? `ҮНЭЛЭГДСЭН · ${submission.score}/${task.maxScore}` : "ИЛГЭЭСЭН · ҮНЭЛГЭЭ ХҮЛЭЭЖ БАЙНА"}
                </span>
                <span className="text-[10px] text-[#888]">
                  {new Date(submission.submittedAt).toLocaleDateString("mn-MN")}
                </span>
              </div>
              {isGraded && submission.feedback && (
                <p className="mt-2 text-[12px] leading-relaxed text-[#CCC]">
                  <strong className="text-[#888]">Тайлбар:</strong> {submission.feedback}
                </p>
              )}
            </div>
          )}

          {/* Form */}
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#888]">Хариу бичих</div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={isGraded ? "Дахин илгээхэд үнэлгээ цэвэрлэгдэнэ" : "Хариу, тайлбар, шийдлээ бичнэ үү..."}
            rows={6}
            maxLength={10000}
            className="w-full resize-y rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-3 text-[13px] leading-relaxed text-[#E8E8E8] placeholder-[#555] outline-none focus:border-[rgba(239,44,88,0.4)]"
          />

          {/* Attachments */}
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#888]">Файл хавсаргах</span>
              <span className="text-[9px] text-[#555]">{attachments.length}/5</span>
            </div>
            {attachments.length > 0 && (
              <ul className="mb-2 space-y-1">
                {attachments.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-2.5 py-1.5">
                    <span className="rounded-[3px] bg-[rgba(239,44,88,0.12)] px-1.5 py-0.5 text-[9px] font-black text-[#EF2C58]">FILE</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-[#CCC]">{a.name}</span>
                    <button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="text-[#666] hover:text-[#EF4444]">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {attachments.length < 5 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-dashed border-[rgba(239,44,88,0.3)] px-3 py-1.5 text-[11px] font-bold text-[#EF2C58] hover:bg-[rgba(239,44,88,0.05)] disabled:opacity-50"
              >
                {uploading ? "Хадгалж байна..." : "+ Файл нэмэх"}
              </button>
            )}
            <input ref={fileRef} type="file" multiple onChange={handlePick} className="hidden" />
          </div>

          {error && (
            <div className="mt-3 rounded-[4px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11px] text-[#EF4444]">
              {error}
            </div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.08)] px-3 py-2 text-[11px] font-bold text-[#EF2C58]"
            >
              ✓ Илгээлээ. Багш үнэлэхийг хүлээгээрэй.
            </motion.div>
          )}

          <button
            onClick={submit}
            disabled={submitting || uploading || (!answer.trim() && attachments.length === 0)}
            className="mt-4 w-full rounded-[4px] bg-[#EF2C58] py-3 text-[13px] font-black text-white transition hover:bg-[#D4264E] disabled:opacity-40"
          >
            {submitting ? "Илгээж байна..." : submission ? "Дахин илгээх" : "Илгээх"}
          </button>
        </div>
      )}
    </div>
  );
}
