"use client";

import { useEffect, useState } from "react";

interface Inquiry {
  _id: string;
  company: string;
  name: string;
  email: string;
  phone: string;
  type: "brand" | "education" | "tech" | "community" | "other";
  message: string;
  status: "new" | "contacted" | "closed";
  adminNote: string;
  createdAt: string;
}

interface Counts {
  total: number;
  new: number;
  contacted: number;
  closed: number;
}

const TYPE_LABELS: Record<string, string> = {
  brand: "Бренд / Ивээн тэтгэгч",
  education: "Боловсролын хамтрагч",
  tech: "Технологи / Affiliate",
  community: "Нийгэмлэг / Эвент",
  other: "Бусад",
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "Шинэ", color: "text-[#FFD300] bg-[#FFD300]/10" },
  contacted: { label: "Холбогдсон", color: "text-blue-400 bg-blue-400/10" },
  closed: { label: "Хаасан", color: "text-[#5a5550] bg-[#5a5550]/10" },
};

const STATUS_ORDER: Array<"new" | "contacted" | "closed"> = ["new", "contacted", "closed"];

function formatDate(d: string) {
  return new Date(d).toLocaleString("mn-MN", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminPartnershipsPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, new: 0, contacted: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "contacted" | "closed">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [flash, setFlash] = useState("");

  const fetchInquiries = async () => {
    try {
      const res = await fetch("/api/admin/partnerships");
      const data = await res.json();
      if (res.ok) {
        setInquiries(data.inquiries);
        setCounts(data.counts);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInquiries(); }, []);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 3000);
  };

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/partnerships/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      showFlash("Төлөв шинэчлэгдлээ");
      fetchInquiries();
    } else {
      showFlash("Алдаа гарлаа");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Энэ хүсэлтийг устгах уу?")) return;
    const res = await fetch(`/api/admin/partnerships/${id}`, { method: "DELETE" });
    if (res.ok) {
      showFlash("Устгагдлаа");
      setInquiries((prev) => prev.filter((i) => i._id !== id));
      fetchInquiries();
    } else {
      showFlash("Алдаа гарлаа");
    }
  };

  const visible = filter === "all" ? inquiries : inquiries.filter((i) => i.status === filter);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[9px] uppercase tracking-[1px] text-[#FFD300]">Удирдлага</div>
          <h1 className="mt-1 text-2xl tracking-[1px]">ХАМТРАХ ХҮСЭЛТҮҮД</h1>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { key: "all", label: "Бүгд", value: counts.total },
          { key: "new", label: "Шинэ", value: counts.new },
          { key: "contacted", label: "Холбогдсон", value: counts.contacted },
          { key: "closed", label: "Хаасан", value: counts.closed },
        ] as const).map((tile) => (
          <button
            key={tile.key}
            onClick={() => setFilter(tile.key)}
            className={`border p-4 text-left transition ${
              filter === tile.key
                ? "border-[#FFD300] bg-[rgba(255,211,0,0.06)]"
                : "border-[#F2F2F4] bg-[#0A0A0A] hover:border-[#3a3835]"
            }`}
          >
            <div className="text-2xl font-bold text-[#ede8df]">{tile.value}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[1px] text-[#5a5550]">{tile.label}</div>
          </button>
        ))}
      </div>

      {flash && (
        <div className="mb-4 border border-[#FFD300] bg-[rgba(255,211,0,0.06)] px-4 py-2.5 text-[12px] text-[#FFD300]">
          {flash}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center">
          <div className="mx-auto h-6 w-6 animate-spin border-2 border-[#FFD300] border-t-transparent" />
        </div>
      ) : visible.length === 0 ? (
        <div className="border border-[#F2F2F4] bg-[#0A0A0A] py-16 text-center text-[12px] text-[#5a5550]">
          Хүсэлт алга
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((inq) => {
            const st = STATUS_MAP[inq.status];
            const expanded = expandedId === inq._id;
            return (
              <div key={inq._id} className="border border-[#F2F2F4] bg-[#0A0A0A]">
                <button
                  onClick={() => setExpandedId(expanded ? null : inq._id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[1px] ${st.color}`}>
                        {st.label}
                      </span>
                      <span className="text-[13px] font-semibold text-[#ede8df]">
                        {inq.name}{inq.company ? ` · ${inq.company}` : ""}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#5a5550]">
                      <span>{TYPE_LABELS[inq.type]}</span>
                      <span>·</span>
                      <span>{formatDate(inq.createdAt)}</span>
                    </div>
                  </div>
                  <span className={`shrink-0 text-[#5a5550] transition ${expanded ? "rotate-45" : ""}`}>+</span>
                </button>

                {expanded && (
                  <div className="border-t border-[#F2F2F4] px-4 py-4">
                    <div className="grid gap-2 text-[12px] sm:grid-cols-2">
                      <div>
                        <span className="text-[#5a5550]">Имэйл: </span>
                        <a href={`mailto:${inq.email}`} className="text-[#FFD300] hover:underline">{inq.email}</a>
                      </div>
                      {inq.phone && (
                        <div>
                          <span className="text-[#5a5550]">Утас: </span>
                          <a href={`tel:${inq.phone}`} className="text-[#c8c8c0] hover:underline">{inq.phone}</a>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 whitespace-pre-wrap border border-[#F2F2F4] bg-[#0E0E12] p-3 text-[13px] leading-relaxed text-[#c8c8c0]">
                      {inq.message}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[1px] text-[#5a5550]">Төлөв:</span>
                      {STATUS_ORDER.map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(inq._id, s)}
                          disabled={inq.status === s}
                          className={`px-3 py-1.5 text-[11px] font-semibold transition ${
                            inq.status === s
                              ? `${STATUS_MAP[s].color} cursor-default`
                              : "border border-[#F2F2F4] text-[#5a5550] hover:text-[#c8c8c0]"
                          }`}
                        >
                          {STATUS_MAP[s].label}
                        </button>
                      ))}
                      <a
                        href={`mailto:${inq.email}?subject=${encodeURIComponent("Antaqor хамтрах санал")}`}
                        className="ml-auto bg-[#FFD300] px-3 py-1.5 text-[11px] font-bold text-[#0A0A0A] transition hover:bg-[#ffe14d]"
                      >
                        Хариу бичих
                      </a>
                      <button
                        onClick={() => remove(inq._id)}
                        className="px-3 py-1.5 text-[11px] font-semibold text-[#a33] transition hover:text-[#e55]"
                      >
                        Устгах
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
