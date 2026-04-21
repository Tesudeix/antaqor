"use client";

import { useRef, useState, useCallback } from "react";

// ─── Types ───
type AspectRatio = "4:5" | "1:1" | "9:16" | "16:9";
type TemplateType = "pricing" | "course" | "live" | "announcement" | "social";

const ASPECT_MAP: Record<AspectRatio, { w: number; h: number; label: string }> = {
  "4:5":  { w: 400, h: 500, label: "Instagram Post" },
  "1:1":  { w: 400, h: 400, label: "Square" },
  "9:16": { w: 360, h: 640, label: "Story / Reels" },
  "16:9": { w: 560, h: 315, label: "YouTube / Banner" },
};

const BRAND = "#EF2C58";

// ─── Main Component ───
export default function PosterPage() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [aspect, setAspect] = useState<AspectRatio>("4:5");
  const [template, setTemplate] = useState<TemplateType>("pricing");
  const [downloading, setDownloading] = useState(false);

  // Fields
  const [tag, setTag] = useState("Antaqor");
  const [title1, setTitle1] = useState("CYBER");
  const [title2, setTitle2] = useState("EMPIRE");
  const [subtitle, setSubtitle] = useState("AI Community");
  const [badge, setBadge] = useState("Одоогийн үнэ");
  const [showBadge, setShowBadge] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showScan, setShowScan] = useState(true);
  const [watermark, setWatermark] = useState("antaqor.com");
  const [cta, setCta] = useState("Эрт орших тусам хямд");

  // Pricing
  const [price, setPrice] = useState("29,000₮");
  const [period, setPeriod] = useState("сар бүр");
  const [k1, setK1] = useState("Гишүүн бүр нэмнэ"); const [v1, setV1] = useState("+500₮");
  const [k2, setK2] = useState("Одоогийн гишүүд"); const [v2, setV2] = useState("15 гишүүн");
  const [k3, setK3] = useState("Анхны үнэ"); const [v3, setV3] = useState("9,900₮");
  const [bigNum, setBigNum] = useState("15");
  const [bigNumLabel, setBigNumLabel] = useState("гишүүд");

  // Course
  const [l1, setL1] = useState("Prompt Engineering");
  const [l1s, setL1s] = useState("Үр дүнтэй промт бичих");
  const [l2, setL2] = useState("Claude API & Workflow");
  const [l3, setL3] = useState("AI Agent Builder");
  const [l4, setL4] = useState("Бүрэн Эзэмшлийн Төсөл");
  const [duration, setDuration] = useState("4 сар");
  const [goal, setGoal] = useState("AI Master");
  const [progress, setProgress] = useState("25");

  // Live
  const [liveTime, setLiveTime] = useState("20:30");
  const [liveLabel, setLiveLabel] = useState("Монголын цагаар");
  const [platform, setPlatform] = useState("Cyber Empire");

  // Social
  const [quote, setQuote] = useState("AI ашиглах чадвар нь цалин биш, чөлөөлөгдөх зэвсэг юм.");
  const [body, setBody] = useState("Ихэнх хүн AI-г ажлаа хялбарчлах хэрэгсэл гэж харна.");
  const [handle, setHandle] = useState("@antaqor");
  const [statNums, setStatNums] = useState(["Day 1", "4 cap", "∞"]);
  const [statLabels, setStatLabels] = useState(["Эхлэл", "Хөтөлбөр", "Боломж"]);

  // Image
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageOpacity, setImageOpacity] = useState(30);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const removeImage = () => { setUploadedImage(null); if (fileRef.current) fileRef.current.value = ""; };

  const handleDownload = async () => {
    if (!canvasRef.current || downloading) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(canvasRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#050505",
      });
      const link = document.createElement("a");
      link.download = `antaqor-poster-${template}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  const dim = ASPECT_MAP[aspect];
  const scale = Math.min(1, 480 / dim.w);

  // ─── Input helper ───
  const ic = "w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[12px] text-[#E8E8E8] outline-none transition focus:border-[rgba(239,44,88,0.4)] placeholder:text-[#999]";
  const label = "block mb-1 text-[9px] uppercase tracking-[1px] text-[#999]";
  const section = "text-[9px] uppercase tracking-[2px] text-[#EF2C58] mt-5 mb-3 pb-2 border-b border-[#F0F0EE]";

  return (
    <div className="flex gap-0 -mx-8 -my-8 min-h-screen">
      {/* ═══ LEFT PANEL ═══ */}
      <div className="w-[320px] shrink-0 overflow-y-auto border-r border-[rgba(255,255,255,0.08)] bg-[#141414] p-6" style={{ maxHeight: "100vh" }}>
        <div className="text-[9px] uppercase tracking-[2px] text-[#EF2C58]">Antaqor Design</div>
        <h1 className="mt-1 text-[20px] font-bold tracking-[1px] text-[#E8E8E8]">
          Poster <span className="text-[#EF2C58]">Template</span>
        </h1>

        {/* Aspect Ratio */}
        <div className={section}>Хэмжээ</div>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.entries(ASPECT_MAP) as [AspectRatio, typeof ASPECT_MAP["4:5"]][]).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setAspect(key)}
              className={`rounded-[4px] px-3 py-2 text-[10px] font-bold transition ${
                aspect === key
                  ? "bg-[#EF2C58] text-white"
                  : "border border-[rgba(255,255,255,0.08)] text-[#999] hover:text-[#CCCCCC]"
              }`}
            >
              {key} <span className="font-normal opacity-70">{val.label}</span>
            </button>
          ))}
        </div>

        {/* Template */}
        <div className={section}>Загвар</div>
        <div className="space-y-1">
          {([
            { key: "pricing" as TemplateType, label: "Үнийн мэдээлэл" },
            { key: "course" as TemplateType, label: "AI Курс / Сургалт" },
            { key: "live" as TemplateType, label: "Live хичээл" },
            { key: "announcement" as TemplateType, label: "Зарлал" },
            { key: "social" as TemplateType, label: "Social Post" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTemplate(t.key)}
              className={`flex w-full items-center gap-2 rounded-[4px] px-3 py-2.5 text-left text-[11px] font-medium transition ${
                template === t.key
                  ? "border border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.06)] text-[#EF2C58]"
                  : "border border-[rgba(255,255,255,0.08)] text-[#888] hover:text-[#CCCCCC]"
              }`}
            >
              <span className={`h-[5px] w-[5px] rounded-full ${template === t.key ? "bg-[#EF2C58]" : "bg-[#CCC]"}`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Image Upload */}
        <div className={section}>Зураг оруулах</div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        <button onClick={() => fileRef.current?.click()} className={`w-full rounded-[4px] border border-dashed border-[#CCC] px-3 py-4 text-[11px] text-[#888] transition hover:border-[#EF2C58] hover:text-[#EF2C58] ${uploadedImage ? "border-[#EF2C58] bg-[rgba(239,44,88,0.03)]" : ""}`}>
          {uploadedImage ? "Зураг солих" : "Зураг сонгох"}
        </button>
        {uploadedImage && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className={label}>Тунгалаг байдал: {imageOpacity}%</span>
              <button onClick={removeImage} className="text-[10px] text-red-400 hover:text-red-500">Устгах</button>
            </div>
            <input
              type="range" min="5" max="100" value={imageOpacity}
              onChange={(e) => setImageOpacity(Number(e.target.value))}
              className="w-full accent-[#EF2C58]"
            />
          </div>
        )}

        {/* Shared fields */}
        {template !== "social" && (
          <>
            <div className={section}>Үндсэн текст</div>
            <div className="space-y-2">
              <div><span className={label}>Tag</span><input value={tag} onChange={(e) => setTag(e.target.value)} className={ic} /></div>
              <div><span className={label}>Гарчиг 1</span><input value={title1} onChange={(e) => setTitle1(e.target.value)} className={ic} /></div>
              <div><span className={label}>Гарчиг 2 (өнгөтэй)</span><input value={title2} onChange={(e) => setTitle2(e.target.value)} className={ic} /></div>
              <div><span className={label}>Subtitle</span><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={ic} /></div>
              <div><span className={label}>Badge</span><input value={badge} onChange={(e) => setBadge(e.target.value)} className={ic} /></div>
            </div>
          </>
        )}

        {/* Dynamic fields per template */}
        {template === "pricing" && (
          <>
            <div className={section}>Үнийн мэдээлэл</div>
            <div className="space-y-2">
              <div><span className={label}>Одоогийн үнэ</span><input value={price} onChange={(e) => setPrice(e.target.value)} className={ic} /></div>
              <div><span className={label}>Хугацаа</span><input value={period} onChange={(e) => setPeriod(e.target.value)} className={ic} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className={label}>Key 1</span><input value={k1} onChange={(e) => setK1(e.target.value)} className={ic} /></div>
                <div><span className={label}>Val 1</span><input value={v1} onChange={(e) => setV1(e.target.value)} className={ic} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className={label}>Key 2</span><input value={k2} onChange={(e) => setK2(e.target.value)} className={ic} /></div>
                <div><span className={label}>Val 2</span><input value={v2} onChange={(e) => setV2(e.target.value)} className={ic} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className={label}>Key 3</span><input value={k3} onChange={(e) => setK3(e.target.value)} className={ic} /></div>
                <div><span className={label}>Val 3</span><input value={v3} onChange={(e) => setV3(e.target.value)} className={ic} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className={label}>Том тоо</span><input value={bigNum} onChange={(e) => setBigNum(e.target.value)} className={ic} /></div>
                <div><span className={label}>Тоо label</span><input value={bigNumLabel} onChange={(e) => setBigNumLabel(e.target.value)} className={ic} /></div>
              </div>
            </div>
          </>
        )}

        {template === "course" && (
          <>
            <div className={section}>Хичээлийн мэдээлэл</div>
            <div className="space-y-2">
              <div><span className={label}>Хичээл 1</span><input value={l1} onChange={(e) => setL1(e.target.value)} className={ic} /></div>
              <div><span className={label}>Хичээл 1 sub</span><input value={l1s} onChange={(e) => setL1s(e.target.value)} className={ic} /></div>
              <div><span className={label}>Хичээл 2</span><input value={l2} onChange={(e) => setL2(e.target.value)} className={ic} /></div>
              <div><span className={label}>Хичээл 3</span><input value={l3} onChange={(e) => setL3(e.target.value)} className={ic} /></div>
              <div><span className={label}>Хичээл 4</span><input value={l4} onChange={(e) => setL4(e.target.value)} className={ic} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className={label}>Хугацаа</span><input value={duration} onChange={(e) => setDuration(e.target.value)} className={ic} /></div>
                <div><span className={label}>Зорилго</span><input value={goal} onChange={(e) => setGoal(e.target.value)} className={ic} /></div>
              </div>
              <div><span className={label}>Явц %</span><input type="range" min="0" max="100" value={progress} onChange={(e) => setProgress(e.target.value)} className="w-full accent-[#EF2C58]" /></div>
            </div>
          </>
        )}

        {template === "live" && (
          <>
            <div className={section}>Live мэдээлэл</div>
            <div className="space-y-2">
              <div><span className={label}>Цаг</span><input value={liveTime} onChange={(e) => setLiveTime(e.target.value)} className={ic} /></div>
              <div><span className={label}>Цагийн label</span><input value={liveLabel} onChange={(e) => setLiveLabel(e.target.value)} className={ic} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className={label}>Key 1</span><input value={k1} onChange={(e) => setK1(e.target.value)} className={ic} /></div>
                <div><span className={label}>Val 1</span><input value={v1} onChange={(e) => setV1(e.target.value)} className={ic} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className={label}>Key 2</span><input value={k2} onChange={(e) => setK2(e.target.value)} className={ic} /></div>
                <div><span className={label}>Val 2</span><input value={v2} onChange={(e) => setV2(e.target.value)} className={ic} /></div>
              </div>
              <div><span className={label}>Платформ</span><input value={platform} onChange={(e) => setPlatform(e.target.value)} className={ic} /></div>
            </div>
          </>
        )}

        {template === "announcement" && (
          <>
            <div className={section}>Зарлалын агуулга</div>
            <div className="space-y-2">
              <div><span className={label}>Том тоо / огноо</span><input value={bigNum} onChange={(e) => setBigNum(e.target.value)} className={ic} /></div>
              <div><span className={label}>Label</span><input value={bigNumLabel} onChange={(e) => setBigNumLabel(e.target.value)} className={ic} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className={label}>Key 1</span><input value={k1} onChange={(e) => setK1(e.target.value)} className={ic} /></div>
                <div><span className={label}>Val 1</span><input value={v1} onChange={(e) => setV1(e.target.value)} className={ic} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className={label}>Key 2</span><input value={k2} onChange={(e) => setK2(e.target.value)} className={ic} /></div>
                <div><span className={label}>Val 2</span><input value={v2} onChange={(e) => setV2(e.target.value)} className={ic} /></div>
              </div>
              <div><span className={label}>Зорилго</span><input value={goal} onChange={(e) => setGoal(e.target.value)} className={ic} /></div>
            </div>
          </>
        )}

        {template === "social" && (
          <>
            <div className={section}>Social Post</div>
            <div className="space-y-2">
              <div><span className={label}>Handle</span><input value={handle} onChange={(e) => setHandle(e.target.value)} className={ic} /></div>
              <div><span className={label}>Үндсэн санаа</span><textarea value={quote} onChange={(e) => setQuote(e.target.value)} className={`${ic} min-h-[60px] resize-y`} /></div>
              <div><span className={label}>Тайлбар</span><textarea value={body} onChange={(e) => setBody(e.target.value)} className={`${ic} min-h-[50px] resize-y`} /></div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <div><span className={label}>Стат {i + 1} тоо</span><input value={statNums[i]} onChange={(e) => { const n = [...statNums]; n[i] = e.target.value; setStatNums(n); }} className={ic} /></div>
                  <div><span className={label}>Стат {i + 1} нэр</span><input value={statLabels[i]} onChange={(e) => { const n = [...statLabels]; n[i] = e.target.value; setStatLabels(n); }} className={ic} /></div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Toggles */}
        <div className={section}>Харагдах байдал</div>
        <div className="space-y-2">
          {[
            { label: "Grid background", val: showGrid, set: setShowGrid },
            { label: "Scan line", val: showScan, set: setShowScan },
            { label: "Badge харуулах", val: showBadge, set: setShowBadge },
          ].map((t) => (
            <div key={t.label} className="flex items-center justify-between">
              <span className="text-[10px] text-[#888]">{t.label}</span>
              <button
                onClick={() => t.set(!t.val)}
                className={`relative h-[20px] w-[36px] rounded-full transition ${t.val ? "bg-[#EF2C58]" : "bg-[#E8E8E6]"}`}
              >
                <span className={`absolute top-[2px] h-[16px] w-[16px] rounded-full bg-[#141414] transition-all shadow-sm ${t.val ? "left-[18px]" : "left-[2px]"}`} />
              </button>
            </div>
          ))}
        </div>

        {/* Bottom fields */}
        {template !== "social" && (
          <>
            <div className={section}>Доод хэсэг</div>
            <div className="space-y-2">
              <div><span className={label}>CTA текст</span><input value={cta} onChange={(e) => setCta(e.target.value)} className={ic} /></div>
              <div><span className={label}>Watermark</span><input value={watermark} onChange={(e) => setWatermark(e.target.value)} className={ic} /></div>
            </div>
          </>
        )}

        {/* Download */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="mt-6 w-full rounded-[4px] bg-[#EF2C58] py-3 text-[11px] font-bold uppercase tracking-[2px] text-white transition hover:shadow-[0_0_32px_rgba(239,44,88,0.3)] disabled:opacity-50"
        >
          {downloading ? "Татаж байна..." : "PNG ТАТАХ"}
        </button>
        <p className="mt-2 text-center text-[9px] text-[#CCC]">3x чанартай PNG зураг</p>
      </div>

      {/* ═══ RIGHT PREVIEW ═══ */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#F4F4F2] p-8" style={{ minHeight: "100vh" }}>
        <div className="mb-4 text-[9px] uppercase tracking-[2px] text-[#CCC]">
          Preview {dim.w} x {dim.h}px {dim.label}
        </div>

        <div style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
          <div
            ref={canvasRef}
            style={{
              width: dim.w,
              height: dim.h,
              background: "#050505",
              position: "relative",
              overflow: "hidden",
              fontFamily: "'IBM Plex Sans', 'Inter', system-ui, sans-serif",
              border: "1px solid #1a1a1a",
            }}
          >
            {/* Grid */}
            {showGrid && (
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: `linear-gradient(rgba(239,44,88,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(239,44,88,0.04) 1px, transparent 1px)`,
                backgroundSize: "30px 30px",
              }} />
            )}

            {/* Uploaded image */}
            {uploadedImage && (
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: `url(${uploadedImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                opacity: imageOpacity / 100,
              }} />
            )}

            {/* Scan line */}
            {showScan && (
              <div style={{
                position: "absolute", width: "100%", height: 1,
                background: "rgba(239,44,88,0.15)",
                animation: "posterScan 4s linear infinite",
                zIndex: 2,
              }} />
            )}

            {/* Top accent bar */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: BRAND }} />

            {/* Corner marks */}
            {[
              { top: 12, left: 12, borderTop: `1px solid ${BRAND}`, borderLeft: `1px solid ${BRAND}` },
              { top: 12, right: 12, borderTop: `1px solid ${BRAND}`, borderRight: `1px solid ${BRAND}` },
              { bottom: 12, left: 12, borderBottom: `1px solid ${BRAND}`, borderLeft: `1px solid ${BRAND}` },
              { bottom: 12, right: 12, borderBottom: `1px solid ${BRAND}`, borderRight: `1px solid ${BRAND}` },
            ].map((s, i) => (
              <div key={i} style={{ position: "absolute", width: 16, height: 16, zIndex: 10, ...s } as React.CSSProperties} />
            ))}

            {/* Content */}
            <div style={{
              position: "relative", zIndex: 5, height: "100%",
              display: "flex", flexDirection: "column",
              padding: aspect === "9:16" ? "28px 24px 24px" : "32px 28px 28px",
            }}>
              {/* ─── PRICING ─── */}
              {template === "pricing" && <PricingContent
                tag={tag} title1={title1} title2={title2} subtitle={subtitle}
                badge={badge} showBadge={showBadge} price={price} period={period}
                k1={k1} v1={v1} k2={k2} v2={v2} k3={k3} v3={v3}
                bigNum={bigNum} bigNumLabel={bigNumLabel} cta={cta}
                compact={aspect === "1:1" || aspect === "16:9"}
              />}

              {/* ─── COURSE ─── */}
              {template === "course" && <CourseContent
                tag={tag} title1={title1} title2={title2} subtitle={subtitle}
                badge={badge} showBadge={showBadge}
                l1={l1} l1s={l1s} l2={l2} l3={l3} l4={l4}
                duration={duration} goal={goal} progress={parseInt(progress)} cta={cta}
                compact={aspect === "1:1" || aspect === "16:9"}
              />}

              {/* ─── LIVE ─── */}
              {template === "live" && <LiveContent
                tag={tag} title1={title1} title2={title2} subtitle={subtitle}
                badge={badge} showBadge={showBadge} liveTime={liveTime} liveLabel={liveLabel}
                k1={k1} v1={v1} k2={k2} v2={v2} platform={platform} cta={cta}
                compact={aspect === "1:1" || aspect === "16:9"}
              />}

              {/* ─── ANNOUNCEMENT ─── */}
              {template === "announcement" && <AnnouncementContent
                tag={tag} title1={title1} title2={title2} subtitle={subtitle}
                badge={badge} showBadge={showBadge} bigNum={bigNum} bigNumLabel={bigNumLabel}
                k1={k1} v1={v1} k2={k2} v2={v2} goal={goal} cta={cta}
                compact={aspect === "1:1" || aspect === "16:9"}
              />}

              {/* ─── SOCIAL ─── */}
              {template === "social" && <SocialContent
                handle={handle} quote={quote} body={body}
                statNums={statNums} statLabels={statLabels}
                compact={aspect === "1:1" || aspect === "16:9"}
              />}
            </div>

            {/* Watermark */}
            <div style={{
              position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 8,
              color: "#1a1a1a", letterSpacing: "0.3em", textTransform: "uppercase", whiteSpace: "nowrap",
            }}>
              {watermark}
            </div>
          </div>
        </div>
      </div>

      {/* Scan animation */}
      <style>{`
        @keyframes posterScan { 0% { top: -2px; } 100% { top: 102%; } }
        @keyframes posterBlink { 0%,100% { opacity:1 } 50% { opacity:0 } }
        @keyframes posterPulse { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:0.3; transform:scale(0.7) } }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════
// Shared styles
// ═══════════════════════════════════════════
const mono = "'IBM Plex Mono', 'SF Mono', monospace";
const B = "#EF2C58";
const Bdim = "rgba(239,44,88,0.08)";
const Bmid = "rgba(239,44,88,0.15)";
const Bborder = "rgba(239,44,88,0.25)";

function PosterTag({ text }: { text: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: 9, color: B, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>
      <span style={{ width: 5, height: 5, background: B, borderRadius: "50%", animation: "posterBlink 1.2s step-end infinite" }} />
      {text}
    </div>
  );
}

function PosterHeader({ title1, title2, subtitle, badge, showBadge, compact }: { title1: string; title2: string; subtitle: string; badge: string; showBadge: boolean; compact?: boolean }) {
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.3em", color: "#444", textTransform: "uppercase", marginBottom: 6 }}>Antaqor</div>
      <div style={{ fontSize: compact ? 28 : 34, fontWeight: 700, color: "#fff", lineHeight: 1, letterSpacing: "-0.02em", marginBottom: 4 }}>
        {title1}<span style={{ color: B, display: "block" }}>{title2}</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: compact ? 14 : 22 }}>{subtitle}</div>
      <div style={{ height: 1, background: `linear-gradient(90deg, ${B} 0%, transparent 100%)`, marginBottom: compact ? 12 : 18, opacity: 0.4 }} />
      {showBadge && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: Bdim, border: `1px solid ${Bborder}`,
          padding: "4px 10px", marginBottom: compact ? 12 : 16,
          fontFamily: mono, fontSize: 9, color: B, letterSpacing: "0.15em", textTransform: "uppercase",
        }}>
          <span style={{ width: 5, height: 5, background: B, borderRadius: "50%", animation: "posterPulse 1s ease-in-out infinite" }} />
          {badge}
        </div>
      )}
    </>
  );
}

