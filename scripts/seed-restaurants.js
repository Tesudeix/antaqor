/* ─── Scout сангийн үр — mongosh скрипт ───────────────────────────────────
   Ажиллуулах:  mongosh antaqor --quiet --file seed-restaurants.js

   ЧУХАЛ ба ИЛ ХЭЛЭХ ЗҮЙЛ. Ресторануудын НЭР бодит — нийтэд нээлттэй эх
   сурвалжаас (Tripadvisor, mongolexpats) 2026-08-26-нд цуглуулсан. Харин
   ҮНЭ, ЦЭС, ЦАГИЙН ХУВААРЬ нь ТААМАГЛАСАН тоо. Улаанбаатарын рестораны
   үнэ нийтэд нээлттэй өгөгдөл болж байршдаггүй.

   Тиймээс мөр бүр `verified: false`, `source: "seed-estimate"` гэж
   тэмдэглэгдсэн бөгөөд нүүрэн дээр "≈ баталгаажаагүй" гэж ИЛ харагдана.
   Админ /admin/restaurants дээр очиж жинхэнэ үнээ оруулаад
   "БАТАЛГААЖСАН" болгосны дараа л тэмдэг арилна.

   Байрлал нь нотлогдоогүй газруудын дүүргийг "Unknown" гэж үлдээсэн —
   таамаглаж бичвэл хүнийг буруу дүүрэг рүү илгээнэ. Дүүргийн шүүлтэд
   ороогүй ч бусад хайлтад хэвээр гарна.                                  */

const NOW = new Date();

function menu(base) {
  return [
    { name: "Samgyeopsal", nameMn: "Самгёпсаль", price: base + 2000, category: "bbq", servesPeople: 1 },
    { name: "Galbi", nameMn: "Кальби", price: base + 12000, category: "bbq", servesPeople: 1 },
    { name: "Bulgogi", nameMn: "Пулькоги", price: base + 5000, category: "bbq", servesPeople: 1 },
    { name: "Kimchi jjigae", nameMn: "Кимчи жигэ", price: base - 8000, category: "soup", spicy: true },
    { name: "Doenjang jjigae", nameMn: "Твенжан жигэ", price: base - 9000, category: "soup" },
    { name: "Sundubu jjigae", nameMn: "Сүндүбү жигэ", price: base - 8000, category: "soup", spicy: true },
    { name: "Bibimbap", nameMn: "Пибимпаб", price: base - 10000, category: "rice" },
    { name: "Naengmyeon", nameMn: "Нэнмён", price: base - 9000, category: "noodle" },
    { name: "Japchae", nameMn: "Жапчэ", price: base - 6000, category: "noodle" },
    { name: "Tteokbokki", nameMn: "Ттокпокки", price: base - 12000, category: "side", spicy: true },
    { name: "Samgyetang", nameMn: "Самгетан", price: base + 2000, category: "soup" },
  ];
}

