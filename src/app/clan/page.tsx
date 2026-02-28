"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

const CLAN_PRICE = "25,000";
const BANK_ACCOUNT = "5926153085";
const BANK_NAME = "Хаан банк";
const BANK_RECIPIENT = "Баянбилэг Дамбадаржаа";

export default function ClanPage() {
  const { data: session } = useSession();
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    checkMembership();
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
    setSubmitting(true);
    try {
      const res = await fetch("/api/clan/join", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setUserEmail(data.email || session.user?.email || "");
        setShowPayment(true);
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPayment = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/clan/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId: userEmail }),
      });
      const data = await res.json();
      if (data.status === "submitted" || data.status === "paid") {
        setPaymentSubmitted(true);
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-[2px] w-8 animate-pulse bg-[#cc2200]" />
      </div>
    );
  }

  // Payment confirmed
  if (paymentSubmitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-8 flex h-16 w-16 items-center justify-center border border-[#cc2200]">
          <svg className="h-8 w-8 text-[#cc2200]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mb-4 font-[Bebas_Neue] text-5xl tracking-[4px] text-[#ede8df]">
          ХҮЛЭЭН АВЛАА
        </h1>
        <p className="mb-3 max-w-md text-[13px] leading-[2] text-[rgba(240,236,227,0.5)]">
          Таны төлбөр баталгаажуулалт хүлээгдэж байна.
        </p>
        <div className="mb-8 border border-[#1c1c1c] bg-[#0a0a0a] px-6 py-3">
          <div className="text-[9px] uppercase tracking-[2px] text-[#5a5550]">Гүйлгээний утга</div>
          <div className="mt-1 text-[14px] font-medium tracking-wide text-[#cc2200]">{userEmail}</div>
        </div>
        <p className="mb-10 max-w-sm text-[11px] leading-[1.8] text-[rgba(240,236,227,0.3)]">
          Ихэвчлэн 24 цагийн дотор шалгагдана. Баталгаажсаны дараа таны гишүүнчлэл идэвхжинэ.
        </p>
        <Link href="/" className="btn-blood">
          Нүүр хуудас
        </Link>
      </div>
    );
  }

  // Already a member
  if (isMember) {
    return (
      <div>
        <section className="py-20 md:py-28">
          <div className="mb-4 text-[10px] uppercase tracking-[3px] text-[#cc2200]">
            Гишүүнчлэл идэвхтэй
          </div>
          <h1 className="font-[Bebas_Neue] text-[clamp(56px,10vw,120px)] leading-[0.85] tracking-[-2px] text-[#ede8df]">
            Та <span className="text-[#cc2200]">Кланд</span><br />байна
          </h1>
          <p className="mt-8 max-w-md text-[13px] leading-[2] text-[rgba(240,236,227,0.4)]">
            Дижитал Үндэстний бүрэн гишүүн. Бүтээж, суралцаж, байлдан дагуулж байгаарай.
          </p>
        </section>

        <div className="grid gap-[1px] bg-[#1c1c1c] sm:grid-cols-3">
          {[
            { label: "Нийгэмлэг", desc: "Бүтээгчидтэй холбогдож, санаа хуваалцаж, хамтдаа өсөж хөгж." },
            { label: "AI Хичээл", desc: "Тусгай контент, AI хичээлүүд, бүтээгчийн хэрэгслүүдэд хандах." },
            { label: "Менторшип", desc: "Шууд менторшип, Q&A, бүтээлч feedback авах боломж." },
          ].map((item) => (
            <div key={item.label} className="bg-[#0a0a0a] p-8">
              <div className="mb-3 font-[Bebas_Neue] text-xl tracking-[2px] text-[#ede8df]">{item.label}</div>
              <p className="text-[12px] leading-[1.9] text-[rgba(240,236,227,0.4)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Not a member — main page
  return (
    <div>
      {/* Hero */}
      <section className="relative py-20 md:py-32">
        <div className="absolute right-0 top-1/2 h-[600px] w-[600px] -translate-y-1/2 translate-x-1/3 bg-[radial-gradient(circle,rgba(204,34,0,0.06)_0%,transparent_70%)] pointer-events-none" />

        <div className="mb-4 text-[10px] uppercase tracking-[3px] text-[#5a5550]">
          Дижитал Үндэстэн
        </div>
        <h1 className="font-[Bebas_Neue] text-[clamp(56px,10vw,140px)] leading-[0.85] tracking-[-2px]">
          <span className="text-[#cc2200]">Кланд</span><br />нэгдэх
        </h1>
        <p className="mt-8 max-w-lg text-[14px] leading-[2] text-[rgba(240,236,227,0.45)]">
          AI-г эзэмшиж, хэрэгслээ бүтээж, ирээдүйгээ тодорхойлдог бүтээгчдийн
          үндэстний нэг хэсэг бол. Хилээр бус — сэтгэлгээгээр тодорхойлогдоно.
        </p>
      </section>

      {/* Values */}
      <section className="mb-20 grid gap-[1px] bg-[#1c1c1c] sm:grid-cols-2 lg:grid-cols-4">
        {[
          { num: "01", name: "ФУТУРИЗМ", desc: "Бусдын хараагүйг хар. AI-г ашиглахгүй — тодорхойл." },
          { num: "02", name: "ЦАГ ХУГАЦАА", desc: "Шийдвэр бүр үр ашгаар шүүгдэнэ. Илүү хурдан." },
          { num: "03", name: "ДАСАН ЗОХИЦОЛ", desc: "Өөрчлөлтөд дасахгүй — урьдчил. Хөгжихөө бүү зогсоо." },
          { num: "04", name: "БАЙЛДАН ДАГУУЛАЛТ", desc: "Финиш шугам гэж байхгүй. Эрхэм зорилго мөнхийн." },
        ].map((v) => (
          <div key={v.num} className="bg-[#0a0a0a] p-8">
            <div className="mb-6 text-[10px] tracking-[1px] text-[rgba(240,236,227,0.15)]">{v.num}</div>
            <div className={`mb-3 font-[Bebas_Neue] text-xl tracking-[2px] ${v.num === "04" ? "text-[#cc2200]" : "text-[#ede8df]"}`}>
              {v.name}
            </div>
            <p className="text-[12px] leading-[1.9] text-[rgba(240,236,227,0.4)]">{v.desc}</p>
          </div>
        ))}
      </section>

      {/* Pricing */}
      <section className="mb-20">
        <div className="border border-[#1c1c1c]">
          {/* Price header */}
          <div className="border-b border-[#1c1c1c] bg-[#cc2200] px-8 py-10 md:px-12">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-1 text-[9px] uppercase tracking-[3px] text-[rgba(3,3,3,0.5)]">
                  Сарын гишүүнчлэл
                </div>
                <div className="font-[Bebas_Neue] text-[clamp(48px,6vw,72px)] leading-[0.9] text-[#030303]">
                  ₮{CLAN_PRICE}
                </div>
              </div>
              <div className="text-[11px] leading-[1.8] text-[rgba(3,3,3,0.5)] md:text-right">
                Сар бүр · Цуцлах боломжтой<br />
                Бүх контент, хичээл, нийгэмлэг
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="grid gap-[1px] bg-[#1c1c1c] sm:grid-cols-2">
            {[
              "Нийгэмлэгт бүрэн хандалт",
              "AI хичээлүүд & нөөцүүд",
              "Бүтээгчдийн сүлжээ",
              "Шууд менторшип",
              "Тусгай контент",
              "Эрт хандалт — шинэ боломжууд",
            ].map((b) => (
              <div key={b} className="flex items-center gap-4 bg-[#0a0a0a] px-8 py-5">
                <div className="h-[1px] w-4 bg-[#cc2200]" />
                <span className="text-[12px] text-[rgba(240,236,227,0.6)]">{b}</span>
              </div>
            ))}
          </div>

          {/* Action area */}
          <div className="bg-[#0f0f0f] p-8 md:p-12">
            {!session ? (
              /* Not logged in — pre-order CTA */
              <div>
                <div className="mb-6">
                  <div className="mb-2 font-[Bebas_Neue] text-2xl tracking-[2px] text-[#ede8df]">
                    УРЬДЧИЛЖ БҮРТГҮҮЛЭХ
                  </div>
                  <p className="max-w-md text-[12px] leading-[1.9] text-[rgba(240,236,227,0.4)]">
                    Бүртгүүлж, кланд нэгдэхэд бэлэн болоорой. Бүртгэлтэй бол нэвтэрч шууд төлбөрөө хийнэ үү.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/auth/signup" className="btn-blood">
                    Бүртгүүлж нэгдэх
                  </Link>
                  <Link href="/auth/signin" className="btn-ghost">
                    Нэвтрэх
                  </Link>
                </div>
              </div>
            ) : showPayment ? (
              /* Payment flow */
              <div>
                <div className="mb-8 flex items-center gap-3">
                  <div className="h-[1px] w-6 bg-[#cc2200]" />
                  <span className="text-[10px] uppercase tracking-[3px] text-[#cc2200]">Төлбөр</span>
                </div>

                <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
                  {/* QR */}
                  <div className="flex flex-col items-center">
                    <div className="border border-[#1c1c1c] bg-white p-3">
                      <Image
                        src="/qpay.png"
                        alt="QPay QR"
                        width={200}
                        height={200}
                        className="h-[200px] w-[200px] object-contain"
                      />
                    </div>
                    <p className="mt-3 text-[9px] uppercase tracking-[2px] text-[#5a5550]">
                      Банкны апп-аар уншуулах
                    </p>
                  </div>

                  {/* Transfer details */}
                  <div className="flex-1 space-y-[1px] bg-[#1c1c1c]">
                    {/* Bank */}
                    <div className="flex items-center justify-between bg-[#0a0a0a] px-5 py-4">
                      <div>
                        <div className="text-[9px] uppercase tracking-[2px] text-[#5a5550]">Банк</div>
                        <div className="mt-1 text-[15px] font-semibold tracking-wide text-[#ede8df]">{BANK_NAME}</div>
                      </div>
                      <CopyBtn text={BANK_NAME} field="bank" copied={copied} onCopy={copyToClipboard} />
                    </div>

                    {/* Account */}
                    <div className="flex items-center justify-between bg-[#0a0a0a] px-5 py-4">
                      <div>
                        <div className="text-[9px] uppercase tracking-[2px] text-[#5a5550]">Данс</div>
                        <div className="mt-1 font-[Bebas_Neue] text-[22px] tracking-[3px] text-[#ede8df]">{BANK_ACCOUNT}</div>
                      </div>
                      <CopyBtn text={BANK_ACCOUNT} field="account" copied={copied} onCopy={copyToClipboard} />
                    </div>

                    {/* Recipient */}
                    <div className="flex items-center justify-between bg-[#0a0a0a] px-5 py-4">
                      <div>
                        <div className="text-[9px] uppercase tracking-[2px] text-[#5a5550]">Хүлээн авагч</div>
                        <div className="mt-1 text-[15px] font-semibold tracking-wide text-[#ede8df]">{BANK_RECIPIENT}</div>
                      </div>
                      <CopyBtn text={BANK_RECIPIENT} field="recipient" copied={copied} onCopy={copyToClipboard} />
                    </div>

                    {/* Amount */}
                    <div className="flex items-center justify-between bg-[#0a0a0a] px-5 py-4">
                      <div>
                        <div className="text-[9px] uppercase tracking-[2px] text-[#5a5550]">Дүн</div>
                        <div className="mt-1 font-[Bebas_Neue] text-[22px] tracking-[3px] text-[#ede8df]">{CLAN_PRICE}₮</div>
                      </div>
                      <CopyBtn text="25000" field="amount" copied={copied} onCopy={copyToClipboard} />
                    </div>

                    {/* Reference — email */}
                    <div className="flex items-center justify-between bg-[rgba(204,34,0,0.04)] px-5 py-5 border-l-2 border-[#cc2200]">
                      <div>
                        <div className="text-[9px] uppercase tracking-[2px] text-[#cc2200]">
                          Гүйлгээний утга
                        </div>
                        <div className="mt-1 text-[15px] font-bold tracking-wide text-[#cc2200]">
                          {userEmail}
                        </div>
                      </div>
                      <CopyBtn text={userEmail} field="ref" copied={copied} onCopy={copyToClipboard} accent />
                    </div>
                  </div>
                </div>

                {/* Instruction */}
                <div className="mt-8 border-l-2 border-[rgba(240,236,227,0.06)] pl-5">
                  <p className="text-[12px] leading-[2] text-[rgba(240,236,227,0.35)]">
                    Дээрх дансанд төлбөрөө шилжүүлж, гүйлгээний утга дээр{" "}
                    <strong className="text-[#cc2200]">{userEmail}</strong>{" "}
                    имэйлээ бичнэ үү. Мөн банкны аппликейшнээр QR код уншуулж болно.
                  </p>
                </div>

                <button
                  onClick={handleConfirmPayment}
                  disabled={submitting}
                  className="btn-blood mt-8"
                >
                  {submitting ? (
                    <span className="flex items-center gap-3">
                      <span className="h-3 w-3 animate-spin border border-current border-t-transparent" />
                      Шалгаж байна...
                    </span>
                  ) : (
                    "Төлбөр шилжүүлсэн"
                  )}
                </button>
              </div>
            ) : (
              /* Join CTA */
              <div>
                <div className="mb-6">
                  <div className="mb-2 text-[11px] text-[rgba(240,236,227,0.5)]">
                    {session.user?.email}
                  </div>
                  <p className="max-w-md text-[12px] leading-[1.9] text-[rgba(240,236,227,0.35)]">
                    Кланд нэгдсэнээр бүх контент, хичээл, нийгэмлэгт бүрэн хандалт авна.
                  </p>
                </div>
                <button onClick={handleJoin} disabled={submitting} className="btn-blood">
                  {submitting ? (
                    <span className="flex items-center gap-3">
                      <span className="h-3 w-3 animate-spin border border-current border-t-transparent" />
                      Уншиж байна...
                    </span>
                  ) : (
                    `Нэгдэх — ₮${CLAN_PRICE}/сар`
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="mb-20 bg-[#cc2200]">
        <div className="px-8 py-16 md:px-16 md:py-24">
          <div className="font-[Bebas_Neue] text-[clamp(32px,5vw,64px)] leading-[1.2] tracking-[2px] text-[#030303]">
            <span className="text-[rgba(3,3,3,0.35)]">Ирээдүй хүлээхгүй.</span><br />
            Бид ч мөн адил.
          </div>
          <div className="mt-12 font-[Bebas_Neue] text-[clamp(48px,8vw,100px)] leading-[0.9] tracking-[4px] text-[#030303]">
            Be Wild.<br />Conquer<br />the Future.
          </div>
          {!session && (
            <div className="mt-12">
              <Link
                href="/auth/signup"
                className="inline-block border-2 border-[#030303] bg-[#030303] px-10 py-4 font-[Bebas_Neue] text-lg tracking-[3px] text-[#ede8df] transition hover:bg-transparent hover:text-[#030303]"
              >
                Одоо нэгдэх
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CopyBtn({
  text,
  field,
  copied,
  onCopy,
  accent,
}: {
  text: string;
  field: string;
  copied: string | null;
  onCopy: (text: string, field: string) => void;
  accent?: boolean;
}) {
  const done = copied === field;
  return (
    <button
      onClick={() => onCopy(text, field)}
      className={`flex h-8 w-8 shrink-0 items-center justify-center transition ${
        accent
          ? "text-[#cc2200]/60 hover:text-[#cc2200]"
          : "text-[#5a5550] hover:text-[#ede8df]"
      }`}
    >
      {done ? (
        <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}
