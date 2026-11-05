/* ─── Бүтээгдэхүүний студи — бэлэн загварууд (2026-10-24, v2) ─────────────
   Клиент ба сервер хоёулаа импортлоно (зөвхөн тогтмол утга, цэвэр функц).
   v2: АНГИЛАЛ (хувцас / хоол / гоо сайхан / технологи / гэр / гоёл) — тус бүр өөрийн
   загвартай; «ХЭСЭГ» — vision агент зурган дахь эд зүйлсийг (кардиган, жинс, пүүз…)
   нэрлэж, хэрэглэгч товшиж сонгоно → промптод яг тэр зүйлийн нарийн тодорхойлолт орно;
   «МИНИЙ ДҮР» — биеийн зургаас ref sheet, try-on / кампанит ажилд 1-р зураг болж орно.
   Бүгдийг Higgsfield дээр бодит зургаар туршсан (Flare = GPT Image 2.5 засвар). */

export type Category = "clothing" | "food" | "beauty" | "tech" | "home" | "jewelry" | "other";
export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "clothing", label: "Хувцас" }, { id: "food", label: "Хоол, хүнс" }, { id: "beauty", label: "Гоо сайхан" },
  { id: "tech", label: "Технологи" }, { id: "home", label: "Гэр, тавилга" }, { id: "jewelry", label: "Гоёл, цаг" }, { id: "other", label: "Бусад" },
];
/** person — «Миний дүр» сонгосон (1-р зураг = дүрийн sheet, 2-р = бүтээгдэхүүн) */
export type PromptVars = { item: string; whole: boolean; cat: Category; person: boolean };
export type ImagePreset = {
  id: string; label: string; desc: string; model: "flare" | "qwenEdit"; ratio: string; quality: "low" | "medium" | "high";
  cats: Category[] | "all"; tag: "cut" | "studio" | "creative" | "persona";
  /** need — заавал «Миний дүр»; optional — сонгосон бол хүнийг нь ашиглана */
  persona?: "need" | "optional";
  prompt: (v: PromptVars) => string;
};
export type MotionPreset = { id: string; label: string; desc: string; cats: Category[] | "all"; prompt: string };

/** Сонгосон хэсэг байхгүй үеийн анхдагч объект */
export function defaultItem(cat: Category): string {
  return cat === "clothing" ? "the complete outfit" : cat === "food" ? "the dish exactly as served" : "the main product";
}
const KEEP = "Keep the exact shape, colors, materials, texture, pattern, stitching, labels, logos and proportions — do not invent, add or change any detail.";
/** Хүнтэй загвар: 1-р зураг = дүрийн ref sheet, 2-р зураг = бүтээгдэхүүн */
const PERSON = "the exact person from image 1 (identical face, hairstyle, skin tone and body proportions)";

