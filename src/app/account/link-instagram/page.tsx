"use client";

import { useEffect, useState } from "react";

interface LinkState {
  linked: boolean;
  code: string | null;
  expiresAt: string | null;
  metaInstagramId: string | null;
  metaMessengerPsid: string | null;
}

const PAGE_USERNAME = "antaqor"; // visible Instagram handle to DM

export default function LinkInstagramPage() {
  const [state, setState] = useState<LinkState | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/users/me/meta-link-code", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setState(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    setErr(null);
    try {
      const r = await fetch("/api/users/me/meta-link-code", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setState((prev) => ({
        linked: prev?.linked || false,
        code: d.code,
        expiresAt: d.expiresAt,
        metaInstagramId: prev?.metaInstagramId || null,
        metaMessengerPsid: prev?.metaMessengerPsid || null,
      }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  async function unlink() {
    if (!confirm("Instagram холболтыг таслах уу?")) return;
    const r = await fetch("/api/users/me/meta-link-code", { method: "DELETE" });
    if (r.ok) await load();
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const secondsLeft = state?.expiresAt
    ? Math.max(0, Math.floor((new Date(state.expiresAt).getTime() - now) / 1000))
    : 0;
  const codeActive = state?.code && secondsLeft > 0;

  if (loading) {
    return <div className="p-8 text-[12px] text-[#E2E4E8]">Уншиж байна…</div>;
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#2E29FF]">
        Account
      </div>
      <h1 className="mt-1 text-[24px] font-bold text-[#0e1726]">Instagram холболт</h1>
      <p className="mt-2 text-[13px] text-[#E2E4E8]">
        Instagram DM-р статус, кредит, гишүүнчлэлээ шалгаж болно. Холболтын код авч @{PAGE_USERNAME} рүү
        илгээ.
      </p>

      {err && (
        <div className="mt-4 rounded-[4px] border border-[rgba(46,41,255,0.3)] bg-[rgba(46,41,255,0.1)] p-3 text-[12px] text-[#2E29FF]">
          {err}
        </div>
      )}

      {state?.linked ? (
        <div className="mt-6 rounded-[4px] border border-[rgba(35,180,80,0.3)] bg-[rgba(35,180,80,0.08)] p-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#23B450]">
            ✓ Холбогдсон
          </div>
          <p className="mt-2 text-[13px] text-[#0e1726]">
            Таны Antaqor бүртгэл Instagram-тай холбогдсон. DM-р статусаа шалгахдаа: «статус» эсвэл «кредит» гэж бичээрэй.
          </p>
          {state.metaInstagramId && (
            <p className="mt-2 text-[10px] text-[#E2E4E8] font-mono">
              IG ID: {state.metaInstagramId}
            </p>
          )}
          <button
            onClick={unlink}
            className="mt-4 rounded-[4px] bg-[#F2F2F4] px-4 py-2 text-[11px] font-bold text-[#E2E4E8] hover:bg-[#e2e8ef]"
          >
            Холболт тасрах
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#ffffff] p-6">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#E2E4E8]">
              Алхам 1 — Код авах
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              {codeActive ? (
                <div>
                  <div className="font-mono text-[22px] md:text-[36px] font-bold tracking-[0.2em] text-[#2E29FF]">
                    {state?.code}
                  </div>
                  <div className="mt-1 text-[10px] text-[#E2E4E8]">
                    Хүчинтэй: {Math.floor(secondsLeft / 60)}:
                    {String(secondsLeft % 60).padStart(2, "0")}
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-[#E2E4E8]">Шинэ код үүсгэнэ үү</div>
              )}
              <button
                onClick={generate}
                className="rounded-[4px] bg-[#2E29FF] px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-[#1F1AD9]"
              >
                {codeActive ? "Шинэчлэх" : "Код авах"}
              </button>
            </div>
          </div>

          <div className="rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#ffffff] p-6">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#E2E4E8]">
              Алхам 2 — DM илгээх
            </div>
            <p className="mt-3 text-[13px] text-[#0e1726]">
              Instagram дээр{" "}
              <a
                href={`https://ig.me/m/${PAGE_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#2E29FF] hover:underline"
              >
                @{PAGE_USERNAME}
              </a>{" "}
              руу очиж дараах мессежийг илгээ:
            </p>
            <div className="mt-3 rounded-[4px] bg-[#eef2f6] p-3 font-mono text-[13px] text-[#0e1726]">
              холбох {codeActive ? state?.code : "______"}
            </div>
            <p className="mt-2 text-[11px] text-[#E2E4E8]">
              Эсвэл зүгээр 6 оронтой кодоо илгээ.
            </p>
          </div>

          <div className="rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#ffffff] p-6">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#E2E4E8]">
              Алхам 3 — Холбогдсоны дараа
            </div>
            <p className="mt-3 text-[13px] text-[#0e1726]">
              Холбогдсоны дараа DM-р дараах командууд ажиллана:
            </p>
            <ul className="mt-3 space-y-1.5 text-[12px] text-[#475569]">
              <li>
                <code className="rounded-[4px] bg-[#eef2f6] px-1.5 py-0.5 text-[#2E29FF]">статус</code>{" "}
                — миний бүртгэлийн товч мэдээ
              </li>
              <li>
                <code className="rounded-[4px] bg-[#eef2f6] px-1.5 py-0.5 text-[#2E29FF]">гишүүнчлэл</code>{" "}
                — захиалгын хугацаа
              </li>
              <li>
                <code className="rounded-[4px] bg-[#eef2f6] px-1.5 py-0.5 text-[#2E29FF]">кредит</code>{" "}
                — кредитийн үлдэгдэл
              </li>
              <li>
                <code className="rounded-[4px] bg-[#eef2f6] px-1.5 py-0.5 text-[#2E29FF]">тусламж</code>{" "}
                — бүх команд
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
