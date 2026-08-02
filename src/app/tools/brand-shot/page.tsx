"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const NEON = "#1080CA";

// Opinionated prompt — locks the output style so the user only has to drop
// an image and click. Mentions pink, 3D stylization, studio quality, and
// hard-bans extras.
const BRAND_PROMPT = `Extract the main subject/product from this reference image with clean cut-out edges. Place it perfectly centered on a vibrant brand-pink (#1080CA, magenta) seamless studio backdrop with a subtle soft radial gradient — slightly brighter behind the subject, falling off into deeper magenta at the corners. Render in premium 3D-stylized product photography: photoreal physical materials, sharp clean key light from front-top-left, soft natural rim light, soft realistic drop shadow under the subject, slight glossy floor reflection in matching pink. Square 1:1 framing, magazine-cover hero product shot quality. The pink backdrop and floor are one continuous gradient. No text overlay, no extra props, no watermarks, no extra people or objects.`;

// ─── Character Sheet — full AAA-grade reference-sheet prompt ─────────────
// 3 reference images expected, in this exact order:
//   1. Face (identity)
//   2. Wardrobe (clothing to copy)
//   3. Physique (body type to match)
// Output: single composition with close-up + 4-view head + 4-view body.
const CHARACTER_SHEET_PROMPT = `Professional character reference sheet, AAA game production / VFX pipeline grade, single composition, pure white seamless studio background, evenly lit throughout, photorealistic.

═══════════════════════════════════════════════
SUBJECT
═══════════════════════════════════════════════

Person matching the face and identity of the first reference image, with body proportions matching the third reference image, wearing the wardrobe shown in the second reference image.

═══════════════════════════════════════════════
IDENTITY (face — first reference)
═══════════════════════════════════════════════

Same face across every render. Match precisely:
- Exact facial proportions, bone structure, muscle topology
- Identical eye shape, iris color, eyelid geometry
- Same nose bridge, tip, nostril structure
- Same lip shape, philtrum, mouth corners
- Same jawline, chin, cheekbone structure
- Same hairline, brow shape, ear structure
- Same skin tone, undertones, natural marks
- Identical hairstyle, length, density across all nine views

═══════════════════════════════════════════════
PHYSIQUE (body — third reference)
═══════════════════════════════════════════════

Tall, lean, naturally athletic — runner or fashion model build, NOT gym-built, NOT bulky.

- Height: ~7.5-8 head-heights, reads as 180cm / 5'11"
- Shoulders: moderately broad, naturally squared, ~1.6x head width
- Torso: clean V-taper, ~1.4:1 shoulder-to-waist, lean chest
- Waist: narrow, lean midsection
- Hips: narrow, no flare
- Arms: long and lean, wrists fall at mid-thigh, defined but slim biceps, tapered forearms
- Hands: long fingers, masculine, proportional
- Legs: long, ~53% of total height, runner's thighs, slim defined calves, clean ankle taper
- Posture: upright, relaxed, natural slight asymmetry, NOT T-pose, NOT mannequin

Silhouette reads as fashion-model / K-drama lead — confident lean editorial build.

═══════════════════════════════════════════════
WARDROBE (clothing — second reference)
═══════════════════════════════════════════════

Classic editorial business attire, formal pieces worn with intentional looseness:

SHIRT: Crisp white dress shirt, classic button-down placket, structured point collar, long sleeves with buttoned cuffs, tailored slim fit through torso, tucked into trousers. Clean white cotton, no patterns, subtle natural fabric texture, professional shirt-weight cotton.

TIE: Slim-cut solid black tie, ~5cm width, deliberately loosened at the knot — not perfectly tight, sits slightly below the collar opening for an editorial casual-formal feel. Matte silk finish, no patterns.

JACKET: Black structured slim-fit blazer worn open over the shirt, sharp notched lapels, single-breasted, tailored to the lean V-taper torso, sleeves end at the wrist. Matte structured wool finish. Clean lines, no logos, no patterns.

TROUSERS: Dark charcoal-black slim-fit dress trousers, flat-front, tailored to follow the lean leg taper, full break or slight break at the shoe, matte wool finish.

SHOES: Black polished leather dress shoes, classic oxford or derby silhouette, clean low-profile, no decoration.

Overall wardrobe vibe: editorial executive / loose-tie anti-hero / Tom Ford campaign / GQ editorial — formal pieces worn confidently and slightly undone.

═══════════════════════════════════════════════
SHEET COMPOSITION
═══════════════════════════════════════════════

Three clearly defined sections in one image, separated by clean white space, professional turnaround sheet layout:

[SECTION 1 — UPPER LEFT — FACIAL CLOSE-UP]
Large hyper-detailed portrait, shoulders-up framing showing the white shirt collar, loosened black tie knot, and open blazer lapels. Neutral expression, direct gaze at camera. 85mm focal length, sharp focus on iris, full face in focus. Authentic pore detail, fine vellus facial hair, natural skin undertones, no retouching.

[SECTION 2 — UPPER RIGHT — HEAD TURNAROUND]
Four head studies in a clean horizontal row, evenly spaced:
1. Front view (direct frontal)
2. Three-quarter view (45 degrees rotated)
3. Side profile (clean 90 degrees)
4. Back view (rear of head)

All four heads at identical scale, identical lighting angle, identical hairstyle and density. Shows shirt collar and tie knot in front views, collar curving around neck in profile and back views.

[SECTION 3 — LOWER HALF — FULL-BODY TURNAROUND]
Four full-body standing views in horizontal row, same sequence: front, three-quarter, side profile, back. Subject stands relaxed, arms naturally at sides, feet shoulder-width, weight evenly distributed, slight natural asymmetry — NOT stiff T-pose.

The full business wardrobe is identical across all four views:
- Same white shirt, same tuck, same buttoning
- Same black tie at same loosened position (visible in front and three-quarter, edge-visible in profile, hidden in back)
- Same open black blazer with same lapel position and same drape
- Same charcoal-black trousers with same break at the shoes
- Same black dress shoes

Realistic fabric behavior: shirt cotton drapes naturally with soft folds at the elbows when arms hang, blazer wool holds structured shape, trousers fall straight with natural creases behind the knees, tie hangs naturally with subtle silk movement.

═══════════════════════════════════════════════
LIGHTING + TECHNICAL
═══════════════════════════════════════════════

Soft neutral even studio lighting, no harsh shadows on white background, no color cast on white shirt. Editorial production photography. Shot on Sony A1, 85mm f/4 for close-up, 50mm f/5.6 for full-body, razor-sharp focus, scan-grade fidelity.

Reference quality: Sports Illustrated portrait, Tom Ford editorial campaign, Weta Workshop character scan.

═══════════════════════════════════════════════
CONSISTENCY LOCK
═══════════════════════════════════════════════

Across all nine renders: identical face, identical body proportions, identical wardrobe, identical hairstyle, identical skin tone, identical lighting. Zero drift between views.

═══════════════════════════════════════════════
NEGATIVES
═══════════════════════════════════════════════

Avoid: bulky gym-built physique, broad bodybuilder shoulders, thick arms, short proportions, skinny underweight build, identity drift between angles, body proportion variation, wardrobe variation between views, shirt color shift, tie position shift, missing tie in any view, plastic smoothed skin, beauty-retouched magazine look, T-pose stiffness, mannequin pose, cartoon, anime, painted illustration aesthetic, 3D render look, HDR oversaturation, props, weapons, snakes, foliage, color backgrounds, decorative elements.`;

