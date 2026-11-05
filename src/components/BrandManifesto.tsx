"use client";

import { Reveal, RevealGroup, RevealItem } from "@/components/landing/kit";

/* ─── Танилцуулга — слайдерын дараа ирэх хэсэг ────────────────────────────
   Дараалал нь санамсаргүй биш, юүлүүр: ЗОРИЛГО → ХЭН БОЛОХ → ЮУГ ЭРХЭМЛЭХ
   → ХЭНИЙ ЭСРЭГ → НЭГДЭХ. Хүн эхлээд юу болохыг ойлгож, дараа нь өөрийгөө
   тэнд байрлуулж, эцэст нь үйлдэл хийнэ.

   ХЭМЖЭЭ, ЗАЙН ТУХАЙ (өмнөх хувилбарын гол алдаа):
   · Энэ хэсэг зургаан өөр фонтын хэмжээ хэрэглэдэг байсан — 42 / 26 / 15 /
     13.5 / 32 / 11. Хоёр гарчиг ойролцоо боловч ӨӨР хэмжээтэй байхад нүд
     аль нь дээд эрэмбэ болохыг шийдэж чадахгүй, "замбараагүй" мэдрэмж яг
     эндээс гардаг. Одоо сайтын ӨӨРИЙН гурван шатлалыг л хэрэглэнэ:
     display / title / section, дээр нь нэг биет текст, нэг микро текст.
   · Блокууд `mt-14 + pt-10` = 96px зайгаар тусгаарлагдаж, бие биенээсээ
     салж хардаг байв. Одоо бүх блок ижил `py` авч, үсэн зураасаар
     заагдана — хэмнэл нэг, зай нь давтагдана.

   ХӨДӨЛГӨӨН: гүйлгэхэд блок бүр нэг л удаа гарч ирнэ (`Reveal` — сайтын
   өөрийн kit, `prefers-reduced-motion`-г хүндэлдэг). Үнэт зүйлийн картууд
   хулгана/хуруу хүрэхэд өргөгдөж, accent зураас нь уртсана. */

const VALUES: { no: string; en: string; mn: string; line: string }[] = [
  {
    no: "01",
    en: "AUTONOMY",
    mn: "БИЕ ДААЛТ",
    line: "Хэнээс ч зөвшөөрөл гуйхгүй. Систем, суваг, орлого — гурвуулаа чинийх.",
  },
  {
    no: "02",
    en: "CREATIVITY",
    mn: "БҮТЭЭХ",
    line: "Хэрэглэгч биш, бүтээгч. AI бол хэрэгсэл — гар нь чинийх хэвээр.",
  },
  {
    no: "03",
    en: "CURIOSITY",
    mn: "СОНИРХОЛ",
    line: "Мэдэхгүйгээсээ айхгүй. Долоо хоног бүр нэгийг ажиллуулж үзнэ.",
  },
];

