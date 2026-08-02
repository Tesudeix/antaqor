// Shared catalog for the AI image generator tool — keeps the page and the API
// route in sync on which styles and aspect ratios are offered.

export interface ImageStyle {
  id: string;
  label: string;
  blurb: string;
  suffix: string; // appended to the user prompt
}

export const IMAGE_STYLES: ImageStyle[] = [
  { id: "auto",     label: "Auto",       blurb: "AI өөрөө",         suffix: "" },
  { id: "photo",    label: "Реалистик",  blurb: "Гэрэл зураг",       suffix: ", photorealistic, ultra detailed, sharp focus, professional photography, natural lighting" },
  { id: "cinematic",label: "Кино",       blurb: "Драматик",          suffix: ", cinematic shot, dramatic lighting, anamorphic lens, film grain, ultra detailed" },
  { id: "anime",    label: "Аниме",      blurb: "Studio ghibli",     suffix: ", anime style, vibrant colors, soft shading, studio ghibli inspired" },
  { id: "3d",       label: "3D",         blurb: "Octane render",     suffix: ", 3D render, octane, blender, ultra detailed, soft shadows" },
  { id: "neon",     label: "Неон",       blurb: "Cyberpunk",         suffix: ", neon lights, cyberpunk aesthetic, glowing pink and purple, futuristic, high contrast" },
  { id: "minimal",  label: "Минимал",    blurb: "Vector flat",       suffix: ", minimal flat illustration, clean shapes, soft pastel palette, vector style" },
  { id: "product",  label: "Бүтээгдэхүүн", blurb: "White background", suffix: ", product photography, plain white background, soft studio lighting, sharp details, clean edges" },
];

export interface AspectRatio {
  id: string;
  label: string;
  w: number;
  h: number;
  hint: string;
  // Tailwind aspect class so the result tile previews at the correct shape
  cls: string;
}

export const ASPECT_RATIOS: AspectRatio[] = [
  { id: "1:1",  label: "1:1",  w: 1, h: 1,  hint: "1:1 square aspect ratio",                   cls: "aspect-square" },
  { id: "16:9", label: "16:9", w: 16, h: 9, hint: "16:9 widescreen aspect ratio",              cls: "aspect-video" },
  { id: "9:16", label: "9:16", w: 9, h: 16, hint: "9:16 vertical mobile portrait aspect ratio", cls: "aspect-[9/16]" },
  { id: "4:3",  label: "4:3",  w: 4, h: 3,  hint: "4:3 landscape aspect ratio",                cls: "aspect-[4/3]" },
  { id: "3:4",  label: "3:4",  w: 3, h: 4,  hint: "3:4 portrait aspect ratio",                 cls: "aspect-[3/4]" },
];

export function findStyle(id: string): ImageStyle {
  return IMAGE_STYLES.find((s) => s.id === id) || IMAGE_STYLES[0];
}

export function findAspect(id: string): AspectRatio {
  return ASPECT_RATIOS.find((a) => a.id === id) || ASPECT_RATIOS[0];
}

// Build the final prompt sent to Gemini.
// Gemini doesn't enforce exact dimensions, but the aspect-ratio hint biases
// the composition. The style suffix biases the visual treatment.
export function buildFinalPrompt(userPrompt: string, styleId: string, aspectId: string): string {
  const style = findStyle(styleId);
  const aspect = findAspect(aspectId);
  return `${userPrompt.trim()}${style.suffix}, ${aspect.hint}`;
}
