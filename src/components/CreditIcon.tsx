"use client";

/* ─── Кредитийн тэмдэг ────────────────────────────────────────────────────
   `₵` тэмдэгтийг ОРЛУУЛНА. Шалтгаан: `₵` бол Ганагийн седи — өөр улсын
   жинхэнэ мөнгөн тэмдэгт. Ихэнх фонтод байхгүй тул төхөөрөмжөөс хамаарч
   өөр өөр өргөнтэй, заримд нь огт байхгүй (tofu). Мөн хүн үүнийг үнэ гэж
   уншдаг — "10₵" нь "10 цент" мэт харагдана.

   Од бол өөр зүйл: тоолж болох, цуглуулж болох, зарцуулж болох ЗҮЙЛ.
   Тоглоомын валют бүр ийм хэлбэртэй байдаг нь санамсаргүй биш.

   ХЭМЖЭЭ: `currentColor` ашиглана тул эцэг элементийн өнгийг өвлөнө.
   Тоотой хамт байх үед `<Credits/>`-ийг ашигла — тэр нь зай, босоо
   тэнцвэр, tabular тоог зөв барина. */

export function CreditIcon({ size = 14, filled = true, className = "" }: {
  size?: number;
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
      style={{ display: "inline-block", verticalAlign: "-0.12em", flexShrink: 0 }}
    >
      {/* 2026-10-28: зоосон дотор од. Зоос = "зарцуулж болох үнэ цэнэ",
          од = манай бренд. Од нь зоосноос ЦООРОГ (evenodd) тул currentColor-оор
          нэг өнгөтэй, жижиг хэмжээнд ч тод харагдана. */}
      {filled ? (
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 1.6a10.4 10.4 0 1 0 0 20.8 10.4 10.4 0 0 0 0-20.8ZM12 5.6c.4 3.6 2.8 6 6.4 6.4-3.6.4-6 2.8-6.4 6.4-.4-3.6-2.8-6-6.4-6.4 3.6-.4 6-2.8 6.4-6.4Z"
          fill="currentColor"
        />
      ) : (
        <>
          <circle cx="12" cy="12" r="9.6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 5.6c.4 3.6 2.8 6 6.4 6.4-3.6.4-6 2.8-6.4 6.4-.4-3.6-2.8-6-6.4-6.4 3.6-.4 6-2.8 6.4-6.4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

/** Тоо + од. Жишээ: `<Credits value={10} />` → ✦10 */
export function Credits({
  value,
  size = 13,
  className = "",
  showPlus = false,
}: {
  value: number | string | null | undefined;
  size?: number;
  className?: string;
  showPlus?: boolean;
}) {
  const n = typeof value === "number" ? value.toLocaleString() : (value ?? "…");
  return (
    <span className={`inline-flex items-center gap-[0.22em] ${className}`} style={{ fontVariantNumeric: "tabular-nums" }}>
      <CreditIcon size={size} />
      <span>{showPlus && typeof value === "number" && value > 0 ? "+" : ""}{n}</span>
    </span>
  );
}

export default CreditIcon;