/** Хэсгийн нэр — бүх блокт ЯГ ижил. Давтагдсан хэлбэр нь бүтцийг заана. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="chrome mb-4 text-[11px] font-bold tracking-[0.18em] text-[#E2E4E8]">
      {children}
    </div>
  );
}

export default function BrandManifesto() {
  return (
    <section aria-labelledby="manifesto-title" className="w-full bg-[#0A0A0A]">
      <div className="mx-auto max-w-4xl px-4 md:px-10">
        {/* ─── 1. ЗОРИЛГО — хуудасны хамгийн том бичиг ─── */}
        <Reveal className="border-b border-[#141414] py-14 md:py-20">
          <div className="chrome mb-4 text-[11px] font-bold tracking-[0.18em] text-[#2E29FF]">
            COMMUNITY MISSION
          </div>
          <h2
            id="manifesto-title"
            className="headline text-balance text-[clamp(26px,4.6vw,42px)] leading-[1.1] text-[#F2F2F4]"
          >
            Нэг хүний хүчийг AI-аар <span className="text-[#2E29FF]">үржүүлнэ</span>.
            Бие даасан, эрх чөлөөтэй entrepreneur бүтээнэ.
          </h2>
        </Reveal>

        {/* ─── 2. ХЭН БОЛОХ ─── */}
        <Reveal className="border-b border-[#141414] py-12 md:py-16">
          <Eyebrow>ХЭН БОЛОХ ВЭ</Eyebrow>
          <p className="text-[clamp(22px,3.6vw,30px)] font-extrabold leading-[1.15] tracking-[-0.025em] text-[#FFFFFF]">
            ONE-PERSON AI ENTREPRENEUR
          </p>
          <p className="mt-4 max-w-[54ch] text-[15px] leading-[1.7] text-[#E2E4E8]">
            AI-гаар чадвараа үржүүлж, орлого · бүтээл · систем · distribution-ээ{" "}
            <span className="font-semibold text-[#F2F2F4]">өөрөө эзэмшдэг</span> хүн.
          </p>
          <p className="mt-3 text-[15px] font-bold leading-[1.7] text-[#F2F2F4]">
            Баггүй. Зөвшөөрөлгүй. Хүлээхгүй.
          </p>
        </Reveal>

        {/* ─── 3. ЮУГ ЭРХЭМЛЭХ ─── */}
        <div className="border-b border-[#141414] py-12 md:py-16">
          <Reveal>
            <Eyebrow>CORE VALUES</Eyebrow>
          </Reveal>
          <RevealGroup className="grid gap-px bg-[#141414] sm:grid-cols-3">
            {VALUES.map((v) => (
              <RevealItem key={v.en}>
                {/* group + focus-within: хуруугаар хүрэхэд ч, гараар табаар
                    явахад ч ижил хариу үйлдэл. */}
                <div className="group h-full bg-[#0A0A0A] p-6 transition-colors duration-300 hover:bg-[#0A0A0A] focus-within:bg-[#0A0A0A]">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="chrome text-[11px] font-bold text-[#333333]">{v.no}</span>
                    {/* Уртсах зураас — "энэ идэвхтэй" гэдгийг өнгө нэмэхгүйгээр хэлнэ. */}
                    <span className="block h-px w-6 bg-[#2E29FF] transition-all duration-300 group-hover:w-12" />
                  </div>
                  <div className="text-[clamp(18px,2.8vw,24px)] font-extrabold tracking-[-0.02em] text-[#2E29FF]">
                    {v.en}
                  </div>
                  <div className="chrome mt-1 text-[11px] font-bold tracking-[0.16em] text-[#E2E4E8]">
                    {v.mn}
                  </div>
                  <p className="mt-4 text-[15px] leading-[1.65] text-[#E2E4E8]">{v.line}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>

        {/* ─── 4. ДАЙСАН ─── */}
        <Reveal className="py-12 md:py-20">
          <Eyebrow>ENEMY</Eyebrow>
          <p className="text-[clamp(22px,3.6vw,30px)] font-extrabold leading-[1.15] tracking-[-0.025em] text-[#FFFFFF]">
            {/* Зурсан зураас нь утгыг өөрийг нь харуулна — бид үүнийг таслана. */}
            <span className="line-through decoration-[#2E29FF] decoration-[3px]">DEPENDENCE</span>{" "}
            — <span className="text-[#2E29FF]">ХАРААТ БАЙДАЛ</span>
          </p>
          <p className="mt-4 max-w-[54ch] text-[15px] leading-[1.7] text-[#E2E4E8]">
            Цалин хүлээх. Зөвшөөрөл хүлээх. Алгоритм хүлээх.
          </p>
          <p className="mt-3 text-[15px] font-bold leading-[1.7] text-[#F2F2F4]">
            Бид хүлээдэггүй — бүтээдэг.
          </p>
        </Reveal>

      </div>
    </section>
  );
}