// ─── Post-generation style remixes ────────────────────────────────────
// Each preset takes the just-generated brand shot and re-runs Nano Banana
// with a different artistic style — all keep the brand-pink backdrop intent.
const REMIX_STYLES: {
  id: string;
  label: string;
  prompt: string;
  iconPath: string;
}[] = [
  {
    id: "pixel",
    label: "ПИКСЕЛ",
    prompt:
      "Convert this image to retro 8-bit pixel art with chunky pixels and a limited 16-color palette, vintage CRT vibe. Keep the magenta pink (#1080CA) backdrop. Square 1:1, no text.",
    // Geometric grid of squares — pixel-art icon
    iconPath:
      "M3 3h5v5H3z M11 3h5v5h-5z M19 3h2v5h-2z M3 11h5v5H3z M11 11h5v5h-5z M19 11h2v5h-2z M3 19h5v2H3z M11 19h5v2h-5z M19 19h2v2h-2z",
  },
  {
    id: "lowpoly",
    label: "LOW-POLY",
    prompt:
      "Convert this image to low-poly 3D triangulated geometric style: flat-shaded faceted polygon surfaces, soft volumetric lighting, vibrant magenta accents on a pink (#1080CA) gradient backdrop. Square 1:1, no text.",
    // Triangulated diamond
    iconPath: "M12 2 L22 12 L12 22 L2 12 Z M12 2 L12 22 M2 12 L22 12",
  },
  {
    id: "stylized",
    label: "ИЛЛЮСТР",
    prompt:
      "Convert this image to a clean modern 3D-stylized illustration: smooth Pixar-like materials, slight cel-shading, exaggerated proportions, premium magazine-cover quality. Magenta pink (#1080CA) backdrop preserved. Square 1:1, no text.",
    // Sparkles
    iconPath:
      "M12 3 L13.5 9 L20 10.5 L13.5 12 L12 18 L10.5 12 L4 10.5 L10.5 9 Z M18 16 L18.7 18.3 L21 19 L18.7 19.7 L18 22 L17.3 19.7 L15 19 L17.3 18.3 Z",
  },
  {
    id: "neon",
    label: "НЕОН",
    prompt:
      "Convert this image to vibrant cyberpunk neon style: strong magenta (#1080CA) and cyan rim lighting, glow halos, dark deep-pink backdrop, glossy reflective floor. Square 1:1, no text.",
    // Concentric circles → glow vibe
    iconPath:
      "M12 5 a7 7 0 1 0 0 14 a7 7 0 1 0 0 -14 z M12 9 a3 3 0 1 0 0 6 a3 3 0 1 0 0 -6 z",
  },
  {
    id: "sketch",
    label: "ЭСКИЗ",
    prompt:
      "Convert this image to a clean black-and-white pencil sketch / line drawing on white paper with subtle pink accent strokes (#1080CA). Hand-drawn editorial fashion-illustration vibe. Square 1:1, no text.",
    // Pencil
    iconPath: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z M14.06 6.19l3.75 3.75",
  },
];