export const IMAGE_PRESETS: ImagePreset[] = [
  /* ── салгах ── */
  { id: "extract", tag: "cut", cats: "all", label: "Салгах (цагаан дэвсгэр)", desc: "Сонгосон хэсгийг алдаагүй салгана · 1:1", model: "flare", ratio: "1:1", quality: "medium",
    prompt: ({ item, whole, cat }) => cat === "clothing" && whole
      ? "Extract clothing from the image, isolate the outfit only, no model, no face, no body, plain white background, product image style, 1:1 aspect ratio, sharp details, clean edges. " + KEEP
      : cat === "clothing"
      ? `Extract ONLY ${item} from the image. Isolate it completely: no model, no face, no body, no other garments, shoes or accessories. Plain pure white background, product image style, 1:1 aspect ratio, sharp details, clean edges. ${KEEP}`
      : cat === "food"
      ? `Isolate ONLY ${item} from the image on a plain pure white background, keeping the food exactly as it is — same ingredients, portion, arrangement and the same plate or bowl. Clean edges, soft natural contact shadow, appetizing true-to-life color, 1:1, sharp.`
      : `Isolate ONLY ${item}: remove the background, people, hands and clutter. Plain pure white background, centered e-commerce packshot, soft natural contact shadow, 1:1, sharp details, clean edges. ${KEEP}` },
  { id: "refsheet", tag: "cut", cats: "all", label: "Бүтээгдэхүүний ref sheet", desc: "Урд, ар, хажуу, ойрын дэлгэрэнгүй · нэг хуудсанд", model: "flare", ratio: "3:2", quality: "medium",
    prompt: ({ item, cat }) => cat === "food"
      ? `Create a food reference sheet of ${item} from the image: top-down view, 45-degree view, side view and two close-up texture details, each on clean white, arranged in a neat grid, the food identical in every view, no text.`
      : `Create a professional product reference sheet of ${item} from the image: front view, back view, side view, three-quarter view and two close-up detail crops (texture, label or logo, hardware), each on clean white, arranged in a neat grid, identical design, colors and details across every view, no people, no text. ${KEEP}` },

  /* ── хувцас ── */
  { id: "ghost", tag: "studio", cats: ["clothing"], label: "Ghost mannequin", desc: "Хүнгүй, гэхдээ өмссөн мэт 3D хэлбэр", model: "flare", ratio: "4:5", quality: "medium",
    prompt: ({ item }) => `Invisible ghost-mannequin product photo of ${item}: the garment holds a natural 3D worn shape with no person visible, front view, seamless light-grey studio background, soft even lighting, crisp fabric texture. ${KEEP}` },
  { id: "flatlay", tag: "studio", cats: ["clothing"], label: "Flat lay", desc: "Дээрээс нь цэгцтэй дэлгэсэн", model: "flare", ratio: "4:5", quality: "medium",
    prompt: ({ item }) => `Styled top-down flat lay of ${item} neatly arranged on a warm linen background with soft natural window light and gentle shadows, minimal tasteful props, premium fashion e-commerce. ${KEEP}` },
  { id: "tryon", tag: "persona", cats: ["clothing"], persona: "need", label: "Миний дүр өмсөнө", desc: "Таны ref sheet-ийн хүн энэ хувцсыг өмсөнө", model: "flare", ratio: "3:4", quality: "medium",
    prompt: ({ item }) => `Full-body fashion photo of ${PERSON} wearing ${item} from image 2 (identical design, colors, trim and details). Natural confident pose on a minimal modern Ulaanbaatar city street, golden-hour light, editorial magazine quality, 3:4.` },
  { id: "editorial", tag: "creative", cats: ["clothing", "jewelry", "beauty"], persona: "optional", label: "Fashion кампанит ажил", desc: "Брэндийн кампанит зураг", model: "flare", ratio: "4:5", quality: "medium",
    prompt: ({ item, person }) => `High-end fashion campaign photo: ${person ? PERSON : "a stylish Mongolian model"} wears or uses ${item}${person ? " from image 2" : ""} (identical design, color and details) in a minimal architectural setting, soft directional light, editorial composition, magazine quality, 4:5.` },
  { id: "h3d", tag: "creative", cats: ["clothing", "other"], persona: "optional", label: "3D hyperreal дүр", desc: "MetaHuman CG · кино гэрэлтүүлэг", model: "qwenEdit", ratio: "3:4", quality: "medium",
    prompt: ({ item, person }) => `Stylized hyperreal 3D character render, MetaHuman-grade CG cinematic, path-traced quality. Re-create ${person ? `${PERSON}, wearing ${item} from image 2,` : "the subject"} as a 3D video-game cinematic character (Unreal Engine 5 MetaHuman): CG skin shader, sculpted stylized features, cinematic rim light, depth of field, dark charcoal studio background. Full body, ${person ? "confident pose" : "same pose"} and identical outfit or product. It must read as a 3D render, not a photo.` },

  /* ── хоол ── */
  { id: "food_hero", tag: "studio", cats: ["food"], label: "Амттай харагдуулах", desc: "Уур, гялбаа, дулаан гэрэл", model: "flare", ratio: "4:5", quality: "medium",
    prompt: ({ item }) => `Make ${item} look irresistibly delicious for a restaurant advertisement. Keep the real food identical: same food, same number of pieces, same shape and the same plate — do not add or remove food. Glistening fresh surface, a few wisps of steam if it is hot, warm golden side light with soft shadows, shallow depth of field, rustic dark wooden table, subtle fitting props (sauce, fresh herbs), mouth-watering, 4:5, ultra sharp.` },
  { id: "food_top", tag: "studio", cats: ["food"], label: "Дээрээс (flat lay)", desc: "Орц найрлагатай нь дээрээс", model: "flare", ratio: "1:1", quality: "medium",
    prompt: ({ item }) => `Top-down overhead food photo of ${item} (identical food and plating) on a textured stone surface, surrounded by a few of its fresh raw ingredients artfully scattered, bright natural daylight, crisp shadows, vibrant appetizing colors, 1:1.` },
  { id: "food_menu", tag: "studio", cats: ["food"], label: "Цэсний зураг", desc: "Бараан, тансаг ресторан", model: "flare", ratio: "4:5", quality: "medium",
    prompt: ({ item }) => `Fine-dining menu photo of ${item} (identical food, portion and plating) on a dark slate background, dramatic low-key spotlight, glossy highlights, elegant negative space, premium restaurant menu style, 4:5.` },

  /* ── гоо сайхан, технологи, гэр, гоёл ── */
  { id: "beauty_splash", tag: "creative", cats: ["beauty"], label: "Шингэн цацралт", desc: "Ус, текстур, цэвэр гэрэл", model: "flare", ratio: "4:5", quality: "medium",
    prompt: ({ item }) => `Premium cosmetics ad: ${item} (identical packaging, label and color) standing in a crystal-clear water splash with a creamy texture swatch beside it, soft pastel background, fresh clean light, high-end beauty campaign, 4:5. ${KEEP}` },
  { id: "tech_dark", tag: "studio", cats: ["tech"], label: "Бараан premium", desc: "Хар студи, ирмэгийн гэрэл", model: "flare", ratio: "4:5", quality: "medium",
    prompt: ({ item }) => `Premium tech product hero shot of ${item} (identical design, ports, buttons and logo) on a matte black studio set, cool rim light tracing its edges, subtle reflections on a glossy floor, Apple-style minimal advertising, 4:5. ${KEEP}` },
  { id: "home_room", tag: "creative", cats: ["home"], label: "Интерьерт", desc: "Загварлаг өрөөнд", model: "flare", ratio: "4:5", quality: "medium",
    prompt: ({ item }) => `Place ${item} (identical design, color, material and size) in a beautifully styled modern Mongolian apartment interior, natural window light, warm cozy atmosphere, interior design magazine photo, 4:5. ${KEEP}` },
  { id: "jewel_macro", tag: "studio", cats: ["jewelry"], label: "Макро гялбаа", desc: "Хилэн дээр ойроос", model: "flare", ratio: "1:1", quality: "medium",
    prompt: ({ item }) => `Luxury macro jewelry photo of ${item} (identical design, stones and metal) resting on deep velvet, sparkling highlights, precise focus, soft vignette, high-end jewelry catalog, 1:1. ${KEEP}` },

  /* ── бүх ангилал ── */
  { id: "studio", tag: "studio", cats: ["clothing", "beauty", "tech", "home", "jewelry", "other"], label: "Premium студи", desc: "Тансаг каталог · бежевэн дэвсгэр", model: "flare", ratio: "1:1", quality: "medium",
    prompt: ({ item }) => `Premium e-commerce hero shot of ${item} on a seamless warm-beige studio backdrop, soft diffused key light, gentle contact shadow, subtle reflection, luxury brand catalog look, 1:1, ultra sharp. ${KEEP}` },
  { id: "lifestyle", tag: "creative", cats: "all", persona: "optional", label: "Амьдралын орчинд", desc: "Бодит орчинд хэрэглэж буй", model: "flare", ratio: "4:5", quality: "medium",
    prompt: ({ item, cat, person }) => cat === "food"
      ? `Authentic lifestyle photo: friends enjoying ${item} (identical food) at a cozy Ulaanbaatar cafe table, warm natural light, candid joyful mood, appetizing, 4:5.`
      : person
      ? `Authentic lifestyle advertising photo of ${PERSON} naturally using or wearing ${item} from image 2 (identical design, colors, logo), modern Mongolian home or city context, natural light, shallow depth of field, 4:5.`
      : `Place ${item} (identical design, colors, logo) in an aspirational real-life scene where it is naturally used, modern Mongolian home or city context, natural light, shallow depth of field, authentic lifestyle advertising photo, 4:5.` },
  { id: "levitate", tag: "creative", cats: ["clothing", "beauty", "tech", "jewelry", "other"], label: "Хөвөх арт", desc: "Агаарт хөвөх сюрреал зураг", model: "flare", ratio: "1:1", quality: "medium",
    prompt: ({ item }) => `Surreal premium product art: ${item} levitates in mid-air above a sculptural pedestal, surrounded by floating geometric shapes and soft caustic light, pastel gradient background, high-end 3D advertising aesthetic, identical product design and colors, 1:1.` },
];

