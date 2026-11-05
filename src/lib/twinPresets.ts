/* ─── AI ихэр (character twin) — сонголтууд ба промпт (2026-10-24) ──────────
   Эзний «ANTAQOR IP: HEAD DESIGN LANGUAGE SHEET» промптоос хүн бүрт хэрэгтэй хэсгийг ерөнхийлсөн:
   · Image 1 = бодит зураг, нүүрний DNA-гийн үнэн эх сурвалж; нүүрийг 1:1 — «сайжруулсан», ерөнхий
     царай БИШ. · Агент зургаас «нүүрний DNA»-г (гавал, шанаа, хавтгай, хөмсөг, нүд, хамар, ам, чих)
     бичиж, хэрэглэгч засна. · 5 өнцгийн толгой — нэг 3D толгойн жинхэнэ эргэлт, оройн/хөмсөгний/
     нүдний/хамрын/эрүүний шугамаар тэгшилсэн, толин тусгал биш. · Нэг гэрлийн систем (хатуу key +
     өнгөт rim + нүдний catchlight). · MetaHuman / UE5 рендерийн блок. · AVOID жагсаалт.
   · «STYLIZATION AND BRAND LOCK» — стилийн лавлах зураг өгвөл тэр нь ерөнхий тайлбараас давамгайлна.
   Flare (GPT Image 2.5)-аар бодит зургаар туршсан: толгой (5 өнцөг), бие (4 өнцөг + нүүр + гар),
   скульптур, 5 зургаар (нүүр + 4 хувцас) хувцас өмсүүлэх — бүгд ажилласан. Клиент ба сервер хоёулаа. */

export type TwinStyle = "photo" | "hyper" | "sculpt" | "anim";
export type TwinPalette = "dark_blue" | "chroma_blue" | "studio_grey" | "brand";
export type TwinExpr = "calm" | "hunter" | "smile" | "neutral";
export type TwinSheet = "head" | "body" | "sculpt";

export const TWIN_STYLES: { id: TwinStyle; label: string; desc: string; example?: string }[] = [
  { id: "hyper", label: "Hyperreal 3D", desc: "MetaHuman · Unreal Engine 5 · кино CG", example: "/uploads/agent-assets/ex-head-body.jpg" },
  { id: "photo", label: "Бодит фото", desc: "Студийн гэрэл зураг — яг өөрөө" },
  { id: "sculpt", label: "3D скульптур", desc: "Саарал шавар (ZBrush) · пропорцын шугамтай", example: "/uploads/agent-assets/ex-sculpt.jpg" },
  { id: "anim", label: "Анимэйшн 3D", desc: "Киноны 3D дүр — бага зэрэг загварчилсан" },
];
export const TWIN_PALETTES: { id: TwinPalette; label: string; swatch: string[] }[] = [
  { id: "dark_blue", label: "Хар + цахилгаан цэнхэр", swatch: ["#0A0C12", "#1F6BFF"] },
  { id: "chroma_blue", label: "Цэнхэр студи", swatch: ["#1F45FF", "#FFFFFF"] },
  { id: "studio_grey", label: "Саарал студи", swatch: ["#7A7D84", "#FFFFFF"] },
  { id: "brand", label: "Брэндийн өнгө", swatch: ["#0A0C12", "#2E29FF"] },
];
export const TWIN_EXPRS: { id: TwinExpr; label: string }[] = [
  { id: "calm", label: "Тайван, итгэлтэй" }, { id: "hunter", label: "Хурц, шийдэмгий" }, { id: "smile", label: "Найрсаг инээмсэглэл" }, { id: "neutral", label: "Төвийг сахисан" },
];
export const TWIN_SHEETS: { id: TwinSheet; label: string; desc: string; example?: string }[] = [
  { id: "head", label: "Толгойн sheet", desc: "5 өнцөг: хажуу, ¾, урд, ¾, хажуу" },
  { id: "body", label: "Биеийн sheet", desc: "4 өнцөг + нүүр ойроос + гар", example: "/uploads/agent-assets/ex-body.jpg" },
  { id: "sculpt", label: "3D скульптур", desc: "Шавар толгой, 3 өнцөг, шугамтай", example: "/uploads/agent-assets/ex-sculpt.jpg" },
];
/** Анхдагч хувцас (эзний өгсөн) — ихрийг анхнаасаа эдгээрээр өмсүүлнэ */
export const DEFAULT_WARDROBE: { url: string; label: string; part: string }[] = [
  { url: "/uploads/agent-assets/wear-shirt-tie.jpg", label: "Цэнхэр цамц, хар зангиа", part: "top" },
  { url: "/uploads/agent-assets/wear-suit-jacket.jpg", label: "Саарал костюм, жилет", part: "outerwear" },
  { url: "/uploads/agent-assets/wear-trousers.jpg", label: "Саарал өмд", part: "bottom" },
  { url: "/uploads/agent-assets/wear-boots.jpg", label: "Хар гутал", part: "shoes" },
];

