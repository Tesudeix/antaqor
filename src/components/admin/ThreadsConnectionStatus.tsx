"use client";

import { useEffect, useState } from "react";

// Connection health card for the Threads integration. The OAuth callback
// redirects here with ?error= / ?connected= — surface both, because a failed
// token exchange otherwise dies silently and the homepage feed just stays
// hidden with no explanation.

interface ThreadsProfile {
  id?: string;
  username?: string;
  name?: string;
  threads_profile_picture_url?: string;
}

export default function ThreadsConnectionStatus() {
  const [state, setState] = useState<"loading" | "connected" | "disconnected">("loading");
  const [profile, setProfile] = useState<ThreadsProfile | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setOauthError(err);
    if (params.get("connected") === "true") setJustConnected(true);

    fetch("/api/admin/threads/profile")
      .then(async (r) => {
        if (!r.ok) {
          setState("disconnected");
          return;
        }
        const d = await r.json();
        if (d && d.username) {
          setProfile(d);
          setState("connected");
        } else {
          setState("disconnected");
        }
      })
      .catch(() => setState("disconnected"));
  }, []);

  if (state === "loading") return null;

  if (state === "connected") {
    return (
      <div className="flex items-center gap-3 rounded-[4px] border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] px-4 py-3">
        {profile?.threads_profile_picture_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.threads_profile_picture_url}
            alt=""
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[rgba(34,197,94,0.15)] text-[#4ade80]">
            ✓
          </span>
        )}
        <div className="flex-1">
          <div className="text-[12px] font-black tracking-wide text-[#4ade80]">
            THREADS ХОЛБОГДСОН{justConnected ? " 🎉" : ""}
          </div>
          <div className="text-[11px] text-[#E2E4E8]">
            @{profile?.username} — постууд нүүр хуудасны Threads хэсэгт автоматаар гарна (10 мин кэштэй)
          </div>
        </div>
        <a
          href="/api/admin/threads/auth"
          className="shrink-0 rounded-[4px] border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-[11px] font-bold text-[#E2E4E8] transition hover:text-[#F2F2F4]"
        >
          Дахин холбох
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-[4px] border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.07)] px-5 py-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[rgba(245,158,11,0.15)] text-[14px] text-[#fbbf24]">
          !
        </span>
        <div className="text-[13px] font-black tracking-wide text-[#fbbf24]">
          THREADS ХОЛБОГДООГҮЙ — нүүр хуудасны Threads хэсэг нуугдмал байна
        </div>
      </div>

      {oauthError && (
        <div className="mt-3 rounded-[4px] border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)] px-3 py-2 text-[11px] leading-relaxed text-[#fbbf24]">
          <span className="font-black">Сүүлийн оролдлогын алдаа (Meta):</span> {oauthError}
        </div>
      )}

      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[12px] leading-relaxed text-[#E2E4E8]">
        <li>
          <span className="font-bold text-[#F2F2F4]">developers.facebook.com</span> → Threads app →{" "}
          <span className="font-bold text-[#F2F2F4]">App roles</span> хэсэгт{" "}
          <span className="font-bold text-[#4C47FF]">@tesudei</span> Threads акаунтыг{" "}
          <span className="font-bold text-[#F2F2F4]">Threads Tester</span>-ээр нэм
        </li>
        <li>
          Threads апп дотроос: Тохиргоо → Account →{" "}
          <span className="font-bold text-[#F2F2F4]">Website permissions → Invites</span> — урилгыг зөвшөөр
        </li>
        <li>Дараа нь доорх товчоор дахин холбогд</li>
      </ol>

      <a
        href="/api/admin/threads/auth"
        className="mt-4 inline-flex items-center gap-2 rounded-[4px] bg-[#2E29FF] px-5 py-2.5 text-[12px] font-black text-white transition hover:bg-[#1F1AD9]"
      >
        Threads холбох
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </a>
    </div>
  );
}
