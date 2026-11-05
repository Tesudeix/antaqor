"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";

const NEON = "var(--accent-ink, #2E29FF)";

interface Props {
  onEnrolled?: () => void;
  variant?: "card" | "inline";
}

export default function PasskeyEnroll({ onEnrolled, variant = "card" }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err" | ""; text: string }>({ tone: "", text: "" });
  const [done, setDone] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "PublicKeyCredential" in window &&
    typeof navigator !== "undefined";

  if (!supported) return null;

  const enroll = async () => {
    setBusy(true);
    setMsg({ tone: "", text: "" });
    try {
      const optsRes = await fetch("/api/webauthn/register/options", { method: "POST" });
      if (!optsRes.ok) {
        const d = await optsRes.json().catch(() => ({}));
        throw new Error(d.error || "Сервер алдаа");
      }
      const options = await optsRes.json();

      // Friendly device label — what shows in /settings later.
      const ua = navigator.userAgent;
      let deviceLabel = "Энэ төхөөрөмж";
      if (/iPhone/.test(ua)) deviceLabel = "iPhone";
      else if (/iPad/.test(ua)) deviceLabel = "iPad";
      else if (/Android/.test(ua)) deviceLabel = "Android";
      else if (/Macintosh/.test(ua)) deviceLabel = "Mac";
      else if (/Windows/.test(ua)) deviceLabel = "Windows";

      const attResp = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attResp, deviceLabel }),
      });
      if (!verifyRes.ok) {
        const d = await verifyRes.json().catch(() => ({}));
        throw new Error(d.error || "Баталгаажуулалт амжилтгүй");
      }
      setDone(true);
      setMsg({ tone: "ok", text: "Идэвхжсэн" });
      onEnrolled?.();
    } catch (e) {
      const m = e instanceof Error ? e.message : "Алдаа";
      // Common case: user cancelled the platform prompt
      if (/cancelled|aborted|NotAllowedError/i.test(m)) {
        setMsg({ tone: "", text: "" });
      } else {
        setMsg({ tone: "err", text: m });
      }
    } finally {
      setBusy(false);
    }
  };

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={enroll}
        disabled={busy || done}
        className="inline-flex items-center gap-2 rounded-[4px] px-3 py-1.5 text-[12px] font-black text-white transition active:scale-95 disabled:opacity-60"
        style={{ background: NEON, boxShadow: "0 0 12px rgba(46,41,255,0.4)" }}
      >
        <FaceIdIcon />
        {done ? "Идэвхжсэн" : busy ? "..." : "Face ID идэвхжүүлэх"}
      </button>
    );
  }

  return (
    <div
      className="rounded-[4px] border bg-[#f2f5f8] p-4"
      style={{ borderColor: "rgba(46,41,255,0.25)" }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px]"
          style={{ background: NEON, boxShadow: "0 0 14px rgba(46,41,255,0.45)" }}
        >
          <FaceIdIcon />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-black text-white">Дараа Face ID-аар нэвтэр</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-[#E2E4E8]">
            Нууц үгийг бичихгүйгээр Touch ID / Face ID-аар нэвтрэх боломжтой
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={enroll}
              disabled={busy || done}
              className="rounded-[4px] px-3 py-1.5 text-[11px] font-black text-white transition active:scale-95 disabled:opacity-60"
              style={{ background: NEON, boxShadow: "0 0 12px rgba(46,41,255,0.4)" }}
            >
              {done ? "✓ Идэвхжсэн" : busy ? "..." : "Идэвхжүүлэх"}
            </button>
            {msg.text && (
              <span
                className="text-[11px] font-bold"
                style={{ color: msg.tone === "ok" ? NEON : msg.tone === "err" ? "#2E29FF" : "#30333F" }}
              >
                {msg.tone === "ok" ? "✓ " : ""}
                {msg.text}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FaceIdIcon() {
  return (
    <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <rect x="3" y="3" width="6" height="3" rx="1" /><rect x="15" y="3" width="6" height="3" rx="1" />
      <rect x="3" y="18" width="6" height="3" rx="1" /><rect x="15" y="18" width="6" height="3" rx="1" />
      <path strokeLinecap="round" d="M8.5 9v3M15.5 9v3M9 16c.7.7 1.7 1 3 1s2.3-.3 3-1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.5 9v4h-1" />
    </svg>
  );
}
