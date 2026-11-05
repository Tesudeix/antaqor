/* ─── Magazine — нийтлэлийн биеийг HTML болгох (2026-10-11) ────────────────
   Цэвэр функц (сервер ба клиентэд хоёуланд): админы урьдчилсан харагдац ба
   нийтийн хуудас ЯГ ижил гаралттай байх ёстой.

   Формат (энгийн, редакторт ээлтэй):
     # Гарчиг · ## Дэд гарчиг · > Ишлэл
     ![тайлбар](/uploads/x.webp)  — ганцаараа мөр бол figure + figcaption
     **тод** · _налуу_ · [холбоос](https://…)
   Догол мөрүүд хоосон мөрөөр тусгаарлагдана.
   АЮУЛГҮЙ: бүх текст escape хийгдэнэ; холбоос/зураг зөвхөн https:// эсвэл
   /uploads/ замтай байж болно. */

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function isSafeUrl(u: string) {
  return /^https:\/\//i.test(u) || u.startsWith("/uploads/") || u.startsWith("/");
}

function inline(s: string) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\s)_([^_]+)_(?=\s|$|[.,!?])/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t: string, u: string) =>
      isSafeUrl(u) ? `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>` : m);
}

export function renderMagazine(raw: string): string {
  if (!raw) return "";
  return raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      if (/^##\s+/.test(p)) return `<h3>${inline(escapeHtml(p.replace(/^##\s+/, "")))}</h3>`;
      if (/^#\s+/.test(p)) return `<h2>${inline(escapeHtml(p.replace(/^#\s+/, "")))}</h2>`;
      if (/^>\s+/.test(p)) return `<blockquote>${inline(escapeHtml(p.replace(/^>\s+/, "")))}</blockquote>`;
      const img = p.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (img && isSafeUrl(img[2])) {
        const cap = escapeHtml(img[1]);
        return `<figure><img src="${escapeHtml(img[2])}" alt="${cap}" loading="lazy" />${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`;
      }
      return `<p>${p.split("\n").map((l) => inline(escapeHtml(l))).join("<br />")}</p>`;
    })
    .join("");
}

/** Нийтлэлийн эхний догол мөрөөс товч тайлбар (excerpt хоосон үед). */
export function autoExcerpt(raw: string, max = 160) {
  const first = (raw || "").split(/\n{2,}/).map((p) => p.trim()).find((p) => p && !/^(#|>|!\[)/.test(p)) || "";
  const t = first.replace(/[*_]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, "") + "…" : t;
}

export const MAG_CATEGORIES = ["AI", "LLM", "Agents", "Research", "Бизнес", "Tool", "Монгол"] as const;
export type MagCategory = (typeof MAG_CATEGORIES)[number];

/** Сэтгүүлийн бүх нийтлэлд нэг ижил хар-цагаан зургийн дүрэм. */
export const MAG_IMG_FILTER = "grayscale(1) contrast(1.06)";
