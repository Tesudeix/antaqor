"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function VpnPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [config, setConfig] = useState<string | null>(null);
  const [clientIp, setClientIp] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (session) fetchExisting();
    else setLoading(false);
  }, [session]);

  useEffect(() => {
    if (config && showQr && canvasRef.current) {
      renderQR(config, canvasRef.current);
    }
  }, [config, showQr]);

  const fetchExisting = async () => {
    try {
      const res = await fetch("/api/vpn/generate");
      const data = await res.json();
      if (data.hasPeer) {
        setConfig(data.config);
        setClientIp(data.clientIp);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/vpn/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "device" }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfig(data.config);
        setClientIp(data.clientIp);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm("VPN холболтоо устгах уу?")) return;
    setRevoking(true);
    try {
      const res = await fetch("/api/vpn/generate", { method: "DELETE" });
      if (res.ok) {
        setConfig(null);
        setClientIp("");
        setShowQr(false);
      }
    } finally {
      setRevoking(false);
    }
  };

  const downloadConfig = () => {
    if (!config) return;
    const blob = new Blob([config], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "antaqor-vpn.conf";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyConfig = () => {
    if (!config) return;
    navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-[2px] w-8 animate-pulse bg-[#006491]" />
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative py-20 md:py-28">
        <div className="absolute right-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 translate-x-1/3 bg-[radial-gradient(circle,rgba(0,100,145,0.08)_0%,transparent_70%)] pointer-events-none" />

        <div className="mb-4 text-[10px] uppercase tracking-[3px] text-[#5a5550]">
          Хамгаалалтын давхарга
        </div>
        <h1 className="text-[clamp(48px,9vw,120px)] leading-[0.85] tracking-[-2px]">
          <span className="text-[#006491]">VPN</span><br />
          <span className="text-[#ede8df]">Холболт</span>
        </h1>
        <p className="mt-8 max-w-lg text-[14px] leading-[2] text-[rgba(240,236,227,0.45)]">
          Нэг товч дарахад хангалттай. Таны интернет холболтыг шифрлэж,
          хувийн мэдээллийг хамгаална. WireGuard протокол — хурдан, аюулгүй.
        </p>
      </section>

      {/* Features */}
      <section className="mb-16 grid gap-[1px] bg-[#1c1c1c] sm:grid-cols-3">
        {[
          { num: "01", name: "ШИФРЛЭЛТ", desc: "256-bit шифрлэлт. Таны өгөгдөл бүрэн хамгаалагдсан." },
          { num: "02", name: "ХУРД", desc: "WireGuard протокол — хамгийн хурдан VPN технологи." },
          { num: "03", name: "НЭГ ТОВЧ", desc: "Тохиргоо татаж, WireGuard апп-д нэмэхэд л хангалттай." },
        ].map((v) => (
          <div key={v.num} className="bg-[#0a0a0a] p-8">
            <div className="mb-6 text-[10px] tracking-[1px] text-[rgba(240,236,227,0.15)]">{v.num}</div>
            <div className="mb-3 text-xl tracking-[2px] text-[#ede8df]">{v.name}</div>
            <p className="text-[12px] leading-[1.9] text-[rgba(240,236,227,0.4)]">{v.desc}</p>
          </div>
        ))}
      </section>

      {/* Main Card */}
      <section className="mb-20">
        <div className="border border-[#1c1c1c]">
          {/* Header */}
          <div className="border-b border-[#1c1c1c] bg-[#006491] px-8 py-8 md:px-12">
            <div className="flex items-center gap-4">
              <svg className="h-8 w-8 text-[#030303]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <div className="text-2xl tracking-[2px] text-[#030303]">ANTAQOR VPN</div>
                <div className="text-[11px] text-[rgba(3,3,3,0.5)]">WireGuard · Шифрлэгдсэн холболт</div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-[#0f0f0f] p-8 md:p-12">
            {!session ? (
              <div>
                <p className="mb-6 max-w-md text-[13px] leading-[2] text-[rgba(240,236,227,0.45)]">
                  VPN үйлчилгээ ашиглахын тулд эхлээд нэвтэрнэ үү.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/auth/signin" className="btn-blood">Нэвтрэх</Link>
                  <Link href="/auth/signup" className="btn-ghost">Бүртгүүлэх</Link>
                </div>
              </div>
            ) : !config ? (
              <div>
                <p className="mb-6 max-w-md text-[13px] leading-[2] text-[rgba(240,236,227,0.45)]">
                  VPN тохиргоогоо үүсгээд WireGuard апп-д нэмнэ үү. Автоматаар таны хувийн тохиргоо үүснэ.
                </p>
                <button onClick={handleGenerate} disabled={generating} className="btn-blood">
                  {generating ? (
                    <span className="flex items-center gap-3">
                      <span className="h-3 w-3 animate-spin border border-current border-t-transparent" />
                      Үүсгэж байна...
                    </span>
                  ) : (
                    "VPN идэвхжүүлэх"
                  )}
                </button>
              </div>
            ) : (
              <div>
                {/* Status */}
                <div className="mb-8 flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  <span className="text-[11px] uppercase tracking-[2px] text-green-500">Идэвхтэй</span>
                  <span className="text-[11px] text-[#5a5550]">· {clientIp}</span>
                </div>

                {/* Config display */}
                <div className="relative mb-6 overflow-hidden border border-[#1c1c1c] bg-[#0a0a0a]">
                  <div className="flex items-center justify-between border-b border-[#1c1c1c] px-4 py-2">
                    <span className="text-[9px] uppercase tracking-[2px] text-[#5a5550]">
                      antaqor-vpn.conf
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={copyConfig}
                        className="px-3 py-1 text-[10px] tracking-[1px] text-[#5a5550] transition hover:text-[#ede8df]"
                      >
                        {copied ? "ХУУЛСАН" : "ХУУЛАХ"}
                      </button>
                    </div>
                  </div>
                  <pre className="overflow-x-auto p-4 text-[12px] leading-[1.8] text-[rgba(240,236,227,0.7)]">
                    {config}
                  </pre>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                  <button onClick={downloadConfig} className="btn-blood">
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      .conf татах
                    </span>
                  </button>

                  <button
                    onClick={() => setShowQr(!showQr)}
                    className="btn-ghost"
                  >
                    {showQr ? "QR нуух" : "QR код харах"}
                  </button>

                  <button
                    onClick={handleRevoke}
                    disabled={revoking}
                    className="ml-auto text-[11px] tracking-[1px] text-[#5a5550] transition hover:text-red-500"
                  >
                    {revoking ? "Устгаж байна..." : "Устгах"}
                  </button>
                </div>

                {/* QR Code */}
                {showQr && (
                  <div className="mt-8 flex flex-col items-center">
                    <div className="border border-[#1c1c1c] bg-white p-4">
                      <canvas ref={canvasRef} className="h-[250px] w-[250px]" />
                    </div>
                    <p className="mt-3 text-[9px] uppercase tracking-[2px] text-[#5a5550]">
                      WireGuard апп-аар уншуулна уу
                    </p>
                  </div>
                )}

                {/* Instructions */}
                <div className="mt-10 border-t border-[#1c1c1c] pt-8">
                  <div className="mb-6 text-[10px] uppercase tracking-[3px] text-[#5a5550]">
                    Хэрхэн холбогдох
                  </div>
                  <div className="grid gap-[1px] bg-[#1c1c1c] sm:grid-cols-3">
                    {[
                      {
                        step: "01",
                        title: "Апп татах",
                        desc: "WireGuard апп-г App Store, Google Play, эсвэл wireguard.com-оос татна уу.",
                      },
                      {
                        step: "02",
                        title: "Тохиргоо нэмэх",
                        desc: "\"Тохиргоо нэмэх\" товч дарж .conf файлаа сонгох, эсвэл QR код уншуулна уу.",
                      },
                      {
                        step: "03",
                        title: "Холбогдох",
                        desc: "Тохиргоог идэвхжүүлэхэд л таны холболт шифрлэгдэнэ. Дууссан!",
                      },
                    ].map((s) => (
                      <div key={s.step} className="bg-[#0a0a0a] p-6">
                        <div className="mb-4 text-[10px] tracking-[1px] text-[rgba(240,236,227,0.15)]">
                          {s.step}
                        </div>
                        <div className="mb-2 text-[14px] tracking-[1px] text-[#ede8df]">{s.title}</div>
                        <p className="text-[11px] leading-[1.8] text-[rgba(240,236,227,0.4)]">{s.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// Minimal QR code renderer (no external dependency)
function renderQR(text: string, canvas: HTMLCanvasElement) {
  // Use the QR API to generate and draw
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 250;
    canvas.height = 250;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 250, 250);
    ctx.drawImage(img, 0, 0, 250, 250);
  };
  // Use a public QR generation API
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(text)}`;
}