export const MOTION_PRESETS: MotionPreset[] = [
  { id: "spin", cats: ["clothing", "beauty", "tech", "home", "jewelry", "other"], label: "360° эргэлт", desc: "Тавцан дээр эргэлдэнэ", prompt: "Premium product video: the product slowly rotates 360 degrees like on a turntable on a clean background, soft light sweep glides across, gentle camera push-in, elegant commercial, no text." },
  { id: "steam", cats: ["food"], label: "Уур, амт", desc: "Уур савсаж, гэрэл гялбана", prompt: "Mouth-watering food video: gentle steam rises from the dish, glistening highlights shimmer, a slow cinematic push-in with shallow depth of field, warm golden light, appetizing restaurant commercial, no text." },
  { id: "pour", cats: ["food"], label: "Соус асгах", desc: "Удаан хөдөлгөөнөөр", prompt: "Slow-motion food commercial: a glossy sauce drizzles onto the dish, tiny droplets glisten, camera slowly orbits, warm side light, irresistibly delicious, no text." },
  { id: "float", cats: "all", label: "Хөвөх", desc: "Жингүй хөвж, гэрлийн тоос", prompt: "The product floats weightlessly with gentle bobbing motion, soft glowing particles and bokeh drift around it, dreamy premium advertisement, smooth slow motion, no text." },
  { id: "fabric", cats: ["clothing"], label: "Даавуу намирах", desc: "Хувцас салхинд намирна", prompt: "The garment ripples and sways in a soft breeze as if worn by an invisible mannequin, fabric texture moving naturally, slow motion, clean studio light, premium fashion film, no text." },
  { id: "light", cats: "all", label: "Гэрлийн туяа", desc: "Харанхуйгаас гэрэлд гарна", prompt: "Cinematic luxury reveal: the product emerges from darkness as a sharp light sweep and lens glint glide across its surface, slow dolly in, high-end commercial, no text." },
  { id: "hype", cats: "all", label: "Hype энерги", desc: "Хурдан, хүчтэй reveal", prompt: "Explosive high-energy product reveal: dynamic camera whip-pan, energetic light streaks and particles burst around the product, punchy ad style, fast but smooth, no text." },
  { id: "push", cats: "all", label: "Камер ойртох", desc: "Удаан, кино шиг ойртоно", prompt: "Slow cinematic dolly push-in toward the product, shallow depth of field, subtle parallax, elegant hero shot, premium film look, no text." },
];

export const forCat = <T extends { cats: Category[] | "all" }>(list: T[], cat: Category) => list.filter((x) => x.cats === "all" || x.cats.includes(cat));

/** «Premium багц» — ангиллаар: эхний зураг → (бэлэн болмогц) хөдөлгөөн + нэмэлт зураг */
export function packFor(cat: Category): { first: string; then: string; also: string[] } {
  if (cat === "food") return { first: "food_hero", then: "steam", also: ["extract"] };
  return { first: "extract", then: "spin", also: ["studio"] };
}

/** Биеийн зургаас дүрийн ref sheet (Flare-ээр туршсан: 4 харагдац + ойрын хөрөг, энгийн хувцас) */
export const PERSONA_SHEET = "Create a professional character reference sheet of THIS EXACT PERSON. Preserve the face, facial features, hairstyle, skin tone, body shape and proportions precisely — identity must be unmistakable. Layout on one clean light-grey studio background: full-body front view, full-body three-quarter view, full-body side profile, full-body back view, and a large head-and-shoulders close-up portrait. Neutral relaxed standing pose. Plain fitted basics (white t-shirt, grey fitted trousers, white sneakers) so outfits can be swapped later. Soft even studio lighting, photorealistic, consistent identity across every view, no text, no labels.";
