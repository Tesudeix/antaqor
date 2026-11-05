"use client";

import React from "react";
import { Reveal, RevealGroup, RevealItem } from "@/components/landing/kit";

// ─── Нүүрийн "30 хоногийн MISSION" хэсэг ───
// Дараалал: HeroSlider → тоолуур → ЭНЭ. HomeLanding-д шууд байрлана,
// `homeSections` бүртгэлд ОРООГҮЙ: захиалагч дарааллыг тогтмол байхыг
// хүссэн бөгөөд тэр массив одоогоор хоосон (админаас юу ч асаагаагүй)
// тул бүртгэлд хийвэл огт харагдахгүй байх байсан.

/** `**тод**` тэмдэглэгээг <strong> болгоно — HomeManifesto-той ижил дүрэм. */
function bold(line: string, keyBase: string) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={keyBase + "-" + i} className="font-semibold text-[#FFFFFF]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}

const SKILLS = [
  "Брэнд зураг, постер, контент бүтээх",
  "AI Video, Reel хийх",
  "Өөрийн **AI Twin** үүсгэх",
  "AI Twin-ээрээ контент хийх",
  "Prompt зөв бичиж, хүссэн үр дүнгээ гаргах",
  "Контент бүтээх ажлаа хурдасгах",
  "Өөрийн стиль, брэндтэй **AI Content System** бий болгох",
];

export default function MissionBrief() {
  return (
    <section className="border-t border-[#262626] px-4 py-20 md:px-8 md:py-24 lg:px-12">
      <div className="mx-auto max-w-[68ch]">
        <Reveal className="mb-4">
          <div className="chrome flex items-center gap-3 text-[11px] font-bold">
            <span className="text-[#2E29FF]">[MISSION]</span>
            <span className="text-[#E2E4E8]">AI CREATOR</span>
            <span className="hidden h-px flex-1 bg-[#262626] md:block" />
          </div>
        </Reveal>

        <Reveal className="mb-6">
          <h2
            className="text-[clamp(26px,4.6vw,42px)] font-medium leading-[1.08] text-[#FFFFFF]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            30 ХОНОГИЙН MISSION
          </h2>
        </Reveal>

        <Reveal className="mb-7">
          <p className="text-[18px] font-semibold leading-[28px] text-[#FFFFFF] md:text-[20px] md:leading-[32px]">
            Өөрийн AI Twin-ээ бүтээ. Контент системээ босго. Орлогоо өсгө.
          </p>
        </Reveal>

        <Reveal className="mb-12">
          <p className="text-[16px] leading-[30px] text-[#E2E4E8] md:text-[17px] md:leading-[32px]">
            {bold(
              "30 хоногийн дотор AI ашиглан контент бүтээхийг **анхан шатнаас ахисан түвшин хүртэл** практик дээр сур.",
              "lead"
            )}
          </p>
        </Reveal>

        <Reveal className="chrome mb-5 text-[11px] font-bold text-[#E2E4E8]">
          AI ашиглан
        </Reveal>

        {/* Дугаарлалт нь жагсаалтыг "хичээлийн төлөвлөгөө" мэт уншуулна —
            цэг байснаас урт нь илүү мэдрэгддэг. */}
        <RevealGroup className="mb-14 border-t border-[#262626]">
          {SKILLS.map((s, i) => (
            <RevealItem
              key={s}
              className="flex items-baseline gap-4 border-b border-[#262626] py-4 md:gap-6"
            >
              <span
                className="chrome shrink-0 text-[11px] text-[#2E29FF]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[16px] leading-[26px] text-[#E2E4E8] md:text-[17px] md:leading-[28px]">
                {bold(s, "s" + i)}
              </span>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal>
          <div className="border-l-2 border-[#2E29FF] pl-5 md:pl-6">
            <div className="chrome mb-3 text-[11px] font-bold text-[#2E29FF]">
              30 хоногийн дараа
            </div>
            <p className="text-[16px] leading-[28px] text-[#E2E4E8] md:text-[17px] md:leading-[30px]">
              AI-тай зүгээр чатладаг хэрэглэгч биш,{" "}
              {bold(
                "**өөрийн AI Twin + Content System-ээ ажиллуулж чаддаг AI Creator** болсон байна.",
                "payoff"
              )}
            </p>
          </div>
        </Reveal>

        <Reveal className="mt-14">
          <p className="chrome text-[12px] font-bold leading-[22px] text-[#2E29FF] md:text-[13px]">
            Create faster. Build your twin. Grow your income.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
