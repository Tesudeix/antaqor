import dbConnect from "@/lib/mongodb";
import BrandProfile, { IBrandProfile } from "@/models/BrandProfile";

/* ─── PERSONAL BRAND-ЫН ЦӨМ ─────────────────────────────────────────────
   Нэг эх сурвалж: давталт шинэ пост бичихдээ ч, ноорог дүгнэхдээ ч
   эндээс уншина. Хоёр тусдаа хуулбар байвал нэг нь хоцорч, бичсэн пост
   нь дүгнэлтэд унах хачин байдал үүснэ. */

/* Анхны утгууд — эзэн нь дэлгэцээс засна. Үнэт зүйл бүрт УТГА нь
   заавал байна: "Playful бай" гэдэг AI-д юу ч хэлэхгүй, харин "хүнд
   сэдвийг ч хөнгөн авдаг" гэдэг нь бичих заавар болно. */
export const BRAND_SEED = {
  positioning: "Амбицтай нэг хүний хүчийг AI-аар үржүүлнэ.",
  tagline: "Тасрах бол намайг дага.",
  audience:
    "Монголын амбицтай ганцаарчилсан бүтээгч, entrepreneur — баггүйгээр, хөрөнгө оруулалтгүйгээр том зүйл хийхийг хүсдэг хүмүүс.",
  values: [
    {
      name: "Evolving",
      meaning:
        "Байнга өөрчлөгдөж байгаагаа нуухгүй. Өчигдрийн байр сууриа өнөөдөр засаж чадна. «Би буруу байсан» гэж бичих нь сул тал биш, эрх мэдэл.",
    },
    {
      name: "High Agency",
      meaning:
        "Хүлээхгүй, зөвшөөрөл асуухгүй. «Боломжгүй» гэдгийг эхлэх шалтгаан болгодог. Гомдоллохгүй — хийсэн зүйлээ харуулна.",
    },
    {
      name: "Playful",
      meaning:
        "Хүнд сэдвийг ч хөнгөн авна. Өөрийгөө хэтэрхий нухацтай авч үзэхгүй. Хошигнол нь бодлыг сулруулахгүй, харин наалдамхай болгоно.",
    },
    {
      name: "Restless",
      meaning:
        "Тогтож суухгүй. Хийчихээд сэтгэл ханахгүй, дараагийнхыг нь хайна. Амжилтаа дурсахаас илүү дараагийн алхмаа ярина.",
    },
    {
      name: "Asymmetric",
      meaning:
        "Жижиг оролтоос давуу гаралт. Бүгдийн явдаг замаар явахгүй. Хөдөлмөр биш, leverage ярина.",
    },
  ],
  avoid: [
    "бид, манай компани, манай баг",
    "танд санал болгож байна",
    "корпорацийн зөөлөн хэллэг",
    "hashtag",
    "сэтгэл хөдөлгөм гэх мэт хоосон тэмдэг нэр",
  ],
};

export async function getBrand(): Promise<IBrandProfile> {
  await dbConnect();
  const found = await BrandProfile.findOne({});
  if (found) return found;
  return BrandProfile.create(BRAND_SEED);
}

/* Промптын блок. `VOICE_SPEC` нь ХЭРХЭН бичихийг (хэлбэр, хэл) заадаг
   бол энэ нь ЮУНЫ ТӨЛӨӨ бичихийг (байр суурь, үнэт зүйл) заана. Хоёул
   хэрэгтэй: хэлбэр нь зөв ч байр суурьгүй пост нь хэнийх ч байж болно. */
export function brandPromptBlock(b: IBrandProfile): string {
  if (!b || b.enabled === false) return "";
  const lines: string[] = ["", "─── PERSONAL BRAND ───"];
  if (b.positioning) lines.push(`БАЙР СУУРЬ: ${b.positioning}`);
  if (b.tagline) lines.push(`УРИА: ${b.tagline}`);
  if (b.audience) lines.push(`ХЭНД: ${b.audience}`);
  if (b.values?.length) {
    lines.push("", "ҮНЭТ ЗҮЙЛС — пост бүр эдгээрийн ДОР ХАЯЖ НЭГийг тээж байх ёстой:");
    for (const v of b.values) lines.push(`· ${v.name} — ${v.meaning}`);
  }
  if (b.avoid?.length) {
    lines.push("", "ХЭЗЭЭ Ч БИЧИХГҮЙ: " + b.avoid.join("; "));
  }
  lines.push(
    "",
    "Пост нь зөвлөгөө түгээгч биш, ЗАМ ТАВИГЧ байх ёстой. Уншигч нь",
    "«энэ хүн явж байна, би араас нь явмаар байна» гэж мэдрэх ёстой.",
  );
  return lines.join("\n");
}

/* Дүгнэхэд ашиглах богино хувилбар — үнэт зүйлсийн нэрс. */
export function valueNames(b: IBrandProfile): string[] {
  return (b?.values || []).map((v) => v.name).filter(Boolean);
}