async function urlToDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export default function BrandShotPage() {
  const { data: session, status } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [base64, setBase64] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [resultUrl, setResultUrl] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith("image/")) {
      setErr("Зөвхөн зураг файл");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErr("Файл 10MB-аас бага байх ёстой");
      return;
    }
    setErr("");
    setResultUrl("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    const reader = new FileReader();
    reader.onload = () => setBase64(reader.result as string);
    reader.readAsDataURL(f);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const generate = async () => {
    if (!base64 || busy) return;
    setBusy(true);
    setErr("");
    setResultUrl("");
    try {
      const res = await fetch("/api/tools/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: BRAND_PROMPT,
          model: "nano2",
          aspectRatio: "1:1",
          resolution: "standard",
          inputImages: [base64],
          inputImage: base64,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Үүсгэж чадсангүй");
        return;
      }
      if (!data.url) {
        setErr("Үр дүн буцаагдсангүй");
        return;
      }
      setResultUrl(data.url);
    } catch {
      setErr("Сүлжээний алдаа");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview("");
    setBase64("");
    setResultUrl("");
    setErr("");
    setHistory([]);
  };

  // ─── Character Sheet (separate section, 3 references) ────────────────
  const [csFace, setCsFace] = useState<string>("");          // base64 data URI
  const [csWardrobe, setCsWardrobe] = useState<string>("");
  const [csPhysique, setCsPhysique] = useState<string>("");
  const [csBusy, setCsBusy] = useState(false);
  const [csResult, setCsResult] = useState<string>("");
  const [csErr, setCsErr] = useState<string>("");
  const csFaceRef = useRef<HTMLInputElement>(null);
  const csWardrobeRef = useRef<HTMLInputElement>(null);
  const csPhysiqueRef = useRef<HTMLInputElement>(null);

  const readToBase64 = (f: File): Promise<string> => new Promise((resolve, reject) => {
    if (!f.type.startsWith("image/")) { reject(new Error("Зөвхөн зураг файл")); return; }
    if (f.size > 10 * 1024 * 1024) { reject(new Error("Файл 10MB-аас бага")); return; }
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });

  const onCsPick = async (slot: "face" | "wardrobe" | "physique", e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCsErr("");
    try {
      const b64 = await readToBase64(f);
      if (slot === "face") setCsFace(b64);
      else if (slot === "wardrobe") setCsWardrobe(b64);
      else setCsPhysique(b64);
    } catch (err) {
      setCsErr(err instanceof Error ? err.message : "Алдаа");
    } finally {
      e.target.value = "";
    }
  };

  const generateCharacterSheet = async () => {
    if (!csFace || !csWardrobe || !csPhysique || csBusy) return;
    setCsBusy(true);
    setCsErr("");
    setCsResult("");
    try {
      const res = await fetch("/api/tools/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: CHARACTER_SHEET_PROMPT,
          model: "nano2",
          aspectRatio: "1:1",
          resolution: "standard",
          inputImages: [csFace, csWardrobe, csPhysique],   // ORDER MATTERS — prompt references them by index
          inputImage: csFace,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setCsErr(data.error || "Үүсгэж чадсангүй");
        return;
      }
      setCsResult(data.url);
    } catch {
      setCsErr("Сүлжээний алдаа");
    } finally {
      setCsBusy(false);
    }
  };

  // ─── Style remix — re-run gen using current result + style prompt ────
  const [stylizing, setStylizing] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const stylize = async (style: typeof REMIX_STYLES[number]) => {
    if (!resultUrl || stylizing) return;
    setStylizing(style.id);
    setErr("");
    try {
      const dataUri = await urlToDataUri(resultUrl);
      const res = await fetch("/api/tools/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: style.prompt,
          model: "nano2",
          aspectRatio: "1:1",
          resolution: "standard",
          inputImages: [dataUri],
          inputImage: dataUri,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setErr(data.error || "Үүсгэж чадсангүй");
        return;
      }
      // Push current result into history so user can flip back
      setHistory((h) => [resultUrl, ...h].slice(0, 6));
      setResultUrl(data.url);
    } catch {
      setErr("Сүлжээний алдаа");
    } finally {
      setStylizing(null);
    }
  };

  // ─── Sign-in gate ─────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#1080CA]" />
      </div>
    );
  }
  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-[22px] font-bold text-[#0e1726]">Бренд шот</h1>
        <p className="mt-2 text-[14px] text-[#6b7280]">Зургаа бренд-пинк 3D шот болгох</p>
        <Link href="/auth/signin?callbackUrl=/tools/brand-shot" className="mt-6 inline-flex rounded-none bg-[#1080CA] px-5 py-2 text-[13px] font-bold text-[#0E0E10] hover:shadow-[0_0_24px_rgba(16,128,202,0.25)]">Нэвтрэх</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-12">
      {/* SKILL.md page header */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rotate-45 bg-[#1080CA] shadow-[0_0_10px_rgba(16,128,202,0.8)]" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.30em] text-[#1080CA]">
            ANTAQOR / BRAND SHOT
          </span>
        </div>
        <h1
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 800,
            letterSpacing: "0.02em",
            lineHeight: 0.92,
          }}
          className="text-[26px] uppercase text-[#f5f5f7] sm:text-[32px]"
        >
          БРЕНД{" "}
          <span
            style={{
              color: "#1080CA",
              fontWeight: 900,
              letterSpacing: "0.04em",
              textShadow: "0 0 24px rgba(16,128,202,0.55), 0 0 48px rgba(16,128,202,0.35)",
              WebkitTextStroke: "1px rgba(15,23,38,0.12)",
            }}
          >
            ШОТ
          </span>
          <span style={{ color: "#1080CA", textShadow: "0 0 20px #1080CA" }}>.</span>
        </h1>
        <p className="mt-2 max-w-[520px] text-[13px] leading-relaxed text-[#6b7280]">
          Зургаа дараад 3D-стилтэй, бренд-пинк дэвсгэртэй продукт шот үүсгэнэ.
        </p>
        <div className="mt-3">
          <div className="h-[2px] w-full bg-[#1080CA] shadow-[0_0_8px_rgba(16,128,202,0.5)]" />
          <div
            className="mt-1 h-px w-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(16,128,202,0.5) 0 3px, transparent 3px 6px)",
            }}
          />
        </div>
      </div>

      {/* ─── Result state ─────────────────────────────────────────── */}
      {resultUrl ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-none border border-[rgba(16,128,202,0.25)] bg-[#0a0a0c] shadow-[0_18px_40px_rgba(0,0,0,0.5)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resultUrl} alt="Brand shot result" className="block w-full" />
          </div>
          {/* Style remix row — click any to re-render in a new style */}
          <div className="space-y-2 rounded-none border border-[rgba(16,128,202,0.18)] bg-gradient-to-b from-[rgba(16,128,202,0.04)] to-[#0a0a0c] p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.26em] text-[#1080CA]">▶ ӨӨРЧЛӨХ · СТИЛЬ</span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const prev = history[0];
                    setHistory((h) => h.slice(1));
                    setResultUrl(prev);
                  }}
                  className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#6b7280] transition hover:text-[#1080CA]"
                >
                  ← БУЦАХ
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {REMIX_STYLES.map((s) => {
                const active = stylizing === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => stylize(s)}
                    disabled={!!stylizing}
                    className={`group flex flex-col items-center justify-center gap-1.5 rounded-none border bg-[#f2f5f8] py-2.5 transition disabled:cursor-wait disabled:opacity-50 ${
                      active
                        ? "border-[#1080CA] bg-[rgba(16,128,202,0.08)] shadow-[0_0_14px_rgba(16,128,202,0.35)]"
                        : "border-[rgba(15,23,38,0.06)] hover:border-[rgba(16,128,202,0.45)]"
                    }`}
                  >
                    {active ? (
                      <span className="h-4 w-4 animate-pulse rounded-full bg-[#1080CA]" />
                    ) : (
                      <svg
                        className={`h-5 w-5 transition ${active ? "text-[#1080CA]" : "text-[#6b7280] group-hover:text-[#1080CA]"}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        viewBox="0 0 24 24"
                      >
                        <path d={s.iconPath} />
                      </svg>
                    )}
                    <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.22em] ${active ? "text-[#1080CA]" : "text-[#6b7280] group-hover:text-[#0e1726]"}`}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {history.length > 0 && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto">
                {history.slice(0, 6).map((h, i) => (
                  <button
                    key={`${h}-${i}`}
                    type="button"
                    onClick={() => {
                      setHistory((arr) => arr.filter((_, j) => j !== i));
                      setResultUrl(h);
                    }}
                    className="relative h-12 w-12 shrink-0 overflow-hidden rounded-none border border-[rgba(15,23,38,0.08)] transition hover:border-[#1080CA]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={h} alt={`prev ${i}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={resultUrl}
              download
              className="inline-flex items-center gap-2 rounded-none bg-[#1080CA] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#0E0E10] transition hover:shadow-[0_0_18px_rgba(16,128,202,0.4)]"
            >
              ↓ ТАТАХ
            </a>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(window.location.origin + resultUrl)}
              className="rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7280] transition hover:text-[#0e1726]"
            >
              ЛИНК ХУУЛАХ
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7280] transition hover:text-[#1080CA]"
            >
              + ШИНЭ
            </button>
          </div>
          {/* Show original next to result for comparison */}
          {preview && (
            <div className="rounded-none border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] p-3">
              <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#6b7280]">ОРИГИНАЛ</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="max-h-[160px] rounded-none border border-[rgba(15,23,38,0.05)] object-contain" />
            </div>
          )}
        </div>
      ) : (
        /* ─── Upload + generate state ─────────────────────────────── */
        <div className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={onPick}
          />
          {!preview ? (
            <label
              onDragOver={(e) => { e.preventDefault(); }}
              onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-none border-2 border-dashed py-16 text-center transition ${
                dragOver
                  ? "border-[#1080CA] bg-[rgba(16,128,202,0.04)]"
                  : "border-[rgba(15,23,38,0.1)] bg-[#f2f5f8] hover:border-[rgba(16,128,202,0.4)]"
              }`}
            >
              <div onClick={() => fileRef.current?.click()} className="flex flex-col items-center">
                <svg className="mb-3 h-9 w-9 text-[#6b7280]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#0e1726]">
                  ПРОДУКТЫНХАА ЗУРГИЙГ ХАЯ
                </p>
                <p className="mt-1.5 text-[11px] text-[#6b7280]">
                  JPG · PNG · WebP · 10MB хүртэл
                </p>
              </div>
            </label>
          ) : (
            <div className="relative overflow-hidden rounded-none border border-[rgba(15,23,38,0.08)] bg-[#0a0a0c]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="preview" className="max-h-[420px] w-full object-contain" />
              <button
                type="button"
                onClick={reset}
                className="absolute right-3 top-3 rounded-none bg-black/70 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-white backdrop-blur transition hover:bg-black"
              >
                ✕ СОЛИХ
              </button>
            </div>
          )}

          {err && (
            <p className="rounded-none border border-[#1080CA]/30 bg-[#1080CA]/5 px-3 py-2 text-[12px] text-[#8FC1EA]">{err}</p>
          )}

          {/* Style preview chip — sells the output shape before user generates */}
          {file && !busy && (
            <div className="flex flex-wrap gap-1.5">
              {[
                "ПИНК ДЭВСГЭР",
                "3D СТИЛИЗ",
                "СТУДИО ГЭРЭЛ",
                "1:1",
                "ПРЕМИУМ",
              ].map((tag) => (
                <span
                  key={tag}
                  className="rounded-none border border-[rgba(16,128,202,0.25)] bg-[rgba(16,128,202,0.05)] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#1080CA]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={generate}
            disabled={!file || busy}
            className="flex w-full items-center justify-center gap-2 rounded-none bg-[#1080CA] py-3 font-mono text-[12px] font-bold uppercase tracking-[0.24em] text-[#0E0E10] transition hover:shadow-[0_0_24px_rgba(16,128,202,0.4)] disabled:cursor-not-allowed disabled:bg-[#F2F2F4] disabled:text-[#94a3b8] disabled:shadow-none"
          >
            {busy ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                ШОТ ҮҮСГЭЖ БАЙНА…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                БРЕНД ШОТ ҮҮСГЭХ
              </>
            )}
          </button>
          <p className="text-center font-mono text-[9px] uppercase tracking-[0.22em] text-[#94a3b8]">
            Powered by Nano Banana · ~10-25 сек
          </p>
        </div>
      )}

      {/* ═══════ CHARACTER SHEET — 3-reference 9-view turnaround ═══════════
          Independent section at the bottom of the page. Three labeled slots
          (нүүр / хувцас / бие) → AAA-grade reference sheet. */}
      <div className="mt-12">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rotate-45 bg-[#1080CA] shadow-[0_0_10px_rgba(16,128,202,0.8)]" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.30em] text-[#1080CA]">
            CHARACTER SHEET · 9 ӨНЦӨГ
          </span>
        </div>
        <h2 className="text-[20px] font-black text-[#0e1726] sm:text-[24px]">
          Дүрийн жагсаалт<span className="text-[#1080CA]">.</span>
        </h2>
        <p className="mt-1 max-w-[560px] text-[12px] leading-relaxed text-[#6b7280]">
          Гурван зураг оруулж AAA-түвшний дүрийн reference sheet үүсгэе. Нүүр, хувцас, бие тус бүрд 1 зураг — гарах үр дүн: нэг зурганд нүүрний клоуз-ап + 4 өнцгийн толгой + 4 өнцгийн бие.
        </p>

        {/* 3 upload slots */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {([
            { key: "face",     label: "1 · НҮҮР",   sub: "Identity (face match)",       value: csFace,     setter: setCsFace,     ref: csFaceRef     },
            { key: "wardrobe", label: "2 · ХУВЦАС", sub: "Wardrobe (outfit to copy)",   value: csWardrobe, setter: setCsWardrobe, ref: csWardrobeRef },
            { key: "physique", label: "3 · БИЕ",    sub: "Physique (body proportions)", value: csPhysique, setter: setCsPhysique, ref: csPhysiqueRef },
          ] as const).map((slot) => (
            <div key={slot.key} className="space-y-1.5">
              <button
                type="button"
                onClick={() => slot.ref.current?.click()}
                disabled={csBusy}
                className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-none border bg-[#f2f5f8] transition disabled:cursor-wait disabled:opacity-60 ${
                  slot.value
                    ? "border-[rgba(16,128,202,0.45)] shadow-[0_0_14px_rgba(16,128,202,0.18)]"
                    : "border-2 border-dashed border-[rgba(15,23,38,0.1)] hover:border-[rgba(16,128,202,0.4)]"
                }`}
              >
                {slot.value ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={slot.value} alt="" className="h-full w-full object-cover" />
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Устгах"
                      onClick={(e) => { e.stopPropagation(); slot.setter(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") slot.setter(""); }}
                      className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-none bg-black/70 text-white backdrop-blur transition hover:bg-[rgba(16,128,202,0.85)]"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 px-2 text-center">
                    <svg className="h-5 w-5 text-[#6b7280]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-7.5-12L12 1.5m0 0L8.25 5.25M12 1.5v15" />
                    </svg>
                    <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#6b7280]">+ ЗУРАГ</span>
                  </div>
                )}
              </button>
              <div className="px-0.5">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#1080CA]">{slot.label}</p>
                <p className="text-[10px] leading-tight text-[#6b7280]">{slot.sub}</p>
              </div>
              <input
                ref={slot.ref}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                className="hidden"
                onChange={(e) => onCsPick(slot.key, e)}
              />
            </div>
          ))}
        </div>

        {csErr && (
          <p className="mt-3 rounded-none border border-[rgba(16,128,202,0.25)] bg-[rgba(16,128,202,0.08)] px-3 py-2 text-[11px] text-[#1080CA]">
            {csErr}
          </p>
        )}

        {/* Generate button — disabled until all three slots are filled */}
        <button
          type="button"
          onClick={generateCharacterSheet}
          disabled={!csFace || !csWardrobe || !csPhysique || csBusy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-none bg-[#1080CA] py-3 font-mono text-[12px] font-bold uppercase tracking-[0.24em] text-[#0E0E10] transition hover:shadow-[0_0_24px_rgba(16,128,202,0.4)] disabled:cursor-not-allowed disabled:bg-[#F2F2F4] disabled:text-[#94a3b8] disabled:shadow-none"
        >
          {csBusy ? (
            <>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              ҮҮСГЭЖ БАЙНА…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              9-ӨНЦӨГ ДҮРИЙН ЖАГСААЛТ ҮҮСГЭХ
            </>
          )}
        </button>
        <p className="mt-1 text-center font-mono text-[9px] uppercase tracking-[0.22em] text-[#94a3b8]">
          Powered by Nano Banana · 3 reference → 1 sheet · ~30-60 сек
        </p>

        {csResult && (
          <div className="mt-5 space-y-3">
            <div className="overflow-hidden rounded-none border border-[rgba(16,128,202,0.3)] bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={csResult} alt="Character sheet" className="block w-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={csResult}
                download
                className="inline-flex items-center gap-2 rounded-none bg-[#1080CA] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#0E0E10] transition hover:shadow-[0_0_18px_rgba(16,128,202,0.4)]"
              >
                ↓ ТАТАХ
              </a>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(window.location.origin + csResult)}
                className="rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7280] transition hover:text-[#0e1726]"
              >
                ЛИНК ХУУЛАХ
              </button>
              <button
                type="button"
                onClick={() => { setCsFace(""); setCsWardrobe(""); setCsPhysique(""); setCsResult(""); setCsErr(""); }}
                className="rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7280] transition hover:text-[#1080CA]"
              >
                + ШИНЭ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
