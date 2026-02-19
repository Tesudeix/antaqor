"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface BankApp {
  name: string;
  description: string;
  logo: string;
  link: string;
}

export default function ClanPage() {
  const { data: session } = useSession();
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [qrImage, setQrImage] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [bankApps, setBankApps] = useState<BankApp[]>([]);
  const [checking, setChecking] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    checkMembership();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session]);

  const checkMembership = async () => {
    try {
      const res = await fetch("/api/clan/status");
      const data = await res.json();
      setIsMember(data.isMember);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!session) return;
    setPaying(true);

    try {
      const res = await fetch("/api/clan/join", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setQrImage(data.qrImage);
        setInvoiceId(data.invoiceId);
        setBankApps(data.urls || []);
        startPolling(data.invoiceId);
      }
    } catch {
      setPaying(false);
    }
  };

  const startPolling = (invId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/clan/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: invId }),
        });
        const data = await res.json();
        if (data.status === "paid") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPaymentSuccess(true);
          setIsMember(true);
        }
      } catch {}
    }, 5000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center bg-[#cc2200]">
          <svg className="h-10 w-10 text-[#ede8df]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mb-3 font-[Bebas_Neue] text-5xl tracking-[4px] text-[#ede8df]">
          Welcome to the Clan
        </h1>
        <p className="mb-8 text-[13px] leading-[2] text-[rgba(240,236,227,0.5)]">
          You are now part of the Digital Nation.
        </p>
        <Link href="/" className="btn-blood">
          Enter the Community
        </Link>
      </div>
    );
  }

  if (isMember) {
    return (
      <div>
        <section className="mb-16 py-16 md:py-24">
          <div className="mb-3 text-[11px] uppercase tracking-[4px] text-[#c8c8c0]">
            Clan · Membership Active
          </div>
          <h1 className="mb-4 font-[Bebas_Neue] text-[clamp(48px,8vw,100px)] leading-[0.9] tracking-[-2px] text-[#ede8df]">
            You&apos;re in the <span className="text-[#cc2200]">Clan</span>
          </h1>
          <p className="mt-6 max-w-lg text-[13px] leading-[2] text-[rgba(240,236,227,0.5)]">
            You have full access to the Digital Nation community. Keep building, keep conquering.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card p-6">
            <div className="mb-3 text-[10px] uppercase tracking-[3px] text-[rgba(240,236,227,0.2)]">01</div>
            <div className="mb-2 font-[Bebas_Neue] text-2xl tracking-[2px] text-[#ede8df]">Community</div>
            <p className="text-[12px] leading-[1.9] text-[rgba(240,236,227,0.5)]">
              Connect with builders, share ideas, and grow together.
            </p>
          </div>
          <div className="card p-6">
            <div className="mb-3 text-[10px] uppercase tracking-[3px] text-[rgba(240,236,227,0.2)]">02</div>
            <div className="mb-2 font-[Bebas_Neue] text-2xl tracking-[2px] text-[#ede8df]">Resources</div>
            <p className="text-[12px] leading-[1.9] text-[rgba(240,236,227,0.5)]">
              Access exclusive content, AI courses, and builder tools.
            </p>
          </div>
          <div className="card p-6">
            <div className="mb-3 text-[10px] uppercase tracking-[3px] text-[rgba(240,236,227,0.2)]">03</div>
            <div className="mb-2 font-[Bebas_Neue] text-2xl tracking-[2px] text-[#cc2200]">Eternal Conquest</div>
            <p className="text-[12px] leading-[1.9] text-[rgba(240,236,227,0.5)]">
              Every peak reveals a higher summit. The mission is eternal.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Clan Hero */}
      <section className="relative mb-16 overflow-hidden py-16 md:py-24">
        <div className="absolute right-[-200px] top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(204,34,0,0.10)_0%,transparent_70%)] pointer-events-none" />

        <div className="animate-fade-up-delay-1 mb-3 text-[11px] uppercase tracking-[4px] text-[#c8c8c0]">
          Clan · Digital Nation
        </div>
        <h1 className="animate-fade-up-delay-2 font-[Bebas_Neue] text-[clamp(48px,8vw,100px)] leading-[0.9] tracking-[-2px]">
          Join the <span className="text-[#cc2200]">Clan</span>
        </h1>
        <p className="animate-fade-up-delay-3 mt-6 max-w-lg text-[13px] leading-[2] text-[rgba(240,236,227,0.5)]">
          Become part of a nation of builders who own AI, shape their tools, and define their future.
          Not defined by borders — but by mindset.
        </p>
      </section>

      {/* Values */}
      <section className="mb-16">
        <div className="section-label">What You Get</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { num: "01", name: "FUTURISM", role: "The Compass", desc: "See what others haven't seen yet. Don't use AI — define it." },
            { num: "02", name: "TIME", role: "The Engine", desc: "Every decision filtered through efficiency. Faster. Leaner. No waste." },
            { num: "03", name: "HYPER ADAPTIVE", role: "The Armor", desc: "Don't adapt to change — anticipate it. Never stop evolving." },
            { num: "04", name: "ETERNAL CONQUEST", role: "The Spirit", desc: "There is no finish line. Every peak reveals a higher summit." },
          ].map((v) => (
            <div key={v.num} className={`card p-6 ${v.num === "04" ? "relative overflow-hidden" : ""}`}>
              {v.num === "04" && (
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(204,34,0,0.06)_0%,transparent_60%)]" />
              )}
              <div className="mb-4 text-[10px] tracking-[3px] text-[rgba(240,236,227,0.2)]">{v.num}</div>
              <div className={`mb-2 font-[Bebas_Neue] text-2xl tracking-[2px] ${v.num === "04" ? "text-[#cc2200]" : "text-[#ede8df]"}`}>
                {v.name}
              </div>
              <div className="mb-3 text-[10px] uppercase tracking-[3px] text-[#c8c8c0]">{v.role}</div>
              <p className="text-[12px] leading-[1.9] text-[rgba(240,236,227,0.5)]">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Price / Join Section */}
      <section className="mb-16">
        <div className="card overflow-hidden">
          <div className="bg-[#cc2200] px-6 py-8 md:px-10">
            <div className="mb-2 text-[10px] uppercase tracking-[5px] text-[rgba(5,5,5,0.4)]">
              Membership
            </div>
            <div className="font-[Bebas_Neue] text-[clamp(36px,5vw,60px)] leading-[1] text-[#030303]">
              ₮29,900<span className="ml-2 text-[20px] text-[rgba(5,5,5,0.4)]">/сар</span>
            </div>
          </div>

          <div className="p-6 md:p-10">
            {!session ? (
              <div>
                <p className="mb-6 text-[13px] leading-[2] text-[rgba(240,236,227,0.5)]">
                  Sign in to join the Clan and become part of the Digital Nation.
                </p>
                <Link href="/auth/signin" className="btn-blood">
                  Sign In to Join
                </Link>
              </div>
            ) : qrImage ? (
              <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
                <div className="flex flex-col items-center">
                  <img
                    src={`data:image/png;base64,${qrImage}`}
                    alt="QPay QR Code"
                    className="h-56 w-56 bg-white p-3"
                  />
                  <p className="mt-3 text-[10px] uppercase tracking-[3px] text-[#5a5550]">
                    Scan with bank app
                  </p>
                </div>

                <div className="flex-1">
                  <p className="mb-4 text-[13px] leading-[2] text-[rgba(240,236,227,0.5)]">
                    Scan the QR code with your banking app, or tap a bank below to pay directly.
                  </p>

                  {bankApps.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {bankApps.map((app, i) => (
                        <a
                          key={i}
                          href={app.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center gap-1 rounded p-2 transition hover:bg-[rgba(240,236,227,0.03)]"
                          title={app.description}
                        >
                          <img src={app.logo} alt={app.name} className="h-10 w-10 rounded" />
                          <span className="text-[8px] text-[#5a5550] line-clamp-1">{app.name}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 flex items-center gap-3">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-[#cc2200]" />
                    <span className="text-[11px] tracking-[2px] text-[#5a5550]">
                      WAITING FOR PAYMENT...
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <ul className="mb-8 space-y-3 text-[12px] leading-[2] text-[rgba(240,236,227,0.6)]">
                  <li className="flex items-center gap-3">
                    <span className="text-[#cc2200]">→</span> Full community access
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#cc2200]">→</span> Exclusive AI courses &amp; resources
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#cc2200]">→</span> Builder network connections
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#cc2200]">→</span> Direct mentorship access
                  </li>
                </ul>
                <button
                  onClick={handleJoin}
                  disabled={paying}
                  className="btn-blood"
                >
                  {paying ? "Creating invoice..." : "Join the Clan — ₮29,900"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Manifesto */}
      <section className="mb-16 overflow-hidden bg-[#cc2200] p-8 md:p-16">
        <div className="font-[Bebas_Neue] text-[clamp(28px,4vw,56px)] leading-[1.3] tracking-[3px] text-[#030303]">
          <span className="text-[rgba(5,5,5,0.4)]">The future doesn&apos;t wait.</span><br />
          Neither do we.<br /><br />
          <span className="text-[rgba(5,5,5,0.4)]">We build. We teach. We adapt.</span><br />
          For a nation that<br />doesn&apos;t exist yet —<br />but will.
        </div>
        <div className="mt-8 font-[Bebas_Neue] text-[clamp(40px,6vw,80px)] leading-[1] tracking-[6px] text-[#030303]">
          Be Wild.<br />Conquer<br />the Future.
        </div>
      </section>
    </div>
  );
}
