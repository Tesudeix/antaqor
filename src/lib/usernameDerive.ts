import User from "@/models/User";
import { isRecoverableTag } from "@/lib/payTag";

/* ─── Гүйлгээний утганд бичих НЭР бүх хүнд байх ёстой ─────────────────────

   `/pricing` нь худалдан авагчид гүйлгээний утганд бичих зүйлийг харуулна.
   Хамгийн сайн нь тэдний ӨӨРИЙН нэр — хүн өөрийн нэрээ зөв бичдэг, харин
   санамсаргүй 6 тэмдэгтийг (`K7M3PQ`) банкны аппд буруу бичдэг.

   Гэтэл 650 бүртгэлийн 571 нь `username`-гүй байсан: тэр талбар хожуу
   нэмэгдсэн бөгөөд бүртгэлийн маягт нь ЗААВАЛ шаарддаггүй. Өөрөөр хэлбэл
   төлөгчдийн 88% нь хамгийн бартаатай замаар явж байсан.

   Шийдэл нь маягтад дахин нэг талбар нэмэх БИШ. Талбар нэмэх нь зөвхөн
   ШИНЭ хүнийг, түүн дотроос ч бөглөсөн хүнийг л засна. Оронд нь: нэр нь
   өгөгдсөн зүйлээс АВТОМАТААР гаргана, давхцахгүй болтол нь ялгана. Хүн
   дуртай бол дараа нь өөрчилнө.

   Гаргасан нэр нь ХОЁУЛАА дүрмийг давах ёстой:
     · User schema:  /^[a-zA-Z0-9_]+$/, 3–30
     · payTag:       /^[a-z][a-z0-9._-]{3,23}$/ + STATEMENT_NOISE-д биш
   Огтлолцол нь доорх `SAFE_RX`. Аль нэгийг нь зөрчвөл нэр нь эсвэл
   хадгалагдахгүй, эсвэл банкны хуулгаас буцааж уншигдахгүй.              */

const SAFE_RX = /^[a-z][a-z0-9_]{3,23}$/;

/* Монгол кирилл → латин. Банкны хуулга латинаар ирдэг тул кирилл нэрийг
   шууд ашиглах боломжгүй. Энэ бол хэл шинжлэлийн бус, ПРАКТИК хөрвүүлэлт:
   зорилго нь эргэж уншигдах тогтвортой тэмдэг үүсгэх, төгс бичиглэл биш. */
const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", ө: "u", п: "p",
  р: "r", с: "s", т: "t", у: "u", ү: "u", ф: "f", х: "h", ц: "ts", ч: "ch",
  ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function translit(s: string): string {
  let out = "";
  for (const ch of s.toLowerCase()) {
    if (Object.prototype.hasOwnProperty.call(CYR, ch)) out += CYR[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else out += "_";
  }
  return out;
}

/** Түүхий мөрийг дүрэмд нийцэх суурь болгоно. Нийцүүлж чадахгүй бол "". */
function slugify(raw: string): string {
  let s = translit(String(raw || ""))
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  // Заавал ҮСГЭЭР эхэлнэ — тоогоор эхэлсэн тэмдэг банкны хуулган дээрх
  // огноо/дүнтэй мөргөлдөнө (payTag.ts-ийн шалтгаан).
  s = s.replace(/^[0-9_]+/, "");
  s = s.slice(0, 20);
  if (s.length < 4) return "";
  return SAFE_RX.test(s) ? s : "";
}

/**
 * Хэрэглэгчийн өгөгдлөөс давхцахгүй, уншигдах username гаргана.
 *
 * Дараалал нь санамсаргүй биш: имэйлийн эхний хэсэг нь ихэвчлэн латин
 * бөгөөд хүн өөрөө сонгосон байдаг тул хамгийн танигдахуйц. Нэр нь кирилл
 * байх магадлалтай — хөрвүүлсэн хувилбар нь хоёрдугаарт. Аль нь ч болохгүй
 * бол л ерөнхий суурь дээр тоо нэмнэ.
 */
export async function deriveUsername(src: {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
}): Promise<string> {
  const candidates: string[] = [];

  const local = String(src.email || "").split("@")[0];
  if (local) candidates.push(slugify(local));
  if (src.name) candidates.push(slugify(src.name));

  const bases = candidates.filter((c) => c && isRecoverableTag(c));
  /* Нэг ч суурь гарахгүй бол (кирилл бус, хэт богино, эсвэл банкны
     "чимээ" үгтэй давхцсан) ерөнхий суурь. Энэ нь ref кодоос дээр:
     дор хаяж танигдах хэлбэртэй бөгөөд дараа нь өөрчлөгдөнө. */
  const base = bases[0] || "gishuun";

  for (let i = 0; i < 60; i++) {
    /* Эхний оролдлого нь дагаваргүй — хамгийн цэвэр хувилбарыг эхэлж
       туршина. Дараа нь 2, 3, … Хэрэв тэр ч дүүрвэл 4 оронтой санамсаргүй
       тоо: дараалсан 60 хүн ижил суурьтай байх нь бодит (жишээ нь
       "gishuun") бөгөөд шугаман хайлт нь удаашрахаас өмнө таслах. */
    let candidate: string;
    if (i === 0) candidate = base;
    else if (i < 40) candidate = `${base}${i + 1}`;
    else candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;

    if (candidate.length > 24) candidate = candidate.slice(0, 24);
    if (!SAFE_RX.test(candidate) || !isRecoverableTag(candidate)) continue;

    const taken = await User.exists({ username: candidate });
    if (!taken) return candidate;
  }

  // Онолын хувьд л хүрэх салаа. Мөнгө өлгөөтэй үлдэхээс "gishuunXXXXXX" дээр.
  return `gishuun${Date.now().toString(36).slice(-6)}`;
}

/** Хүн өөрөө оруулсан нэрийг шалгана. Алдааг МОНГОЛООР буцаана. */
export function validateUsername(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const v = String(raw || "").trim().replace(/^@+/, "").toLowerCase();
  if (v.length < 4) return { ok: false, error: "Дор хаяж 4 тэмдэгт байх ёстой" };
  if (v.length > 24) return { ok: false, error: "Хамгийн ихдээ 24 тэмдэгт" };
  if (!/^[a-z]/.test(v)) return { ok: false, error: "Латин үсгээр эхлэх ёстой" };
  if (!/^[a-z0-9_]+$/.test(v)) return { ok: false, error: "Зөвхөн латин үсэг, тоо, _ ашиглана" };
  if (!isRecoverableTag(v))
    return { ok: false, error: "Энэ нэрийг банкны гүйлгээнээс ялгаж танихгүй. Өөр нэр сонгоно уу" };
  return { ok: true, value: v };
}