export type TwinProfile = { gender: string; age: string; eyeColor: string; hair: string; skin: string; build: string; dna: string };
/** styleText — стилийн лавлах зургийн РЕНДЕРИЙН үгэн тодорхойлолт (зургийг өөрийг нь загварт өгөхгүй) */
export type TwinInputs = { faces: string[]; bodies: string[]; hands: string[]; styleRef: string; outfit: string[]; styleText?: string };
export type TwinOpts = { style: TwinStyle; palette: TwinPalette; expr: TwinExpr; brandColor?: string; outfitLabels?: string[]; scene?: string };

const RENDER: Record<TwinStyle, string> = {
  hyper: "Stylized-real digital-human CGI in the style of MetaHuman and Unreal Engine 5, path-traced. Semi-matte skin with soft subsurface scattering and restrained pores, crisp grouped hair strands, fine film grain. Long lens, orthographic look, no distortion. A premium cinematic CG character sheet, not a photo and not a cartoon.",
  photo: "Photorealistic high-end studio photography, 85mm lens, natural skin texture and real hair, true-to-life color. A real photograph, not CGI, not a painting.",
  sculpt: "Neutral grey digital clay sculpture (ZBrush matcap): no color, no skin texture or pores, crisp sculpted planes, stylized sculpted hair clumps that follow the real hairstyle, soft studio light. Thin horizontal proportion guide lines across crown, brow, eyes, nose base, mouth and chin.",
  anim: "Stylized 3D animated-feature character (premium animation studio look): gently stylized proportions while keeping every recognizable feature of the person, soft global illumination, clean materials, appealing but faithful. Not photoreal, not anime, no outlines.",
};
const EXPR: Record<TwinExpr, string> = {
  calm: "Calm, relaxed and confident resting expression: eyebrows relaxed and level with NO furrow or frown lines between the brows, not angry, not squinting, lips closed, steady gaze.",
  hunter: "Resting HUNTER state: lids slightly lowered, brows low and level, gaze locked along the head's direction, lips closed — calm, intense, unstoppable, never angry.",
  smile: "Warm, friendly closed-mouth smile, relaxed brows, kind eyes.",
  neutral: "Neutral relaxed expression, passport-like, brows relaxed, lips closed.",
};
function light(p: TwinPalette, brand = "#2E29FF") {
  if (p === "chroma_blue") return { bg: "a seamless saturated electric-blue studio background (#1F45FF)", light: "Soft even studio key with a subtle white rim, consistent in every view. Natural skin tones, no blue cast on the face." };
  if (p === "studio_grey") return { bg: "a seamless mid-grey studio background (#7A7D84)", light: "Soft large key from front-left, gentle white rim, consistent in every view. Natural skin tones." };
  const rim = p === "brand" ? brand : "#1F6BFF";
  return { bg: "a seamless near-black background (#0A0C12)", light: `One light system for every view: a hard neutral-white key from front-above-left carving the cheekbone planes with crisp shadow edges, a hard-edged rim light (${rim}) along one side of each head, jaw and neck, a thin ${rim} catchlight in each eye, deep black falloff. Natural warm skin tones with no colored cast on the face.` };
}
/** Оролтын зургуудын дараалал (промпт дотор индексээр нь заана) */
export function twinImages(i: TwinInputs, withOutfit: boolean): { urls: string[]; legend: string; outfitIdx: string } {
  const urls: string[] = []; const parts: string[] = [];
  const add = (list: string[], what: string) => { if (!list.length) return; const a = urls.length + 1; urls.push(...list); parts.push(`${list.length > 1 ? `Images ${a}–${urls.length}` : `Image ${a}`}: ${what}`); };
  add(i.faces.slice(0, 2), "real face photo(s) — the ground truth for facial DNA");
  add(i.bodies.slice(0, 1), "full-body photo — ground truth for body proportions and build");
  add(i.hands.slice(0, 1), "photo of the hands — ground truth for hand shape and skin");
  let outfitIdx = "";
  if (withOutfit && i.outfit.length) { const a = urls.length + 1; add(i.outfit.slice(0, 4), "outfit items to wear"); outfitIdx = i.outfit.length > 1 ? `images ${a}–${urls.length}` : `image ${a}`; }
  return { urls, legend: parts.join(". ") + ".", outfitIdx };
}
/* 2026-10-24 туршилт: стилийн лавлах ЗУРГИЙГ загварт өгөхөд («sheet» маягийн зураг) загвар түүний
   ЗОХИОМЖ, саарал дэвсгэр, бичгийг хуулж, хүссэн layout / өнгө / орчныг үл тоосон — «зөвхөн рендерийг»
   гэсэн заавар ч хангалтгүй байсан. Тиймээс зургийг vision-оор нэг удаа ҮГЭЭР тодорхойлж (styleText),
   зөвхөн тэр текстийг толгой / биеийн sheet-д түгжинэ. Скульптур, орчинтой зурагт хэрэглэхгүй. */
