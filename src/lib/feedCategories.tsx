/* ─── Урсгалын ангиллууд (2026-11-01, эзний жагсаалт) ─────────────────────
   Category коллекц нь reel-ийн ангиллуудтай (viral-reel, effects…) хуваалцдаг
   тул урсгал өөрийн 7-г ЭНД тодорхойлно. Мөрүүд нь Mongo-д бас бий
   (/api/posts ангиллыг коллекцоор шалгадаг) — slug нь хоёр газар ижил байх ёстой.
   Хуучин ангилалтай постууд (ерөнхий, бүтээл…) «Бүгд»-д хэвээр харагдана. */

export type FeedCat = { slug: string; label: string; mn: string; icon: string };

export const FEED_CATEGORIES: FeedCat[] = [
  { slug: "experiments", label: "Experiments", mn: "Туршилт", icon: "M9 3h6M10 3v6.5L4.6 18.4A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.4-2.6L14 9.5V3M7.5 15h9" },
  { slug: "failures", label: "Failures", mn: "Бүтэлгүйтэл", icon: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" },
  { slug: "case", label: "Case", mn: "Кейс", icon: "M3 7.5h18V20H3zM8.5 7.5V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2.5M3 13h18M11 13v2h2v-2" },
  { slug: "feeling", label: "Feeling", mn: "Мэдрэмж", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5s1.3 1.8 3.5 1.8 3.5-1.8 3.5-1.8M9 9.5h.01M15 9.5h.01" },
  { slug: "understand", label: "Understand", mn: "Ойлголт", icon: "M9 18h6M10 21.5h4M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.6V16h6v-.1c0-.6.3-1.2.8-1.6A6.5 6.5 0 0 0 12 2.5z" },
  { slug: "knowledge", label: "Knowledge", mn: "Мэдлэг", icon: "M4 19.5v-14A2.5 2.5 0 0 1 6.5 3H20v14H6.5A2.5 2.5 0 0 0 4 19.5 2.5 2.5 0 0 0 6.5 22H20v-5M8 7.5h8M8 11h5" },
  { slug: "products", label: "Products", mn: "Бүтээгдэхүүн", icon: "M21 7.5 12 2.5 3 7.5v9l9 5 9-5zM3 7.5l9 5 9-5M12 12.5v9M7.5 5l9 5" },
];

const BY_SLUG = new Map(FEED_CATEGORIES.map((c) => [c.slug, c]));
export const feedCat = (slug?: string) => (slug ? BY_SLUG.get(slug) : undefined);

/** Ангиллын тэмдэг — 24×24, зураасан, currentColor. */
export function CatIcon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d={d} />
    </svg>
  );
}
