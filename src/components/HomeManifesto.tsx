"use client";

import { useLandingContent } from "@/components/landing/kit";

// ─── Нүүрийн "манифест" хэсэг — үүсгэн байгуулагчийн үг ───
// Текст нь бүхэлдээ DB-д (LandingContent.homeManifesto), /admin/landing →
// "Их бие" таб дээрээс засварлана. Хоосон бол хэсэг огт харагдахгүй.
// Догол мөрийг хоосон мөрөөр тусгаарлана; **тод** бичиглэл дэмжинэ.

function renderBold(line: string, keyBase: string) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyBase}-${i}`} className="font-semibold text-[#FFFFFF]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}

export default function HomeManifesto() {
  const content = useLandingContent();
  const raw = (content.homeManifesto || "").trim();
  if (!raw) return null;

  const paras = raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return null;

  return (
    <section className="border-t border-[#262626] px-4 py-20 md:px-8 md:py-24 lg:px-12">
      <div className="mx-auto max-w-[62ch]">
        {paras.map((p, i) => (
          <p
            key={i}
            className="mb-5 text-[16px] leading-[30px] text-[#E2E4E8] last:mb-0 md:text-[17px] md:leading-[32px]"
          >
            {renderBold(p, String(i))}
          </p>
        ))}
      </div>
    </section>
  );
}
