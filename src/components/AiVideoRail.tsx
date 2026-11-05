"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CreditIcon } from "@/components/CreditIcon";

/* ─── Зочны нүүр: ГИШҮҮДИЙН AI ВИДЕО ─────────────────────────────────────
   `AiGallery`-ийн эгч хэсэг. Тэр нь зураг, энэ нь хөдөлгөөн.

   Хоосон үед юу ч ХАРУУЛАХГҮЙ (`null`). Хоосон торыг "одоохондоо видео
   алга" гэж бичээд үлдээх нь зочинд "энд хэн ч байхгүй" гэж уншигдана.

   ЯАГААД АВТОМАТААР ТОГЛОДОГГҮЙ ВЭ: нэг дор дөрвөн видео чимээгүй ч
   гэсэн өөрөө эхэлбэл утасны эрчим хүч, дата хоёрыг зөвшөөрөлгүй иднэ.
   Тиймээс `preload="metadata"` — эхний кадр л татагдана; хулганаа
   ойртуулбал (ширээний) эсвэл дарвал (утас) тоглоно. */

interface Item {
  _id: string;
  video: string;
  poster: string;
  seconds: number;
  author: string;
  avatar: string;
  reactions: number;
}

function Tile({ item }: { item: Item }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <Link
      href={`/posts/${item._id}`}
      className="group relative block aspect-[9/16] overflow-hidden rounded-[4px] bg-[rgba(255,255,255,0.05)]"
      onMouseEnter={() => ref.current?.play().catch(() => {})}
      onMouseLeave={() => { const v = ref.current; if (v) { v.pause(); v.currentTime = 0; } }}
    >
      <video
        ref={ref}
        src={item.video}
        poster={item.poster || undefined}
        muted
        loop
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
      {/* Тоглуулах тэмдэг — энэ бол видео гэдгийг нэг харцаар хэлнэ. */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center transition group-hover:opacity-0">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 backdrop-blur-[2px]">
          <svg className="h-4 w-4 translate-x-[1px] text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6">
        <span className="truncate text-[10.5px] font-semibold text-white/90">{item.author}</span>
        {item.seconds > 0 && (
          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-white/70">{item.seconds}с</span>
        )}
      </span>
    </Link>
  );
}

export default function AiVideoRail() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    fetch("/api/ai-videos?limit=8")
      .then((r) => r.json())
      .then((d) => { if (!cancel && Array.isArray(d.items)) setItems(d.items); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <section className="px-4 py-10 sm:px-5">
      <div className="mx-auto max-w-[1000px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="chrome text-[10px] font-bold uppercase tracking-[0.2em] text-[#2E29FF]">
              AI ВИДЕО
            </div>
            <h2 className="mt-1 text-[19px] font-black leading-tight text-[var(--nav-fg-strong)] sm:text-[22px]">
              Бичсэн зүйл чинь хөдөлдөг
            </h2>
            <p className="mt-1 text-[12.5px] text-[#E2E4E8]">
              Бүгд Antaqor дотор, Seedance дээр үүссэн.
            </p>
          </div>
          <Link
            href="/tools/video"
            className="inline-flex items-center gap-1.5 rounded-[4px] px-3.5 py-2 text-[12.5px] font-black text-white transition hover:opacity-90"
            style={{ background: "#2E29FF" }}
          >
            <CreditIcon size={11} />
            Видео үүсгэх
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => <Tile key={it._id} item={it} />)}
        </div>
      </div>
    </section>
  );
}