const STYLE_LOCK = (t: string) => `STYLIZATION AND BRAND LOCK — render in exactly this style: ${t} (style only; layout, background and light exactly as described here).`;
const AVOID = "AVOID: beauty retouching, narrowing or slimming the face, generic model faces, bigger eyes, changing eye color, changing hairstyle, anime, outlines, text, labels, numbers, logos, watermarks.";

export function twinPrompt(kind: TwinSheet | "outfit" | "photo", p: TwinProfile, i0: TwinInputs, o: TwinOpts): { prompt: string; urls: string[]; ratio: string } {
  /* стилийн түгжээ зөвхөн толгой / биеийн / хувцасны sheet-д */
  const i = kind === "sculpt" || kind === "photo" ? { ...i0, styleText: "" } : i0;
  const img = twinImages(i, kind === "body" || kind === "outfit" || kind === "photo");
  const lt = light(o.palette, o.brandColor);
  const id = `IDENTITY: ${p.gender}, ${p.age}; eyes ${p.eyeColor}; hair ${p.hair}; skin ${p.skin}${p.build ? `; build ${p.build}` : ""}.\nFACIAL DNA (match exactly, from the real photos):\n${p.dna}`;
  const head = `${img.legend} Keep the face recognizable 1:1 — never an improved, beautified or generic version.\n${id}`;
  const lock = i.styleText ? `\n${STYLE_LOCK(i.styleText)}` : "";
  const noText = "No text, labels, captions, numbers or color swatches anywhere in the image.";
  const outfit = img.outfitIdx ? `exactly the clothes from ${img.outfitIdx}${o.outfitLabels?.length ? ` (${o.outfitLabels.join(", ")})` : ""} — identical colors, fabrics, cut and details, worn naturally together` : "plain grey cotton hoodie, black slim pants and white sneakers";
  if (kind === "head") return { ratio: "16:9", urls: img.urls, prompt: `${head}\nLAYOUT: head and neck only, no clothing, on ${lt.bg}. One row of five true rotations of one 3D head at identical scale, aligned on shared crown, brow, eye, nose and chin lines: left profile, three-quarter left, front (largest), three-quarter right, right profile. Never mirrored; hair direction stays consistent and each ear is correct; the face width must read clearly in the front and three-quarter views.\nEXPRESSION: ${EXPR[o.expr]}\nLIGHT: ${lt.light}\nRENDER: ${RENDER[o.style]}${lock}\n${noText}\n${AVOID}` };
  if (kind === "sculpt") return { ratio: "3:2", urls: img.urls, prompt: `${head}\nDigital sculpture of this exact person's head and neck: three views in one row — three-quarter left, front, three-quarter right — at identical scale.\nEXPRESSION: ${EXPR[o.expr]}\nRENDER: ${RENDER.sculpt} Plain mid-grey background.\n${AVOID}` };
  if (kind === "photo") return { ratio: "3:4", urls: img.urls, prompt: `LOCATION (the whole frame, NOT a studio or plain backdrop): ${o.scene?.trim() || "a minimal modern Ulaanbaatar street at golden hour"}. The environment is clearly visible all around and behind the person, with matching natural light.\n${head}\nA single full-body ${o.style === "photo" ? "editorial photograph" : "cinematic character render"} of this exact person standing in that location, wearing ${outfit}. Natural confident pose.\nEXPRESSION: ${EXPR[o.expr]}\nRENDER: ${RENDER[o.style === "sculpt" ? "hyper" : o.style]}${lock}\n${AVOID}` };
  return { ratio: "1:1", urls: img.urls, prompt: `${head}\nCreate a character turnaround sheet of this exact person on ${lt.bg}. Top row: four full-body views at identical scale — front, three-quarter, side profile, back — relaxed neutral standing pose, arms slightly away from the body. Bottom row: front face close-up, three-quarter face close-up, and both hands (back of the hands) close-up.\nOUTFIT: ${outfit}.\nEXPRESSION: ${EXPR[o.expr]}\nLIGHT: ${lt.light}\nRENDER: ${RENDER[o.style === "sculpt" ? "hyper" : o.style]}${lock}\n${noText}\n${AVOID}` };
}