const SEED = [
  {
    name: "Yuna Korean Restaurant", nameMn: "Юна", slug: "yuna-korean",
    district: "Unknown", address: "Улаанбаатарт 12 салбартай — салбарын хаягийг гараар оруулна уу",
    cuisine: ["Korean"], tags: ["chain", "family", "modern"],
    pricePerPerson: 38000, parking: true, soloFriendly: true, delivery: false, reservation: true,
    hours: { open: "10:00", close: "22:00" }, rating: 4.7,
    note: "Монгол дахь хамгийн том солонгос сүлжээ ресторан, 12 салбартай. Самгетан, бяслагтай кимчи-пёкком нь онцлог.",
    menu: menu(30000),
  },
  {
    name: "Sura Korean Restaurant (Bluemon)", nameMn: "Сура · Блюмон", slug: "sura-bluemon",
    district: "Sukhbaatar", address: "Самбуугийн гудамж, Bluemon Center, 4 давхар",
    cuisine: ["Korean"], tags: ["classic", "group"],
    pricePerPerson: 36000, parking: false, soloFriendly: true, delivery: false, reservation: true,
    hours: { open: "11:00", close: "22:00" }, rating: 4.3,
    note: "2013 оноос үйл ажиллагаа явуулдаг. Тухтай суудал, том порц.",
    menu: menu(29000),
  },
  {
    name: "Sura Korean Restaurant (Tsengeldekh)", nameMn: "Сура · Цэнгэлдэх", slug: "sura-tsengeldekh",
    district: "Khan-Uul", address: "Наадамын талбайн урд, Цэнгэлдэх худалдааны төв, 1 давхар",
    cuisine: ["Korean"], tags: ["classic", "group"],
    pricePerPerson: 36000, parking: true, soloFriendly: true, delivery: false, reservation: true,
    hours: { open: "11:00", close: "22:00" }, rating: 4.3,
    note: "Сура-гийн Хан-Уул дахь салбар.",
    menu: menu(29000),
  },
  {
    name: "Sky Korean Restaurant", nameMn: "Скай", slug: "sky-korean",
    district: "Sukhbaatar", address: "Энх тайвны өргөн чөлөө, Kyokushu Tower, 14 давхар",
    cuisine: ["Korean"], tags: ["view", "tang", "house-kimchi"],
    pricePerPerson: 42000, parking: false, soloFriendly: true, delivery: false, reservation: true,
    hours: { open: "11:00", close: "22:00" }, rating: 4.4,
    note: "Кимчигээ өөрсдөө хийдэг. Догани-тан, Кальби-тан 15 цаг буцалгадаг. Ширээ бүр цонхтой, Энх тайвны өргөн чөлөө харагдана.",
    menu: menu(33000),
  },
  {
    name: "Zaisan Samgyeopsal", nameMn: "Зайсан Самгёпсаль", slug: "zaisan-samgyeopsal",
    district: "Khan-Uul", address: "Зайсан",
    cuisine: ["Korean", "BBQ"], tags: ["bbq", "samgyeopsal"],
    pricePerPerson: 35000, parking: true, soloFriendly: false, delivery: false, reservation: false,
    hours: { open: "11:00", close: "23:00" }, rating: 4.2,
    note: "Зайсан дахь самгёпсаль төрөлжсөн газар.",
    menu: menu(30000),
  },
  {
    name: "Zalaat BBQ", nameMn: "Залаат BBQ", slug: "zalaat-bbq",
    district: "Unknown", address: "",
    cuisine: ["Korean", "BBQ"], tags: ["bbq", "charcoal", "authentic", "soju"],
    pricePerPerson: 40000, parking: false, soloFriendly: false, delivery: false, reservation: false,
    hours: { open: "12:00", close: "23:00" }, rating: 4.5,
    note: "Нүүрсэн галан дээр шардаг жинхэнэ самгёпсаль. Солонгосчууд өөрсдөө ирдэг, үргэлж хөл хөдөлгөөнтэй.",
    menu: menu(32000),
  },
  {
    name: "Kyung Bok Gung", nameMn: "Кёнбоккун", slug: "kyung-bok-gung",
    district: "Unknown", address: "",
    cuisine: ["Korean", "BBQ"], tags: ["bbq", "charcoal", "family-run", "bulgogi", "kalbi"],
    pricePerPerson: 39000, parking: false, soloFriendly: true, delivery: false, reservation: false,
    hours: { open: "11:00", close: "22:00" }, rating: 4.0,
    note: "Гэр бүлийн эзэмшлийн газар. Модны нүүрсэн грилл — пулькоги, кальби нь онцлог.",
    menu: menu(31000),
  },
  {
    name: "ANSAN Korean Restaurant", nameMn: "Ансан", slug: "ansan-korean",
    district: "Unknown", address: "",
    cuisine: ["Korean"], tags: ["homestyle"],
    pricePerPerson: 32000, parking: false, soloFriendly: true, delivery: false, reservation: false,
    hours: { open: "11:00", close: "22:00" }, rating: 5.0,
    note: "Жижиг, гэрийн маягийн солонгос хоолны газар.",
    menu: menu(27000),
  },
  {
    name: "Seoul Restaurant", nameMn: "Сөүл", slug: "seoul-restaurant",
    district: "Unknown", address: "",
    cuisine: ["Korean", "BBQ", "Asian"], tags: ["upscale", "mixed-menu"],
    pricePerPerson: 45000, parking: true, soloFriendly: true, delivery: false, reservation: true,
    hours: { open: "11:00", close: "22:00" }, rating: 4.1,
    note: "Солонгос, хятад, япон, барууны хоол хосолсон. Арай өндөр зэрэглэлийн.",
    menu: menu(34000),
  },
  {
    name: "Koreabull", nameMn: "Кореабулл", slug: "koreabull",
    district: "Unknown", address: "",
    cuisine: ["Korean", "BBQ"], tags: ["bbq", "kimchi"],
    pricePerPerson: 34000, parking: false, soloFriendly: true, delivery: false, reservation: false,
    hours: { open: "11:00", close: "22:00" },
    note: "Кимчи нь сайн гэж иргэдийн сэтгэгдэлд дурдагддаг.",
    menu: menu(29000),
  },
];

let created = 0, skipped = 0;
for (const r of SEED) {
  if (db.restaurants.findOne({ slug: r.slug })) { skipped++; continue; }
  db.restaurants.insertOne({
    ...r,
    verified: false,          // ← үнэ таамагласан. Админ шалгаад л асаана.
    lastVerified: null,
    source: "seed-estimate-2026-08-26",
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    __v: 0,
  });
  created++;
}
print(`seeded: ${created} created, ${skipped} already existed, total=${db.restaurants.countDocuments({})}`);
