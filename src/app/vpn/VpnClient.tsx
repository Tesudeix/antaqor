"use client";

import { useCallback, useEffect, useState } from "react";

interface Peer {
  publicKey: string;
  label: string;
  address: string;
  lastHandshake: number;
  rx: number;
  tx: number;
}
interface Created {
  publicKey: string;
  address: string;
  label: string;
  config: string;
  qr: string;
}

const ACCENT = "var(--accent-ink, #2E29FF)";

function bytes(n: number): string {
  if (!n) return "0";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}

function since(unix: number): string {
  if (!unix) return "хэзээ ч холбогдоогүй";
  const s = Math.floor(Date.now() / 1000) - unix;
  if (s < 180) return "холбогдсон";
  if (s < 3600) return `${Math.floor(s / 60)} мин өмнө`;
  if (s < 86400) return `${Math.floor(s / 3600)} цаг өмнө`;
  return `${Math.floor(s / 86400)} хоног өмнө`;
}

export default function VpnClient() {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/vpn/peers");
      const d = await r.json();
      if (Array.isArray(d?.peers)) setPeers(d.peers);
    } catch { /* сүлжээ — дараагийн ачаалалт дээр засагдана */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  /* Гар утсаа холбож байхад хуудсыг сэргээх шаардлагагүй байх ёстой —
     handshake ирмэгц жагсаалт дээр өөрөө гарч ирнэ. */
  useEffect(() => {
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const add = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/vpn/peers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d?.error === "subnet_full" ? "Сул IP үлдээгүй байна." : "Төхөөрөмж нэмж чадсангүй."); return; }
      setCreated(d); setLabel(""); load();
    } catch { setErr("Сүлжээний алдаа."); }
    finally { setBusy(false); }
  };

  const remove = async (p: Peer) => {
    if (!confirm(`"${p.label || p.address}" төхөөрөмжийн эрхийг хасах уу? Тэр төхөөрөмж дахин холбогдож чадахгүй болно.`)) return;
    try {
      const r = await fetch("/api/vpn/peers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: p.publicKey }),
      });
      if (!r.ok) { setErr("Хасаж чадсангүй."); return; }
      load();
    } catch { setErr("Сүлжээний алдаа."); }
  };

  const download = (c: Created) => {
    const blob = new Blob([c.config], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `antaqor-vpn-${(c.label || "device").replace(/\s+/g, "-").toLowerCase()}.conf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-24 pt-10">
      <div className="mb-1 text-[11px] tracking-[0.14em]" style={{ color: ACCENT }}>VPN // WIREGUARD</div>
      <h1 className="mb-1 text-[26px] font-semibold text-[#F2F2F4]">Миний төхөөрөмжүүд</h1>
      <p className="mb-8 text-[13px] leading-relaxed text-[#E2E4E8]">
        Төхөөрөмж нэмээд QR-ыг WireGuard аппаараа уншуулна. Утсанд{" "}
        <span className="text-[#F2F2F4]">WireGuard</span> апп (App Store / Google Play) хэрэгтэй.
      </p>

      {/* ─── Төхөөрөмж нэмэх ─── */}
      <div className="mb-8 rounded-[4px] border border-[#1E1E1E] bg-[#0A0A0A] p-4">
        <div className="mb-3 text-[11px] tracking-[0.14em] text-[#E2E4E8]">ШИНЭ ТӨХӨӨРӨМЖ</div>
        <div className="flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="Нэр — жишээ нь: iPhone, Macbook"
            maxLength={40}
            className="h-11 flex-1 rounded-[4px] border border-[#1E1E1E] bg-black px-3 text-[13px] text-[#F2F2F4] outline-none focus:border-[#333333]"
          />
          <button
            onClick={add}
            disabled={busy}
            className="h-11 rounded-[4px] px-5 text-[13px] font-semibold text-white transition disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {busy ? "Үүсгэж байна…" : "Нэмэх"}
          </button>
        </div>
        {err && <div className="mt-3 text-[12px]" style={{ color: ACCENT }}>{err}</div>}
      </div>

      {/* ─── Шинэ тохиргоо — НЭГ Л УДАА харагдана ─── */}
      {created && (
        <div className="mb-8 rounded-[4px] border p-4" style={{ borderColor: ACCENT }}>
          <div className="mb-1 text-[11px] tracking-[0.14em]" style={{ color: ACCENT }}>
            {created.label.toUpperCase()} · {created.address}
          </div>
          <p className="mb-4 text-[12px] leading-relaxed text-[#E2E4E8]">
            Нууц түлхүүр нь <span className="text-[#F2F2F4]">зөвхөн одоо</span> харагдана — сервер дээр
            хадгалагдахгүй. Одоо уншуулж эсвэл татаж авна уу. Алдвал энэ төхөөрөмжийг устгаад шинийг үүсгэнэ.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={created.qr} alt="WireGuard QR" width={280} height={280}
               className="mx-auto mb-4 block rounded-[4px] bg-white p-2" />
          <pre className="mb-3 overflow-x-auto rounded-[4px] border border-[#1E1E1E] bg-black p-3 text-[11px] leading-relaxed text-[#E2E4E8]">
{created.config}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => download(created)}
              className="h-10 rounded-[4px] px-4 text-[12.5px] font-semibold text-white" style={{ background: ACCENT }}>
              .conf татах
            </button>
            <button
              onClick={() => { navigator.clipboard?.writeText(created.config).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
              className="h-10 rounded-[4px] border border-[#1E1E1E] px-4 text-[12.5px] text-[#E2E4E8]">
              {copied ? "Хуулсан" : "Хуулах"}
            </button>
            <button onClick={() => setCreated(null)}
              className="h-10 rounded-[4px] border border-[#1E1E1E] px-4 text-[12.5px] text-[#E2E4E8]">
              Хаах
            </button>
          </div>
        </div>
      )}

      {/* ─── Жагсаалт ─── */}
      <div className="mb-3 text-[11px] tracking-[0.14em] text-[#E2E4E8]">
        ХОЛБОГДСОН ТӨХӨӨРӨМЖ ({peers.length})
      </div>
      {loading ? (
        <div className="text-[13px] text-[#E2E4E8]">Уншиж байна…</div>
      ) : peers.length === 0 ? (
        <div className="rounded-[4px] border border-[#1E1E1E] p-6 text-center text-[13px] text-[#E2E4E8]">
          Одоогоор төхөөрөмж алга. Дээрээс нэмнэ үү.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {peers.map((p) => {
            const live = p.lastHandshake > 0 && Math.floor(Date.now() / 1000) - p.lastHandshake < 180;
            return (
              <div key={p.publicKey}
                   className="flex items-center justify-between gap-3 rounded-[4px] border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
                          style={{ background: live ? "#3FB950" : "#E8EAF2" }} />
                    <span className="truncate text-[13.5px] text-[#F2F2F4]">{p.label || "нэргүй"}</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-[#E2E4E8]">
                    {p.address} · {since(p.lastHandshake)}
                    {(p.rx > 0 || p.tx > 0) && <> · ↓{bytes(p.rx)} ↑{bytes(p.tx)}</>}
                  </div>
                </div>
                <button onClick={() => remove(p)}
                        className="shrink-0 rounded-[4px] border border-[#1E1E1E] px-3 py-1.5 text-[11.5px] text-[#E2E4E8] transition hover:border-[#2E29FF] hover:text-[#2E29FF]">
                  Хасах
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-[11.5px] leading-relaxed text-[#E2E4E8]">
        Энэ хуудсыг зөвхөн админ хардаг. Төхөөрөмж нэмэх бүрд серверийн сүлжээнд
        шинэ гишүүн үүсдэг тул хэрэглэхээ больсон төхөөрөмжийг хасаж байгаарай.
      </p>
    </main>
  );
}
