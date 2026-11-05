// ─── Нүүр хуудасны их биеийн хэсгүүдийн жагсаалт (зөвхөн мета) ───
// Админ талд ашиглана. Компонентуудыг өөрсдийг нь components/HomeSections.tsx
// холбоно — ингэснээр админы bundle рүү бүх хүнд компонент чирэгдэхгүй.

export type HomeSectionKey =
  | "announcements"
  | "founding"
  | "journey"
  | "briefing"
  | "reels"
  | "clients"
  | "manifesto"
  | "tools";

export const HOME_SECTION_META: { key: HomeSectionKey; label: string; hint: string }[] = [
  { key: "manifesto", label: "Манифест", hint: "Үүсгэн байгуулагчийн үг — доорх талбараас" },
  { key: "announcements", label: "Зарлал",              hint: "/admin/news дэх зарлалууд" },
  { key: "founding",      label: "Founding 100",        hint: "Эхний 100 гишүүний тэмдэг" },
  { key: "journey",       label: "Аяллын самбар",       hint: "7 хоногийн замын зураг" },
  { key: "briefing",      label: "AI брифинг",          hint: "Өдрийн AI мэдээ" },
  { key: "reels",         label: "Instagram reels",     hint: "Instagram-ийн сүүлийн бичлэгүүд" },
  { key: "clients",       label: "Үйлчлүүлэгчид",       hint: "/admin/clients дэх лого/жагсаалт" },
  { key: "tools",         label: "Хэрэгсэл",            hint: "/admin/homepage-cards → ХЕРЕГСЕЛ картууд" },
];
