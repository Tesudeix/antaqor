import { news } from "../scalp/feeds";
import { SYMBOLS, type Sym } from "./market";

/* ─── Tesla Trader · дараагийн мэдээ (2026-11-06) ───
   Зөвхөн баримт: албан ёсны календарийн цаг, нэр, нөлөө. Гарчгийн сэтгэл хөдлөлийг хассан — түүнийг хэмжээгүй,
   хэмжээгүй зүйл шийдвэрт орох ёсгүй. Нэг цагт олон мэдээ гарвал хамгийн чухлынх нь нэрээр харуулна. */

const NAMES: [RegExp, string, number][] = [
  [/non-?farm/i, "АНУ ажлын байр", 10], [/fomc|federal funds|fed chair|powell|fed interest/i, "АНУ бодлогын хүү", 10], [/cpi|consumer price/i, "Инфляц", 9],
  [/pce/i, "Инфляц (PCE)", 8], [/unemployment rate/i, "АНУ ажилгүйдэл", 8], [/average hourly/i, "АНУ цалин", 7], [/gdp/i, "ДНБ", 7], [/ppi|producer price/i, "Үйлдвэрлэгчийн үнэ", 6],
  [/retail sales/i, "Жижиглэн худалдаа", 6], [/adp/i, "ADP ажлын байр", 5], [/jolts/i, "Сул ажлын байр", 5], [/ism/i, "ISM индекс", 5], [/pmi/i, "PMI индекс", 4],
  [/jobless|unemployment claims/i, "Ажилгүйдлийн тэтгэмж", 4], [/consumer sentiment|uom|consumer confidence/i, "Хэрэглэгчийн итгэл", 4],
];
const rank = (t: string) => NAMES.find(([r]) => r.test(t)) ?? null;
export type NextNews = { next: { t: number; name: string; also: number; soon: boolean } | null; line: { t: number; high: boolean }[] };

export async function nextNews(sym: Sym): Promise<NextNews> {
  const now = Date.now(), ev = (await news()).filter((e) => SYMBOLS[sym].ccy.includes(e.ccy) && e.impact !== "Low" && e.t > now && e.t - now < 48 * 3600e3).sort((a, b) => a.t - b.t);
  const line = [...new Map(ev.map((e) => [e.t, { t: e.t, high: ev.some((q) => q.t === e.t && q.impact === "High") }])).values()];
  const first = ev.find((e) => e.impact === "High");
  if (!first) return { next: null, line };
  const same = ev.filter((e) => e.t === first.t && e.impact === "High"), top = [...same].sort((a, b) => (rank(b.title)?.[2] ?? 0) - (rank(a.title)?.[2] ?? 0))[0];
  return { next: { t: first.t, name: rank(top.title)?.[1] ?? top.title, also: same.length - 1, soon: first.t - now < 2 * 3600e3 }, line };
}