function InfoBlock({ rows }: { rows: { key: string; val: string; highlight?: boolean }[] }) {
  return (
    <div style={{ border: "1px solid rgba(239,44,88,0.08)", background: "rgba(239,44,88,0.02)", position: "relative", marginBottom: 14 }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: B }} />
      {rows.map((r, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 14px",
          borderTop: i > 0 ? "1px solid #111" : "none",
        }}>
          <span style={{ fontFamily: mono, fontSize: 10, color: "#555", letterSpacing: "0.08em" }}>{r.key}</span>
          <span style={{ fontFamily: mono, fontSize: 11, color: r.highlight ? B : "#ccc", fontWeight: 500 }}>{r.val}</span>
        </div>
      ))}
    </div>
  );
}

function CtaBar({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
      <div style={{ fontFamily: mono, fontSize: 8, color: "#333", letterSpacing: "0.2em", textTransform: "uppercase" }}>{text}</div>
      <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
    </div>
  );
}

// ═══════════════════════════════════════════
// Template Renders
// ═══════════════════════════════════════════

function PricingContent({ tag, title1, title2, subtitle, badge, showBadge, price, period, k1, v1, k2, v2, k3, v3, bigNum, bigNumLabel, cta, compact }: {
  tag: string; title1: string; title2: string; subtitle: string; badge: string; showBadge: boolean;
  price: string; period: string; k1: string; v1: string; k2: string; v2: string; k3: string; v3: string;
  bigNum: string; bigNumLabel: string; cta: string; compact?: boolean;
}) {
  return (
    <>
      <PosterTag text={tag} />
      <PosterHeader title1={title1} title2={title2} subtitle={subtitle} badge={badge} showBadge={showBadge} compact={compact} />
      <InfoBlock rows={[{ key: k1, val: v1, highlight: true }, { key: k2, val: v2 }, { key: k3, val: v3 }]} />
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontFamily: mono, fontSize: 9, color: "#555", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>Одоогийн үнэ</div>
        <div style={{ fontFamily: mono, fontSize: compact ? 38 : 48, fontWeight: 700, color: B, lineHeight: 1, letterSpacing: "-0.03em" }}>{price}</div>
        <div style={{ fontFamily: mono, fontSize: 11, color: "#444", letterSpacing: "0.1em" }}>/ {period}</div>
      </div>
      <div style={{ marginTop: "auto" }}>
        <CtaBar text={cta} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#444", letterSpacing: "0.15em", textTransform: "uppercase" }}>Гишүүд</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>{bigNum}</div>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#333", letterSpacing: "0.08em", marginTop: 2 }}>{bigNumLabel}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase" }}>Одоо элсэх</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: B, letterSpacing: "-0.02em" }}>{price}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function CourseContent({ tag, title1, title2, subtitle, badge, showBadge, l1, l1s, l2, l3, l4, duration, goal, progress, cta, compact }: {
  tag: string; title1: string; title2: string; subtitle: string; badge: string; showBadge: boolean;
  l1: string; l1s: string; l2: string; l3: string; l4: string;
  duration: string; goal: string; progress: number; cta: string; compact?: boolean;
}) {
  const lessons = [
    { num: "01", title: l1, sub: l1s, active: true },
    { num: "02", title: l2, active: false },
    { num: "03", title: l3, active: false },
    { num: "04", title: l4, active: false },
  ];
  return (
    <>
      <PosterTag text={tag} />
      <PosterHeader title1={title1} title2={title2} subtitle={subtitle} badge={badge} showBadge={showBadge} compact={compact} />
      <div style={{ border: "1px solid rgba(239,44,88,0.08)", position: "relative", marginBottom: 14 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: B }} />
        {lessons.map((ls, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
            borderTop: i > 0 ? "1px solid #111" : "none",
            background: ls.active ? "rgba(239,44,88,0.04)" : "transparent",
          }}>
            <span style={{ fontFamily: mono, fontSize: 9, color: ls.active ? B : "#333", minWidth: 20, letterSpacing: "0.05em" }}>{ls.num}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: ls.active ? "#fff" : "#888", marginBottom: ls.sub ? 2 : 0 }}>{ls.title}</div>
              {ls.sub && <div style={{ fontFamily: mono, fontSize: 9, color: ls.active ? "#555" : "#333" }}>{ls.sub}</div>}
            </div>
            {ls.active ? (
              <span style={{ fontFamily: mono, fontSize: 8, color: B, border: `1px solid rgba(239,44,88,0.3)`, padding: "2px 7px", letterSpacing: "0.1em" }}>TODAY</span>
            ) : (
              <span style={{ fontFamily: mono, fontSize: 8, color: "#222", letterSpacing: "0.1em" }}>--</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: "auto" }}>
        <CtaBar text={cta} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#444", letterSpacing: "0.15em", textTransform: "uppercase" }}>Хугацаа</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{duration}</div>
          </div>
          <div style={{ flex: 1, margin: "0 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 8, color: "#333", letterSpacing: "0.1em", marginBottom: 4 }}>
              <span>Эхлэл</span><span>Бүрэн</span>
            </div>
            <div style={{ height: 2, background: "#111", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, progress)}%`, background: B }} />
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Зорилго</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: B, letterSpacing: "0.05em" }}>{goal}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function LiveContent({ tag, title1, title2, subtitle, badge, showBadge, liveTime, liveLabel, k1, v1, k2, v2, platform, cta, compact }: {
  tag: string; title1: string; title2: string; subtitle: string; badge: string; showBadge: boolean;
  liveTime: string; liveLabel: string; k1: string; v1: string; k2: string; v2: string;
  platform: string; cta: string; compact?: boolean;
}) {
  const days = ["ДАВ", "МЯГ", "ЛХА", "ПҮР", "БАА", "БЯМ", "НЯМ"];
  return (
    <>
      <PosterTag text={tag} />
      <PosterHeader title1={title1} title2={title2} subtitle={subtitle} badge={badge} showBadge={showBadge} compact={compact} />
      <div style={{ fontFamily: mono, fontSize: compact ? 48 : 56, fontWeight: 700, color: B, lineHeight: 1, letterSpacing: "-0.03em", marginBottom: 4 }}>{liveTime}</div>
      <div style={{ fontFamily: mono, fontSize: 9, color: "#333", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>{liveLabel}</div>
      <InfoBlock rows={[{ key: k1, val: v1, highlight: true }, { key: k2, val: v2 }]} />
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {days.map((d) => (
          <div key={d} style={{
            flex: 1, padding: "5px 0", textAlign: "center",
            fontFamily: mono, fontSize: 7, letterSpacing: "0.06em",
            color: "#000", background: B, fontWeight: 500,
          }}>{d}</div>
        ))}
      </div>
      <div style={{ marginTop: "auto" }}>
        <CtaBar text={cta} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#444", letterSpacing: "0.15em", textTransform: "uppercase" }}>Платформ</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{platform}</div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            border: `1px solid rgba(239,44,88,0.3)`, background: "rgba(239,44,88,0.06)",
            padding: "7px 14px",
          }}>
            <span style={{ width: 7, height: 7, background: B, borderRadius: "50%", animation: "posterPulse 1s ease-in-out infinite" }} />
            <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 500, color: B, letterSpacing: "0.2em" }}>LIVE</span>
          </div>
        </div>
      </div>
    </>
  );
}

function AnnouncementContent({ tag, title1, title2, subtitle, badge, showBadge, bigNum, bigNumLabel, k1, v1, k2, v2, goal, cta, compact }: {
  tag: string; title1: string; title2: string; subtitle: string; badge: string; showBadge: boolean;
  bigNum: string; bigNumLabel: string; k1: string; v1: string; k2: string; v2: string;
  goal: string; cta: string; compact?: boolean;
}) {
  return (
    <>
      <PosterTag text={tag} />
      <PosterHeader title1={title1} title2={title2} subtitle={subtitle} badge={badge} showBadge={showBadge} compact={compact} />
      <div style={{ fontFamily: mono, fontSize: compact ? 40 : 48, fontWeight: 700, color: B, lineHeight: 1, letterSpacing: "-0.03em", marginBottom: 4 }}>{bigNum}</div>
      <div style={{ fontFamily: mono, fontSize: 9, color: "#333", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>{bigNumLabel}</div>
      <InfoBlock rows={[{ key: k1, val: v1, highlight: true }, { key: k2, val: v2 }]} />
      <div style={{ marginTop: "auto" }}>
        <CtaBar text={cta} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            border: `1px solid rgba(239,44,88,0.3)`, background: "rgba(239,44,88,0.06)",
            padding: "7px 14px",
          }}>
            <span style={{ width: 7, height: 7, background: B, borderRadius: "50%", animation: "posterPulse 1s ease-in-out infinite" }} />
            <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 500, color: B, letterSpacing: "0.2em" }}>LIVE</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Үйлдэл</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: B, letterSpacing: "0.05em" }}>{goal}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function SocialContent({ handle, quote, body, statNums, statLabels, compact }: {
  handle: string; quote: string; body: string;
  statNums: string[]; statLabels: string[]; compact?: boolean;
}) {
  const qHTML = quote.replace(/^([^,\.]+)/, '<span style="color:#EF2C58">$1</span>');
  return (
    <>
      {/* Profile */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 36, height: 36, border: `1px solid ${B}`, background: "#0a0a0a",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 500, color: B }}>AQ</span>
        </div>
        <div>
          <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 500, color: "#fff", letterSpacing: "0.05em" }}>{handle}</div>
          <div style={{ fontFamily: mono, fontSize: 8, color: "#444", letterSpacing: "0.1em" }}>
            <span style={{ fontFamily: mono, fontSize: 8, color: "#000", background: B, padding: "1px 6px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500, marginLeft: 0 }}>AI</span>
          </div>
        </div>
      </div>

      {/* Category */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: 8, color: B, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14, opacity: 0.7 }}>
        <span>Бодол</span>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, rgba(239,44,88,0.3), transparent)`, minWidth: 40 }} />
      </div>

      {/* Quote */}
      <div style={{ fontFamily: mono, fontSize: 40, color: "rgba(239,44,88,0.12)", lineHeight: 0.6, marginBottom: 8, fontWeight: 700 }}>&ldquo;</div>
      <div
        style={{ fontSize: compact ? 16 : 18, fontWeight: 700, color: "#fff", lineHeight: 1.35, letterSpacing: "-0.01em", marginBottom: 16 }}
        dangerouslySetInnerHTML={{ __html: qHTML }}
      />

      {/* Body */}
      {body && (
        <div style={{
          fontSize: 12, color: "#777", lineHeight: 1.7, marginBottom: 16,
          borderLeft: "2px solid rgba(239,44,88,0.15)", paddingLeft: 12,
        }}>
          {body}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: `linear-gradient(90deg, ${B}, transparent)`, opacity: 0.2, marginBottom: 14 }} />

      {/* Stats */}
      <div style={{ display: "flex", border: "1px solid rgba(239,44,88,0.08)", marginBottom: 14 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ flex: 1, padding: "8px 12px", borderLeft: i > 0 ? "1px solid #111" : "none" }}>
            <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: B, lineHeight: 1, marginBottom: 2 }}>{statNums[i]}</div>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase" }}>{statLabels[i]}</div>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 500, color: B, letterSpacing: "0.15em", textTransform: "uppercase" }}>ANTAQOR</div>
          <div style={{ fontFamily: mono, fontSize: 8, color: "#333", letterSpacing: "0.1em" }}>antaqor.com</div>
        </div>
        <div style={{
          fontFamily: mono, fontSize: 9, color: "#000", background: B, border: "none",
          padding: "6px 14px", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 500,
        }}>
          ДАГАХ
        </div>
      </div>
    </>
  );
}
