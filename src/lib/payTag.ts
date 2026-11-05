/* ─── Гүйлгээний утганд бичих ТЭМДЭГ — нэг тодорхойлолт, хоёр хэрэглэгч ───
   Энэ файл нь ГАНЦХАН зүйлийг баталгаажуулна:

     хүнд бичихийг ЗААСАН зүйлийг систем буцааж УНШИЖ чадна.

   Тэр хоёр тал өөр өөр файлд амьдардаг байсан бол хэзээ нэгэн цагт зөрнө:
   `/api/clan/join` нь username-ээ харуулаад, `auto-match` нь тэр хэлбэрийг
   таньдаггүй байлаа гэж бодъё — хүн зааврыг ЗӨВ дагаж мөнгөө явуулна,
   систем нь юу ч танихгүй, төлбөр өлгөөтэй үлдэнэ. Хамгийн муу төрлийн
   алдаа: хэн ч буруу зүйл хийгээгүй атал мөнгө алга болно.

   Тиймээс харуулах тал (`isRecoverableTag`) ба унших тал
   (`usernameCandidates`) ЯГ ижил дүрмээс тэжээгдэнэ. Дүрмээ өөрчлөх бол
   энд өөрчил — хоёулаа дагана. */

/** 4–24 тэмдэгт, үсгээр эхэлнэ. Богино эсвэл тоогоор эхэлсэн тэмдэг нь
    банкны хуулгын огноо/дүн/дансны дугаартай мөргөлдөх магадлал өндөр. */
export const USERNAME_RX = /^[a-z][a-z0-9._-]{3,23}$/;

/** Банкны хуулгад БАЙНГА тааралддаг үгс. Эдгээрийг username гэж үзвэл
    санамсаргүй хүний төлбөрийг батална. Жич: `antaqor` нь ЖИНХЭНЭ бүртгэлтэй
    нэр боловч гүйлгээний утганд худалдан авагчид өөрсдөө бичих магадлал
    хамгийн өндөр үг тул ЗОРИУД хаалттай — тэр бүртгэл ref кодоороо явна. */
export const STATEMENT_NOISE = new Set([
  "bank", "khan", "khaan", "golomt", "xacbank", "hasbank", "state",
  "tdbm", "tdbank", "trade", "development", "capitron", "arig", "chinggis",
  "card", "cash", "transfer", "payment", "account", "credit", "debit",
  "balance", "from", "info", "note", "desc", "ref", "code", "pos", "atm",
  "fee", "charge", "socialpay", "qpay", "monpay", "most", "mnt", "tugrug",
  "togrog", "antaqor", "member", "plan", "null", "undefined", "test", "true",
  "false", "date", "time", "name", "user", "guilgee", "gishuunchlel",
]);

/** Худалдан авагчид ЭНЭ тэмдгийг харуулж болох уу? Хариу нь "үгүй" бол
    /pricing нь ref код руу шилжинэ — код нь үргэлж уншигдана. */
export function isRecoverableTag(tag: string | undefined | null): boolean {
  if (!tag) return false;
  const t = tag.toLowerCase();
  return USERNAME_RX.test(t) && !STATEMENT_NOISE.has(t);
}

/** Банкны хуулгын нэг мөрөөс username байж болзошгүй тэмдэгтүүдийг сугална. */
export function usernameCandidates(line: string): string[] {
  const seen = new Set<string>();
  for (const raw of line.toLowerCase().split(/[^a-z0-9._-]+/)) {
    const t = raw.replace(/^[._-]+|[._-]+$/g, "");
    if (!isRecoverableTag(t)) continue;
    seen.add(t);
  }
  return Array.from(seen);
}
