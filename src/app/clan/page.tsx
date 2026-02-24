"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

const CLAN_PRICE = "25,000";
const BANK_ACCOUNT = "5926153085";
const BANK_RECIPIENT = "Баянбилэг Дамбадаржаа";

export default function ClanPage() {
  const { data: session } = useSession();
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [referenceId, setReferenceId] = useState("");
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
        setReferenceId(data.referenceId);
        setShowPayment(true);
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!referenceId) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/clan/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId }),
      });
      const data = await res.json();
      if (data.status === "submitted") {
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
      <div className="flex justify-center py-16">
        <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
      </div>
    );
  }

  if (paymentSubmitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center bg-[#cc2200]">
          <svg className="h-10 w-10 text-[#ede8df]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mb-3 font-[Bebas_Neue] text-5xl tracking-[2px] text-[#ede8df]">
          Төлбөр хүлээн авлаа
        </h1>
        <p className="mb-4 max-w-md text-[13px] leading-[2] text-[rgba(240,236,227,0.5)]">
          Таны төлбөр баталгаажуулалт хүлээгдэж байна. Гүйлгээний утга:
        </p>
        <div className="mb-8 font-[Bebas_Neue] text-2xl tracking-[2px] text-[#cc2200]">
          {referenceId}
        </div>
        <p className="mb-8 max-w-md text-[12px] leading-[2] text-[rgba(240,236,227,0.35)]">
          Төлбөр баталгаажсаны дараа таны гишүүнчлэл идэвхжинэ. Ихэвчлэн 24 цагийн дотор шалгагдана.
        </p>
        <Link href="/" className="btn-blood">
          Нүүр хуудас руу буцах
        </Link>
      </div>
    );
  }

  if (isMember) {
    return (
      <div>
        <section className="mb-16 py-16 md:py-24">
          <div className="mb-3 text-[11px] uppercase tracking-[1px] text-[#c8c8c0]">
            Клан · Гишүүнчлэл идэвхтэй
          </div>
          <h1 className="mb-4 font-[Bebas_Neue] text-[clamp(48px,8vw,100px)] leading-[0.9] tracking-[-2px] text-[#ede8df]">
            Та <span className="text-[#cc2200]">Кланд</span> байна
          </h1>
          <p className="mt-6 max-w-lg text-[13px] leading-[2] text-[rgba(240,236,227,0.5)]">
            Та Дижитал Үндэстний нийгэмлэгт бүрэн хандалттай. Бүтээж, байлдан дагуулж байгаарай.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card p-6">
            <div className="mb-3 text-[10px] uppercase tracking-[0.5px] text-[rgba(240,236,227,0.2)]">01</div>
            <div className="mb-2 font-[Bebas_Neue] text-2xl tracking-[2px] text-[#ede8df]">Нийгэмлэг</div>
            <p className="text-[12px] leading-[1.9] text-[rgba(240,236,227,0.5)]">
              Бүтээгчидтэй холбогдож, санаа хуваалцаж, хамтдаа өсөж хөгж.
            </p>
          </div>
          <div className="card p-6">
            <div className="mb-3 text-[10px] uppercase tracking-[0.5px] text-[rgba(240,236,227,0.2)]">02</div>
            <div className="mb-2 font-[Bebas_Neue] text-2xl tracking-[2px] text-[#ede8df]">Нөөц</div>
            <p className="text-[12px] leading-[1.9] text-[rgba(240,236,227,0.5)]">
              Тусгай контент, AI хичээлүүд, бүтээгчийн хэрэгслүүдэд хандах.
            </p>
          </div>
          <div className="card p-6">
            <div className="mb-3 text-[10px] uppercase tracking-[0.5px] text-[rgba(240,236,227,0.2)]">03</div>
            <div className="mb-2 font-[Bebas_Neue] text-2xl tracking-[2px] text-[#cc2200]">Мөнхийн байлдан дагуулалт</div>
            <p className="text-[12px] leading-[1.9] text-[rgba(240,236,227,0.5)]">
              Оргил бүр дараагийн өндөрлөгийг харуулна. Эрхэм зорилго мөнхийн.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <section className="relative mb-16 overflow-hidden py-16 md:py-24">
        <div className="absolute right-[-200px] top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(204,34,0,0.10)_0%,transparent_70%)] pointer-events-none" />

        <div className="animate-fade-up-delay-1 mb-3 text-[11px] uppercase tracking-[1px] text-[#c8c8c0]">
          Клан · Дижитал Үндэстэн
        </div>
        <h1 className="animate-fade-up-delay-2 font-[Bebas_Neue] text-[clamp(48px,8vw,100px)] leading-[0.9] tracking-[-2px]">
          <span className="text-[#cc2200]">Кланд</span> нэгдэх
        </h1>
        <p className="animate-fade-up-delay-3 mt-6 max-w-lg text-[13px] leading-[2] text-[rgba(240,236,227,0.5)]">
          AI-г эзэмшиж, хэрэгслээ бүтээж, ирээдүйгээ тодорхойлдог бүтээгчдийн үндэстний нэг хэсэг бол.
          Хилээр бус — сэтгэлгээгээр тодорхойлогдоно.
        </p>
      </section>

      <section className="mb-16">
        <div className="section-label">Юу авах вэ</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { num: "01", name: "ФУТУРИЗМ", role: "Луужин", desc: "Бусдын хараагүйг хар. AI-г ашиглахгүй — тодорхойл." },
            { num: "02", name: "ЦАГ ХУГАЦАА", role: "Хөдөлгүүр", desc: "Шийдвэр бүр үр ашгаар шүүгдэнэ. Илүү хурдан. Илүү хөнгөн. Дэмий зүйлгүй." },
            { num: "03", name: "ДАСАН ЗОХИЦОЛ", role: "Хуяг", desc: "Өөрчлөлтөд дасахгүй — урьдчил. Хөгжихөө хэзээ ч бүү зогсоо." },
            { num: "04", name: "МӨНХИЙН БАЙЛДАН ДАГУУЛАЛТ", role: "Сүнс", desc: "Финиш шугам гэж байхгүй. Оргил бүр дараагийн өндөрлөгийг харуулна." },
          ].map((v) => (
            <div key={v.num} className={`card p-6 ${v.num === "04" ? "relative overflow-hidden" : ""}`}>
              {v.num === "04" && (
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(204,34,0,0.06)_0%,transparent_60%)]" />
              )}
                <div className="mb-4 text-[10px] tracking-[0.5px] text-[rgba(240,236,227,0.2)]">{v.num}</div>
                <div className={`mb-2 font-[Bebas_Neue] text-2xl tracking-[1px] ${v.num === "04" ? "text-[#cc2200]" : "text-[#ede8df]"}`}>
                {v.name}
              </div>
                <div className="mb-3 text-[10px] uppercase tracking-[0.5px] text-[#c8c8c0]">{v.role}</div>
              <p className="text-[12px] leading-[1.9] text-[rgba(240,236,227,0.5)]">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <div className="card overflow-hidden">
          <div className="bg-[#cc2200] px-6 py-8 md:px-10">
            <div className="mb-2 text-[10px] uppercase tracking-[1px] text-[rgba(5,5,5,0.4)]">
              Гишүүнчлэл
            </div>
            <div className="font-[Bebas_Neue] text-[clamp(36px,5vw,60px)] leading-[1] text-[#030303]">
              ₮{CLAN_PRICE}<span className="ml-2 text-[20px] text-[rgba(5,5,5,0.4)]">/сар</span>
            </div>
          </div>

          <div className="p-6 md:p-10">
            {!session ? (
              <div>
                <p className="mb-6 text-[13px] leading-[2] text-[rgba(240,236,227,0.5)]">
                  Кланд нэгдэж, Дижитал Үндэстний гишүүн болохын тулд нэвтэрнэ үү.
                </p>
                <Link href="/auth/signin" className="btn-blood">
                  Нэвтэрч нэгдэх
                </Link>
              </div>
            ) : showPayment ? (
              <div>
                <div className="mb-6 text-[11px] uppercase tracking-[1px] text-[#c8c8c0]">
                  Дансаар шилжүүлэх эсвэл QR код уншуулах
                </div>

                <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
                  {/* QR Code */}
                  <div className="flex flex-col items-center">
                    <div className="overflow-hidden rounded-lg bg-white p-3">
                      <Image
                        src="/qpay.png"
                        alt="QPay QR код"
                        width={220}
                        height={220}
                        className="h-[220px] w-[220px] object-contain"
                      />
                    </div>
                    <p className="mt-3 text-center text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                      Банкны апп-аар уншуулах
                    </p>
                  </div>

                  {/* Bank Transfer Details */}
                  <div className="flex-1 space-y-4">
                    <div className="rounded-lg border border-[rgba(240,236,227,0.08)] p-4">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                        Хүлээн авах данс
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-[Bebas_Neue] text-xl tracking-[1px] text-[#ede8df]">
                          {BANK_ACCOUNT}
                        </span>
                        <button
                          onClick={() => copyToClipboard(BANK_ACCOUNT, "account")}
                          className="rounded p-1.5 text-[#5a5550] transition hover:bg-[rgba(240,236,227,0.05)] hover:text-[#ede8df]"
                        >
                          {copied === "account" ? (
                            <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[rgba(240,236,227,0.08)] p-4">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                        Хүлээн авагч
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-[Bebas_Neue] text-xl tracking-[1px] text-[#ede8df]">
                          {BANK_RECIPIENT}
                        </span>
                        <button
                          onClick={() => copyToClipboard(BANK_RECIPIENT, "recipient")}
                          className="rounded p-1.5 text-[#5a5550] transition hover:bg-[rgba(240,236,227,0.05)] hover:text-[#ede8df]"
                        >
                          {copied === "recipient" ? (
                            <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[rgba(240,236,227,0.08)] p-4">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                        Төлбөрийн дүн
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-[Bebas_Neue] text-xl tracking-[1px] text-[#ede8df]">
                          {CLAN_PRICE} ₮
                        </span>
                        <button
                          onClick={() => copyToClipboard("25000", "amount")}
                          className="rounded p-1.5 text-[#5a5550] transition hover:bg-[rgba(240,236,227,0.05)] hover:text-[#ede8df]"
                        >
                          {copied === "amount" ? (
                            <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#cc2200]/30 bg-[#cc2200]/5 p-4">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.5px] text-[#cc2200]">
                        Гүйлгээний утга
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-[Bebas_Neue] text-xl tracking-[1px] text-[#cc2200]">
                          {referenceId}
                        </span>
                        <button
                          onClick={() => copyToClipboard(referenceId, "ref")}
                          className="rounded p-1.5 text-[#cc2200]/60 transition hover:bg-[#cc2200]/10 hover:text-[#cc2200]"
                        >
                          {copied === "ref" ? (
                            <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-lg border border-[rgba(240,236,227,0.08)] bg-[rgba(240,236,227,0.02)] p-4">
                  <p className="text-[12px] leading-[2] text-[rgba(240,236,227,0.45)]">
                    Төлбөрийг дээрх дансанд шилжүүлж, гүйлгээний утга дээр <strong className="text-[#cc2200]">{referenceId}</strong> дугаарыг бичнэ үү.
                    Мөн та банкны аппликейшнээр QR кодыг уншуулж төлбөр төлөх боломжтой.
                  </p>
                </div>

                <button
                  onClick={handleConfirmPayment}
                  disabled={submitting}
                  className="btn-blood mt-6"
                >
                  {submitting ? "Илгээж байна..." : "Төлбөр шилжүүлсэн"}
                </button>
              </div>
            ) : (
              <div>
                <ul className="mb-8 space-y-3 text-[12px] leading-[2] text-[rgba(240,236,227,0.6)]">
                  <li className="flex items-center gap-3">
                    <span className="text-[#cc2200]">→</span> Нийгэмлэгт бүрэн хандалт
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#cc2200]">→</span> Тусгай AI хичээлүүд &amp; нөөцүүд
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#cc2200]">→</span> Бүтээгчдийн сүлжээний холболт
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#cc2200]">→</span> Шууд менторшип хандалт
                  </li>
                </ul>
                <button
                  onClick={handleJoin}
                  disabled={submitting}
                  className="btn-blood"
                >
                  {submitting ? "Уншиж байна..." : `Кланд нэгдэх — ₮${CLAN_PRICE}`}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mb-16 overflow-hidden bg-[#cc2200] p-8 md:p-16">
        <div className="font-[Bebas_Neue] text-[clamp(28px,4vw,56px)] leading-[1.3] tracking-[2px] text-[#030303]">
          <span className="text-[rgba(5,5,5,0.4)]">Ирээдүй хүлээхгүй.</span><br />
          Бид ч мөн адил.<br /><br />
          <span className="text-[rgba(5,5,5,0.4)]">Бид бүтээнэ. Бид заана. Бид дасна.</span><br />
          Одоогоор байхгүй —<br />гэхдээ байх болно<br />гэсэн үндэстний төлөө.
        </div>
        <div className="mt-8 font-[Bebas_Neue] text-[clamp(40px,6vw,80px)] leading-[1] tracking-[4px] text-[#030303]">
          Be Wild.<br />Conquer<br />the Future.
        </div>
      </section>
    </div>
  );
}
