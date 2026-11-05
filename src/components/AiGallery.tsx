"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditIcon } from "@/components/CreditIcon";

/* ─── Зочны нүүр: ГИШҮҮДИЙН AI БҮТЭЭЛ ────────────────────────────────────
   Хамтлагийн нотолгоо нь тайлбар биш, БҮТЭЭЛ. Энэ хэсэг Antaqor дотор
   бодитоор үүсгэсэн зургуудыг харуулна.

   Хоосон үед юу ч ХАРУУЛАХГҮЙ (`null` буцаана). Хоосон торыг "одоохондоо
   бүтээл алга" гэж бичээд үлдээх нь хамгийн муу хувилбар: зочин үүнийг
   "энд хэн ч байхгүй" гэж уншина. Байхгүй хэсэг нь хоосон хэсгээс дээр. */

interface Item {
  _id: string;
  image: string;
  author: string;
  avatar: string;
  reactions: number;
}

export default function AiGallery({ imageCost = 10 }: { imageCost?: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    fetch("/api/ai-gallery?limit=12")
      .then((r) => r.json())
      .then((d) => { if (!cancel && Array.isArray(d.items)) setItems(d.items); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  if (loading) {
    return (
      <section className="px-4 py-8 sm:px-5">
        <div className="mx-auto max-w-[1000px]">
          <div className="h-3 w-40 animate-pulse rounded-[4px] bg-[rgba(255,255,255,0.06)]" />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="aspect-square animate-pulse rounded-[4px] bg-[rgba(255,255,255,0.05)]" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="px-4 py-10 sm:px-5">
      <div className="mx-auto max-w-[1000px]">
        {/* Толгой — нэг мөр: юу вэ, хэн хийсэн, хэрхэн нэгдэх. */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="chrome text-[10px] font-bold uppercase tracking-[0.2em] text-[#2E29FF]">
              Хамтлагийн бүтээл
            </div>
            <h2 className="mt-1.5 text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[var(--nav-fg-strong)] sm:text-[26px]">
              Энд өдөр бүр AI зураг төрж байна
            </h2>
            <p className="mt-1.5 max-w-md text-[13px] leading-[1.55] text-[#E2E4E8]">
              Бүгд Antaqor дотор, Nano Banana 2 дээр үүссэн. Промпт нь гишүүдэд нээлттэй.
            </p>
          </div>
          <Link
            href="/pricing"
            className="press inline-flex shrink-0 items-center gap-1.5 rounded-[4px] bg-[#2E29FF] px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-[#1F1AD9]"
          >
            <CreditIcon size={13} />
            {imageCost} кредитээр эхлэх
          </Link>
        </div>

        {/* Тор — зураг нь баатар, бусад нь чимээгүй. Hover дээр л зохиогч
            гарна: 12 нэр зэрэг харагдвал аль нь ч уншигдахгүй. */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <Link
              key={it._id}
              href={`/posts/${it._id}`}
              className="group relative aspect-square overflow-hidden rounded-[4px] bg-[rgba(255,255,255,0.04)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.image}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6 opacity-0 transition group-hover:opacity-100">
                {it.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.avatar} alt="" className="h-4 w-4 rounded-full object-cover" />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2E29FF] text-[8px] font-black text-white">
                    {it.author.charAt(0)}
                  </span>
                )}
                <span className="truncate text-[10px] font-semibold text-white">{it.author}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
