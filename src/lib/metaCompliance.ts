// Meta policy compliance — keep our page out of trouble.
//
// Rule: Outside the 24-hour customer service window, Meta only allows messages
// with a valid MESSAGE_TAG (ACCOUNT_UPDATE, CONFIRMED_EVENT_UPDATE, etc).
// CRITICAL: promotional content (discounts, sales, urgency) is NEVER allowed
// under any tag outside 24h. Send it anyway → page ban within days.
//
// Strategy: detect promo content; if detected, force STANDARD tag so the
// message only goes through within the 24h window (Meta's Send API will
// reject if outside 24h with STANDARD — that's the desired safe behaviour).

export type MessageTag =
  | "STANDARD"
  | "ACCOUNT_UPDATE"
  | "CONFIRMED_EVENT_UPDATE"
  | "POST_PURCHASE_UPDATE";

const PROMO_PATTERNS: RegExp[] = [
  /\b\d+\s*%/, // "30%", "20 %"
  /хямдрал/i,
  /урамшуулал/i,
  /бэлэг(тэй|лэх)/i,
  /\b(бэлэг|спешл)\b/i,
  /\bbuy\b/i,
  /\bsale\b/i,
  /\bdiscount\b/i,
  /\boff\b/i,
  /\bfree\b/i,
  /\bpromo\b/i,
  /\bdeal\b/i,
  /\bcoupon\b/i,
  /\blimited\s+time\b/i,
];

const URGENCY_PATTERNS: RegExp[] = [
  /\bтөгсгөл/i,
  /\bсүүлчийн/i,
  /\bлаг\s*цаг/i,
  /\blast\s+chance\b/i,
  /\bending\s+soon\b/i,
  /\bhurry\b/i,
];

export function isPromoContent(text: string): boolean {
  return [...PROMO_PATTERNS, ...URGENCY_PATTERNS].some((re) => re.test(text));
}

// Pick a safe tag. If content is promotional and caller wanted a non-STANDARD
// tag, demote to STANDARD (which restricts delivery to inside-24h users only).
export function pickSafeTag(text: string, requested: MessageTag): MessageTag {
  if (requested === "STANDARD") return "STANDARD";
  if (isPromoContent(text)) return "STANDARD";
  return requested;
}

// Mongolian Advertising Law (Зар сурталчилгааны тухай хууль 2002) requires
// commercial messages to be labelled. Prepend "[Реклам]" when content is promo.
export function applyReklamLabel(text: string): string {
  if (text.includes("[Реклам]") || text.includes("[РЕКЛАМ]")) return text;
  if (!isPromoContent(text)) return text;
  return `[Реклам]\n${text}`;
}

// One-stop helper for outgoing automated messages.
export function complianceTransform(
  text: string,
  requestedTag: MessageTag
): { text: string; tag: MessageTag; isPromo: boolean } {
  const isPromo = isPromoContent(text);
  const tag = pickSafeTag(text, requestedTag);
  const finalText = applyReklamLabel(text);
  return { text: finalText, tag, isPromo };
}
