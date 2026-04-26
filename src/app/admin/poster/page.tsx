"use client";

import { useRef, useState, useCallback } from "react";

// ─── Types ───
type AspectRatio = "4:5" | "1:1" | "9:16" | "16:9";
type TemplateType = "educational" | "tip" | "pricing" | "course" | "live" | "announcement" | "social" | "stat";

const ASPECT_MAP: Record<AspectRatio, { w: number; h: number; label: string }> = {
  "4:5":  { w: 400, h: 500, label: "Instagram Post" },
  "1:1":  { w: 400, h: 400, label: "Square" },
  "9:16": { w: 360, h: 640, label: "Story / Reels" },
  "16:9": { w: 560, h: 315, label: "YouTube / Banner" },
};

const TEMPLATE_LIST: { key: TemplateType; label: string; icon: string }[] = [
  { key: "educational", label: "Боловсрол / Сургаалт", icon: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" },
  { key: "tip", label: "Зөвлөгөө / Tip", icon: "M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" },
  { key: "social", label: "Social Post", icon: "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" },
  { key: "stat", label: "Статистик / Тоо", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" },
  { key: "pricing", label: "Үнийн мэдээлэл", icon: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "course", label: "AI Курс / Сургалт", icon: "M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" },
  { key: "live", label: "Live хичээл", icon: "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" },
  { key: "announcement", label: "Зарлал", icon: "M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" },
];

const B = "#EF2C58";

// ─── Main Component ───
export default function PosterPage() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const [aspect, setAspect] = useState<AspectRatio>("1:1");
  const [template, setTemplate] = useState<TemplateType>("educational");
  const [downloading, setDownloading] = useState(false);

  // Shared fields
  const [tag, setTag] = useState("Antaqor");
  const [title1, setTitle1] = useState("CYBER");
  const [title2, setTitle2] = useState("EMPIRE");
  const [subtitle, setSubtitle] = useState("AI Community");
  const [badge, setBadge] = useState("Одоогийн үнэ");
  const [showBadge, setShowBadge] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showScan, setShowScan] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [watermark, setWatermark] = useState("antaqor.com");
  const [cta, setCta] = useState("Эрт орших тусам хямд");

  // Carousel
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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

  // Educational
  const [eduCategory, setEduCategory] = useState("AI ЗӨВЛӨГӨӨ");
  const [eduNumber, setEduNumber] = useState("#03");
  const [eduTitle, setEduTitle] = useState("Промт бичихдээ контекст өгөх нь яагаад чухал вэ?");
  const [eduPoints, setEduPoints] = useState(["AI нь таны зорилгыг таниагүй", "Контекст = илүү зөв хариулт", "Жишээ: \"Маркетингийн менежерт зориулж бич\"", "Нэг промтад нэг зорилго тавь"]);
  const [eduTakeaway, setEduTakeaway] = useState("Промтын 80% нь контекст, 20% нь асуулт байх ёстой.");

  // Tip
  const [tipNumber, setTipNumber] = useState("01");
  const [tipTitle, setTipTitle] = useState("ChatGPT-ээс илүүг хүсвэл");
  const [tipBody, setTipBody] = useState("Нэг удаагийн асуултын оронд харилцан яриа өрнүүл. AI-д роль өг, жишээ үзүүл, алхам алхмаар удирд.");
  const [tipDo, setTipDo] = useState("Роль + контекст + формат зааж өг");
  const [tipDont, setTipDont] = useState("\"Надад юм бич\" гэж л бичих");

  // Stat
  const [statBigNumber, setStatBigNumber] = useState("73%");
  const [statBigLabel, setStatBigLabel] = useState("AI хэрэглэгчдийн бүтээмж нэмэгдсэн");
  const [statSource, setStatSource] = useState("McKinsey 2024");
  const [statItems, setStatItems] = useState([
    { num: "2.5x", label: "Хурдан код бичих" },
    { num: "40%", label: "Цаг хэмнэлт" },
    { num: "89%", label: "Сэтгэл ханамж" },
  ]);

  // Image
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageOpacity, setImageOpacity] = useState(30);
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCustomLogo(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const removeImage = () => { setUploadedImage(null); if (fileRef.current) fileRef.current.value = ""; };

  const handleDownload = async () => {
    if (!canvasRef.current || downloading) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(canvasRef.current, { scale: 3, useCORS: true, backgroundColor: "#050505" });
      const link = document.createElement("a");
      link.download = `antaqor-${template}-${aspect.replace(":", "x")}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) { console.error("Download failed:", err); } finally { setDownloading(false); }
  };

  const dim = ASPECT_MAP[aspect];
  const scale = Math.min(1, 480 / dim.w);
  const compact = aspect === "1:1" || aspect === "16:9";

  const ic = "w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[12px] text-white outline-none transition focus:border-[rgba(239,44,88,0.4)] placeholder:text-[#666]";
  const label = "block mb-1 text-[9px] uppercase tracking-[1px] text-[#888]";
  const sectionCls = "text-[9px] uppercase tracking-[2px] text-[#EF2C58] mt-5 mb-3 pb-2 border-b border-[rgba(255,255,255,0.06)]";

  return (
    <div className="flex gap-0 -mx-8 -my-8 min-h-screen">
      {/* ═══ LEFT PANEL ═══ */}
      <div className="w-[340px] shrink-0 overflow-y-auto border-r border-[rgba(255,255,255,0.08)] bg-[#0F0F0F] p-6" style={{ maxHeight: "100vh" }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)]">
            <svg className="h-4 w-4 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[2px] text-[#EF2C58]">Antaqor Design</div>
            <h1 className="text-[16px] font-bold text-white">Poster Studio</h1>
          </div>
        </div>

        {/* Aspect Ratio */}
        <div className={sectionCls}>Хэмжээ</div>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.entries(ASPECT_MAP) as [AspectRatio, typeof ASPECT_MAP["4:5"]][]).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setAspect(key)}
              className={`rounded-[4px] px-2 py-2.5 text-center transition ${
                aspect === key
                  ? "bg-[#EF2C58] text-white"
                  : "border border-[rgba(255,255,255,0.08)] text-[#888] hover:text-white"
              }`}
            >
              <div className="text-[11px] font-bold">{key}</div>
              <div className="text-[8px] opacity-70">{val.label}</div>
            </button>
          ))}
        </div>

        {/* Template */}
        <div className={sectionCls}>Загвар сонгох</div>
        <div className="grid grid-cols-2 gap-1.5">
          {TEMPLATE_LIST.map((t) => (
            <button
              key={t.key}
              onClick={() => setTemplate(t.key)}
              className={`flex items-center gap-2 rounded-[4px] px-3 py-2.5 text-left text-[10px] font-medium transition ${
                template === t.key
                  ? "border border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.08)] text-[#EF2C58]"
                  : "border border-[rgba(255,255,255,0.06)] text-[#888] hover:text-white hover:border-[rgba(255,255,255,0.15)]"
              }`}
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={t.icon} />
              </svg>
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Image Upload */}
        <div className={sectionCls}>Зураг & Лого</div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => fileRef.current?.click()}
            className={`rounded-[4px] border border-dashed px-3 py-3 text-[10px] transition ${
              uploadedImage
                ? "border-[#EF2C58] bg-[rgba(239,44,88,0.04)] text-[#EF2C58]"
                : "border-[rgba(255,255,255,0.15)] text-[#888] hover:border-[#EF2C58] hover:text-[#EF2C58]"
            }`}
          >
            <svg className="mx-auto mb-1.5 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            {uploadedImage ? "Зураг солих" : "Зураг нэмэх"}
          </button>
          <button
            onClick={() => logoRef.current?.click()}
            className={`rounded-[4px] border border-dashed px-3 py-3 text-[10px] transition ${
              customLogo
                ? "border-[#EF2C58] bg-[rgba(239,44,88,0.04)] text-[#EF2C58]"
                : "border-[rgba(255,255,255,0.15)] text-[#888] hover:border-[#EF2C58] hover:text-[#EF2C58]"
            }`}
          >
            <svg className="mx-auto mb-1.5 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            {customLogo ? "Лого солих" : "Лого нэмэх"}
          </button>
        </div>

        {/* Image previews */}
        {(uploadedImage || customLogo) && (
          <div className="flex gap-2 mb-3">
            {uploadedImage && (
              <div className="relative flex-1 rounded-[4px] overflow-hidden border border-[rgba(255,255,255,0.08)]">
                <img src={uploadedImage} alt="" className="h-16 w-full object-cover" />
                <button onClick={removeImage} className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-red-400 hover:text-red-300">x</button>
                <div className="absolute bottom-0 inset-x-0 bg-black/70 px-2 py-0.5 text-[8px] text-white">Зураг</div>
              </div>
            )}
            {customLogo && (
              <div className="relative flex-1 rounded-[4px] overflow-hidden border border-[rgba(255,255,255,0.08)]">
                <img src={customLogo} alt="" className="h-16 w-full object-contain bg-[#050505] p-2" />
                <button onClick={() => { setCustomLogo(null); if (logoRef.current) logoRef.current.value = ""; }} className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-red-400 hover:text-red-300">x</button>
                <div className="absolute bottom-0 inset-x-0 bg-black/70 px-2 py-0.5 text-[8px] text-white">Лого</div>
              </div>
            )}
          </div>
        )}

        {uploadedImage && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className={label}>Тунгалаг байдал: {imageOpacity}%</span>
            </div>
            <input type="range" min="5" max="100" value={imageOpacity} onChange={(e) => setImageOpacity(Number(e.target.value))} className="w-full accent-[#EF2C58]" />
          </div>
        )}

        {/* Carousel Page Dots */}
        <div className={sectionCls}>Carousel хуудас</div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1">
            <span className={label}>Нийт хуудас</span>
            <input type="number" min="1" max="10" value={totalPages} onChange={(e) => setTotalPages(Math.max(1, parseInt(e.target.value) || 1))} className={ic} />
          </div>
          <div className="flex-1">
            <span className={label}>Одоогийн хуудас</span>
            <input type="number" min="1" max={totalPages} value={currentPage} onChange={(e) => setCurrentPage(Math.min(totalPages, Math.max(1, parseInt(e.target.value) || 1)))} className={ic} />
          </div>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center gap-1.5 mb-2">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`h-2 rounded-full transition-all ${i + 1 === currentPage ? "w-5 bg-[#EF2C58]" : "w-2 bg-[rgba(255,255,255,0.2)]"}`}
              />
            ))}
          </div>
        )}

        {/* ─── TEMPLATE-SPECIFIC FIELDS ─── */}

        {/* Educational */}
        {template === "educational" && (
          <>
            <div className={sectionCls}>Боловсрол контент</div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><span className={label}>Ангилал</span><input value={eduCategory} onChange={(e) => setEduCategory(e.target.value)} className={ic} /></div>
                <div><span className={label}>Дугаар</span><input value={eduNumber} onChange={(e) => setEduNumber(e.target.value)} className={ic} /></div>
              </div>
              <div><span className={label}>Гарчиг</span><textarea value={eduTitle} onChange={(e) => setEduTitle(e.target.value)} className={`${ic} min-h-[50px] resize-y`} /></div>
              {eduPoints.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex-1"><span className={label}>Пойнт {i + 1}</span><input value={p} onChange={(e) => { const n = [...eduPoints]; n[i] = e.target.value; setEduPoints(n); }} className={ic} /></div>
                  {eduPoints.length > 1 && (
                    <button onClick={() => setEduPoints(eduPoints.filter((_, j) => j !== i))} className="mt-4 text-[10px] text-red-400 hover:text-red-300">x</button>
                  )}
                </div>
              ))}
              {eduPoints.length < 6 && (
                <button onClick={() => setEduPoints([...eduPoints, ""])} className="w-full rounded-[4px] border border-dashed border-[rgba(255,255,255,0.1)] py-1.5 text-[10px] text-[#888] hover:text-[#EF2C58] hover:border-[rgba(239,44,88,0.3)]">+ Пойнт нэмэх</button>
              )}
              <div><span className={label}>Дүгнэлт / Takeaway</span><textarea value={eduTakeaway} onChange={(e) => setEduTakeaway(e.target.value)} className={`${ic} min-h-[40px] resize-y`} /></div>
            </div>
          </>
        )}

        {/* Tip */}
        {template === "tip" && (
          <>
            <div className={sectionCls}>Зөвлөгөө</div>
            <div className="space-y-2">
              <div><span className={label}>Tip дугаар</span><input value={tipNumber} onChange={(e) => setTipNumber(e.target.value)} className={ic} /></div>
              <div><span className={label}>Гарчиг</span><input value={tipTitle} onChange={(e) => setTipTitle(e.target.value)} className={ic} /></div>
              <div><span className={label}>Тайлбар</span><textarea value={tipBody} onChange={(e) => setTipBody(e.target.value)} className={`${ic} min-h-[60px] resize-y`} /></div>
              <div><span className={label}>Зөв арга</span><input value={tipDo} onChange={(e) => setTipDo(e.target.value)} className={ic} /></div>
              <div><span className={label}>Буруу арга</span><input value={tipDont} onChange={(e) => setTipDont(e.target.value)} className={ic} /></div>
            </div>
          </>
        )}

        {/* Stat */}
        {template === "stat" && (
          <>
            <div className={sectionCls}>Статистик</div>
            <div className="space-y-2">
              <div><span className={label}>Том тоо</span><input value={statBigNumber} onChange={(e) => setStatBigNumber(e.target.value)} className={ic} /></div>
              <div><span className={label}>Тоон тайлбар</span><input value={statBigLabel} onChange={(e) => setStatBigLabel(e.target.value)} className={ic} /></div>
              <div><span className={label}>Эх сурвалж</span><input value={statSource} onChange={(e) => setStatSource(e.target.value)} className={ic} /></div>
              {statItems.map((item, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <div><span className={label}>Тоо {i + 1}</span><input value={item.num} onChange={(e) => { const n = [...statItems]; n[i] = { ...n[i], num: e.target.value }; setStatItems(n); }} className={ic} /></div>
                  <div><span className={label}>Label {i + 1}</span><input value={item.label} onChange={(e) => { const n = [...statItems]; n[i] = { ...n[i], label: e.target.value }; setStatItems(n); }} className={ic} /></div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Social */}
        {template === "social" && (
          <>
            <div className={sectionCls}>Social Post</div>
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

        {/* Pricing / Course / Live / Announcement shared fields */}
        {(template === "pricing" || template === "course" || template === "live" || template === "announcement") && (
          <>
            <div className={sectionCls}>Үндсэн текст</div>
            <div className="space-y-2">
              <div><span className={label}>Tag</span><input value={tag} onChange={(e) => setTag(e.target.value)} className={ic} /></div>
              <div><span className={label}>Гарчиг 1</span><input value={title1} onChange={(e) => setTitle1(e.target.value)} className={ic} /></div>
              <div><span className={label}>Гарчиг 2 (өнгөтэй)</span><input value={title2} onChange={(e) => setTitle2(e.target.value)} className={ic} /></div>
              <div><span className={label}>Subtitle</span><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={ic} /></div>
              <div><span className={label}>Badge</span><input value={badge} onChange={(e) => setBadge(e.target.value)} className={ic} /></div>
            </div>
          </>
        )}

        {template === "pricing" && (
          <>
            <div className={sectionCls}>Үнийн мэдээлэл</div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><span className={label}>Үнэ</span><input value={price} onChange={(e) => setPrice(e.target.value)} className={ic} /></div>
                <div><span className={label}>Хугацаа</span><input value={period} onChange={(e) => setPeriod(e.target.value)} className={ic} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2"><div><span className={label}>Key 1</span><input value={k1} onChange={(e) => setK1(e.target.value)} className={ic} /></div><div><span className={label}>Val 1</span><input value={v1} onChange={(e) => setV1(e.target.value)} className={ic} /></div></div>
              <div className="grid grid-cols-2 gap-2"><div><span className={label}>Key 2</span><input value={k2} onChange={(e) => setK2(e.target.value)} className={ic} /></div><div><span className={label}>Val 2</span><input value={v2} onChange={(e) => setV2(e.target.value)} className={ic} /></div></div>
              <div className="grid grid-cols-2 gap-2"><div><span className={label}>Key 3</span><input value={k3} onChange={(e) => setK3(e.target.value)} className={ic} /></div><div><span className={label}>Val 3</span><input value={v3} onChange={(e) => setV3(e.target.value)} className={ic} /></div></div>
              <div className="grid grid-cols-2 gap-2"><div><span className={label}>Том тоо</span><input value={bigNum} onChange={(e) => setBigNum(e.target.value)} className={ic} /></div><div><span className={label}>Тоо label</span><input value={bigNumLabel} onChange={(e) => setBigNumLabel(e.target.value)} className={ic} /></div></div>
            </div>
          </>
        )}

        {template === "course" && (
          <>
            <div className={sectionCls}>Хичээлийн мэдээлэл</div>
            <div className="space-y-2">
              <div><span className={label}>Хичээл 1</span><input value={l1} onChange={(e) => setL1(e.target.value)} className={ic} /></div>
              <div><span className={label}>Хичээл 1 sub</span><input value={l1s} onChange={(e) => setL1s(e.target.value)} className={ic} /></div>
              <div><span className={label}>Хичээл 2</span><input value={l2} onChange={(e) => setL2(e.target.value)} className={ic} /></div>
              <div><span className={label}>Хичээл 3</span><input value={l3} onChange={(e) => setL3(e.target.value)} className={ic} /></div>
              <div><span className={label}>Хичээл 4</span><input value={l4} onChange={(e) => setL4(e.target.value)} className={ic} /></div>
              <div className="grid grid-cols-2 gap-2"><div><span className={label}>Хугацаа</span><input value={duration} onChange={(e) => setDuration(e.target.value)} className={ic} /></div><div><span className={label}>Зорилго</span><input value={goal} onChange={(e) => setGoal(e.target.value)} className={ic} /></div></div>
              <div><span className={label}>Явц %</span><input type="range" min="0" max="100" value={progress} onChange={(e) => setProgress(e.target.value)} className="w-full accent-[#EF2C58]" /></div>
            </div>
          </>
        )}

        {template === "live" && (
          <>
            <div className={sectionCls}>Live мэдээлэл</div>
            <div className="space-y-2">
              <div><span className={label}>Цаг</span><input value={liveTime} onChange={(e) => setLiveTime(e.target.value)} className={ic} /></div>
              <div><span className={label}>Цагийн label</span><input value={liveLabel} onChange={(e) => setLiveLabel(e.target.value)} className={ic} /></div>
              <div className="grid grid-cols-2 gap-2"><div><span className={label}>Key 1</span><input value={k1} onChange={(e) => setK1(e.target.value)} className={ic} /></div><div><span className={label}>Val 1</span><input value={v1} onChange={(e) => setV1(e.target.value)} className={ic} /></div></div>
              <div className="grid grid-cols-2 gap-2"><div><span className={label}>Key 2</span><input value={k2} onChange={(e) => setK2(e.target.value)} className={ic} /></div><div><span className={label}>Val 2</span><input value={v2} onChange={(e) => setV2(e.target.value)} className={ic} /></div></div>
              <div><span className={label}>Платформ</span><input value={platform} onChange={(e) => setPlatform(e.target.value)} className={ic} /></div>
            </div>
          </>
        )}

        {template === "announcement" && (
          <>
            <div className={sectionCls}>Зарлалын агуулга</div>
            <div className="space-y-2">
              <div><span className={label}>Том тоо / огноо</span><input value={bigNum} onChange={(e) => setBigNum(e.target.value)} className={ic} /></div>
              <div><span className={label}>Label</span><input value={bigNumLabel} onChange={(e) => setBigNumLabel(e.target.value)} className={ic} /></div>
              <div className="grid grid-cols-2 gap-2"><div><span className={label}>Key 1</span><input value={k1} onChange={(e) => setK1(e.target.value)} className={ic} /></div><div><span className={label}>Val 1</span><input value={v1} onChange={(e) => setV1(e.target.value)} className={ic} /></div></div>
              <div className="grid grid-cols-2 gap-2"><div><span className={label}>Key 2</span><input value={k2} onChange={(e) => setK2(e.target.value)} className={ic} /></div><div><span className={label}>Val 2</span><input value={v2} onChange={(e) => setV2(e.target.value)} className={ic} /></div></div>
              <div><span className={label}>Зорилго</span><input value={goal} onChange={(e) => setGoal(e.target.value)} className={ic} /></div>
            </div>
          </>
        )}

        {/* Toggles */}
        <div className={sectionCls}>Харагдах байдал</div>
        <div className="space-y-2.5">
          {[
            { label: "Grid background", val: showGrid, set: setShowGrid },
            { label: "Scan line", val: showScan, set: setShowScan },
            { label: "Badge", val: showBadge, set: setShowBadge },
            { label: "Antaqor лого", val: showLogo, set: setShowLogo },
          ].map((t) => (
            <div key={t.label} className="flex items-center justify-between">
              <span className="text-[10px] text-[#AAA]">{t.label}</span>
              <button
                onClick={() => t.set(!t.val)}
                className={`relative h-[20px] w-[36px] rounded-full transition ${t.val ? "bg-[#EF2C58]" : "bg-[rgba(255,255,255,0.1)]"}`}
              >
                <span className={`absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-all shadow-sm ${t.val ? "left-[18px]" : "left-[2px]"}`} />
              </button>
            </div>
          ))}
        </div>

        {/* Bottom fields */}
        <div className={sectionCls}>Доод хэсэг</div>
        <div className="space-y-2">
          <div><span className={label}>CTA текст</span><input value={cta} onChange={(e) => setCta(e.target.value)} className={ic} /></div>
          <div><span className={label}>Watermark</span><input value={watermark} onChange={(e) => setWatermark(e.target.value)} className={ic} /></div>
        </div>

        {/* Download */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-[4px] bg-[#EF2C58] py-3.5 text-[11px] font-bold uppercase tracking-[2px] text-white transition hover:shadow-[0_0_32px_rgba(239,44,88,0.3)] disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          {downloading ? "Татаж байна..." : "PNG ТАТАХ (3x)"}
        </button>
      </div>

      {/* ═══ RIGHT PREVIEW ═══ */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#0A0A0A] p-8" style={{ minHeight: "100vh" }}>
        <div className="mb-4 flex items-center gap-4">
          <span className="text-[9px] uppercase tracking-[2px] text-[#555]">
            {dim.w}x{dim.h} · {dim.label}
          </span>
          {totalPages > 1 && (
            <span className="rounded-full bg-[rgba(239,44,88,0.1)] px-3 py-1 text-[9px] font-bold text-[#EF2C58]">
              {currentPage}/{totalPages}
            </span>
          )}
        </div>

        <div style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
          <div
            ref={canvasRef}
            style={{
              width: dim.w, height: dim.h, background: "#050505",
              position: "relative", overflow: "hidden",
              fontFamily: "'Inter', 'IBM Plex Sans', system-ui, sans-serif",
            }}
          >
            {/* Grid */}
            {showGrid && (
              <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(239,44,88,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(239,44,88,0.03) 1px, transparent 1px)`, backgroundSize: "30px 30px" }} />
            )}

            {/* Uploaded image */}
            {uploadedImage && (
              <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${uploadedImage})`, backgroundSize: "cover", backgroundPosition: "center", opacity: imageOpacity / 100 }} />
            )}

            {/* Scan line */}
            {showScan && (
              <div style={{ position: "absolute", width: "100%", height: 1, background: "rgba(239,44,88,0.12)", animation: "posterScan 4s linear infinite", zIndex: 2 }} />
            )}

            {/* Top accent bar */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: B }} />

            {/* Corner marks */}
            {[
              { top: 12, left: 12, borderTop: `1px solid rgba(239,44,88,0.4)`, borderLeft: `1px solid rgba(239,44,88,0.4)` },
              { top: 12, right: 12, borderTop: `1px solid rgba(239,44,88,0.4)`, borderRight: `1px solid rgba(239,44,88,0.4)` },
              { bottom: 12, left: 12, borderBottom: `1px solid rgba(239,44,88,0.4)`, borderLeft: `1px solid rgba(239,44,88,0.4)` },
              { bottom: 12, right: 12, borderBottom: `1px solid rgba(239,44,88,0.4)`, borderRight: `1px solid rgba(239,44,88,0.4)` },
            ].map((s, i) => (
              <div key={i} style={{ position: "absolute", width: 16, height: 16, zIndex: 10, ...s } as React.CSSProperties} />
            ))}

            {/* Logo */}
            {showLogo && (
              <div style={{ position: "absolute", top: 20, left: 24, zIndex: 10, display: "flex", alignItems: "center", gap: 8 }}>
                {customLogo ? (
                  <img src={customLogo} alt="" style={{ height: 20, width: "auto", objectFit: "contain" }} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 20, height: 20, background: B, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, color: "#fff" }}>A</span>
                    </div>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600, color: "#fff", letterSpacing: "0.2em" }}>ANTAQOR</span>
                  </div>
                )}
              </div>
            )}

            {/* Carousel dots */}
            {totalPages > 1 && (
              <div style={{ position: "absolute", top: 22, right: 24, zIndex: 10, display: "flex", alignItems: "center", gap: 4 }}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <div key={i} style={{
                    width: i + 1 === currentPage ? 14 : 5,
                    height: 5,
                    borderRadius: 3,
                    background: i + 1 === currentPage ? B : "rgba(255,255,255,0.25)",
                    transition: "all 0.2s",
                  }} />
                ))}
              </div>
            )}

            {/* Content */}
            <div style={{
              position: "relative", zIndex: 5, height: "100%",
              display: "flex", flexDirection: "column",
              padding: showLogo ? (aspect === "9:16" ? "52px 24px 24px" : "52px 28px 28px") : (aspect === "9:16" ? "28px 24px 24px" : "32px 28px 28px"),
            }}>
              {template === "educational" && <EducationalContent category={eduCategory} number={eduNumber} title={eduTitle} points={eduPoints} takeaway={eduTakeaway} compact={compact} />}
              {template === "tip" && <TipContent number={tipNumber} title={tipTitle} body={tipBody} tipDo={tipDo} tipDont={tipDont} compact={compact} />}
              {template === "stat" && <StatContent bigNumber={statBigNumber} bigLabel={statBigLabel} source={statSource} items={statItems} compact={compact} />}
              {template === "social" && <SocialContent handle={handle} quote={quote} body={body} statNums={statNums} statLabels={statLabels} compact={compact} />}
              {template === "pricing" && <PricingContent tag={tag} title1={title1} title2={title2} subtitle={subtitle} badge={badge} showBadge={showBadge} price={price} period={period} k1={k1} v1={v1} k2={k2} v2={v2} k3={k3} v3={v3} bigNum={bigNum} bigNumLabel={bigNumLabel} cta={cta} compact={compact} />}
              {template === "course" && <CourseContent tag={tag} title1={title1} title2={title2} subtitle={subtitle} badge={badge} showBadge={showBadge} l1={l1} l1s={l1s} l2={l2} l3={l3} l4={l4} duration={duration} goal={goal} progress={parseInt(progress)} cta={cta} compact={compact} />}
              {template === "live" && <LiveContent tag={tag} title1={title1} title2={title2} subtitle={subtitle} badge={badge} showBadge={showBadge} liveTime={liveTime} liveLabel={liveLabel} k1={k1} v1={v1} k2={k2} v2={v2} platform={platform} cta={cta} compact={compact} />}
              {template === "announcement" && <AnnouncementContent tag={tag} title1={title1} title2={title2} subtitle={subtitle} badge={badge} showBadge={showBadge} bigNum={bigNum} bigNumLabel={bigNumLabel} k1={k1} v1={v1} k2={k2} v2={v2} goal={goal} cta={cta} compact={compact} />}
            </div>

            {/* Watermark */}
            <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, color: "rgba(255,255,255,0.12)", letterSpacing: "0.3em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {watermark}
            </div>
          </div>
        </div>
      </div>

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
const Bdim = "rgba(239,44,88,0.06)";
const Bborder = "rgba(239,44,88,0.25)";

function PosterTag({ text }: { text: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: 9, color: B, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 14 }}>
      <span style={{ width: 5, height: 5, background: B, borderRadius: "50%", animation: "posterBlink 1.2s step-end infinite" }} />
      {text}
    </div>
  );
}

function PosterHeader({ title1, title2, subtitle, badge, showBadge, compact }: { title1: string; title2: string; subtitle: string; badge: string; showBadge: boolean; compact?: boolean }) {
  return (
    <>
      <div style={{ fontSize: compact ? 26 : 32, fontWeight: 700, color: "#fff", lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: 4 }}>
        {title1}<span style={{ color: B, display: "block" }}>{title2}</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 10, color: "#888", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: compact ? 12 : 18 }}>{subtitle}</div>
      <div style={{ height: 1, background: `linear-gradient(90deg, ${B} 0%, transparent 100%)`, marginBottom: compact ? 10 : 14, opacity: 0.4 }} />
      {showBadge && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: Bdim, border: `1px solid ${Bborder}`, padding: "4px 10px", marginBottom: compact ? 10 : 14, fontFamily: mono, fontSize: 9, color: B, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          <span style={{ width: 5, height: 5, background: B, borderRadius: "50%", animation: "posterPulse 1s ease-in-out infinite" }} />
          {badge}
        </div>
      )}
    </>
  );
}

function InfoBlock({ rows }: { rows: { key: string; val: string; highlight?: boolean }[] }) {
  return (
    <div style={{ border: "1px solid rgba(239,44,88,0.08)", background: "rgba(239,44,88,0.02)", position: "relative", marginBottom: 12 }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: B }} />
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 14px", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
          <span style={{ fontFamily: mono, fontSize: 10, color: "#888", letterSpacing: "0.08em" }}>{r.key}</span>
          <span style={{ fontFamily: mono, fontSize: 11, color: r.highlight ? B : "#fff", fontWeight: 500 }}>{r.val}</span>
        </div>
      ))}
    </div>
  );
}

function CtaBar({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
      <div style={{ fontFamily: mono, fontSize: 8, color: "#555", letterSpacing: "0.2em", textTransform: "uppercase" }}>{text}</div>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

// ═══════════════════════════════════════════
// NEW: Educational Template
// ═══════════════════════════════════════════
function EducationalContent({ category, number, title, points, takeaway, compact }: {
  category: string; number: string; title: string; points: string[]; takeaway: string; compact?: boolean;
}) {
  return (
    <>
      {/* Category badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ fontFamily: mono, fontSize: 8, color: "#000", background: B, padding: "3px 8px", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>{category}</div>
        <span style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>{number}</span>
      </div>

      {/* Title */}
      <div style={{ fontSize: compact ? 18 : 22, fontWeight: 700, color: "#fff", lineHeight: 1.3, letterSpacing: "-0.01em", marginBottom: 18 }}>
        {title}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: `linear-gradient(90deg, ${B}, transparent)`, opacity: 0.3, marginBottom: 16 }} />

      {/* Points */}
      <div style={{ flex: 1 }}>
        {points.filter(p => p).map((point, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 20, height: 20, background: i === 0 ? B : "rgba(239,44,88,0.08)", border: i === 0 ? "none" : `1px solid ${Bborder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
              <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: i === 0 ? "#fff" : B }}>{i + 1}</span>
            </div>
            <span style={{ fontSize: compact ? 11 : 12, color: "#ddd", lineHeight: 1.5 }}>{point}</span>
          </div>
        ))}
      </div>

      {/* Takeaway */}
      {takeaway && (
        <div style={{ marginTop: "auto" }}>
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 12 }} />
          <div style={{ background: "rgba(239,44,88,0.04)", border: "1px solid rgba(239,44,88,0.12)", padding: "10px 14px", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: B }} />
            <div style={{ fontFamily: mono, fontSize: 8, color: B, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>ГҮНЗГИЙ САНАА</div>
            <div style={{ fontSize: compact ? 10 : 11, color: "#ccc", lineHeight: 1.5 }}>{takeaway}</div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════
// NEW: Tip Template
// ═══════════════════════════════════════════
function TipContent({ number, title, body, tipDo, tipDont, compact }: {
  number: string; title: string; body: string; tipDo: string; tipDont: string; compact?: boolean;
}) {
  return (
    <>
      {/* Tip number */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ fontFamily: mono, fontSize: compact ? 36 : 44, fontWeight: 700, color: B, lineHeight: 1, letterSpacing: "-0.03em" }}>{number}</div>
        <div>
          <div style={{ fontFamily: mono, fontSize: 8, color: B, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600 }}>AI TIP</div>
          <div style={{ fontFamily: mono, fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>ANTAQOR</div>
        </div>
      </div>

      {/* Title */}
      <div style={{ fontSize: compact ? 18 : 22, fontWeight: 700, color: "#fff", lineHeight: 1.3, letterSpacing: "-0.01em", marginBottom: 14 }}>
        {title}
      </div>

      {/* Body */}
      <div style={{ fontSize: compact ? 11 : 12, color: "#bbb", lineHeight: 1.7, marginBottom: 18, borderLeft: "2px solid rgba(239,44,88,0.15)", paddingLeft: 12 }}>
        {body}
      </div>

      {/* Do / Don't */}
      <div style={{ marginTop: "auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 0 }}>
          <div style={{ flex: 1, background: "rgba(239,44,88,0.06)", border: "1px solid rgba(239,44,88,0.15)", padding: "10px 12px" }}>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#EF2C58", letterSpacing: "0.15em", marginBottom: 4, fontWeight: 600 }}>ZӨB</div>
            <div style={{ fontSize: compact ? 10 : 11, color: "#ddd", lineHeight: 1.4 }}>{tipDo}</div>
          </div>
          <div style={{ flex: 1, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", padding: "10px 12px" }}>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#EF4444", letterSpacing: "0.15em", marginBottom: 4, fontWeight: 600 }}>БУРУУ</div>
            <div style={{ fontSize: compact ? 10 : 11, color: "#ddd", lineHeight: 1.4 }}>{tipDont}</div>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
// NEW: Stat Template
// ═══════════════════════════════════════════
function StatContent({ bigNumber, bigLabel, source, items, compact }: {
  bigNumber: string; bigLabel: string; source: string; items: { num: string; label: string }[]; compact?: boolean;
}) {
  return (
    <>
      <PosterTag text="Статистик" />

      {/* Big number */}
      <div style={{ fontFamily: mono, fontSize: compact ? 64 : 80, fontWeight: 700, color: B, lineHeight: 0.9, letterSpacing: "-0.04em", marginBottom: 8 }}>{bigNumber}</div>
      <div style={{ fontSize: compact ? 13 : 15, fontWeight: 600, color: "#fff", lineHeight: 1.3, marginBottom: 6, maxWidth: "85%" }}>{bigLabel}</div>
      <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", marginBottom: 20 }}>{source}</div>

      <div style={{ height: 1, background: `linear-gradient(90deg, ${B}, transparent)`, opacity: 0.3, marginBottom: 18 }} />

      {/* Sub stats */}
      <div style={{ display: "flex", gap: 0, border: "1px solid rgba(239,44,88,0.08)", marginBottom: 14 }}>
        {items.map((item, i) => (
          <div key={i} style={{ flex: 1, padding: compact ? "10px 10px" : "12px 14px", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            <div style={{ fontFamily: mono, fontSize: compact ? 18 : 22, fontWeight: 700, color: B, lineHeight: 1, marginBottom: 4 }}>{item.num}</div>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#888", letterSpacing: "0.1em", textTransform: "uppercase" }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 500, color: B, letterSpacing: "0.15em" }}>ANTAQOR</div>
          <div style={{ fontFamily: mono, fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>Cyber Empire</div>
        </div>
        <div style={{ fontFamily: mono, fontSize: 9, color: "#000", background: B, padding: "6px 14px", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 500 }}>
          ДЭЛГЭРЭНГҮЙ
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
// Existing Templates (with whiter text)
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
        <div style={{ fontFamily: mono, fontSize: 9, color: "#888", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>Одоогийн үнэ</div>
        <div style={{ fontFamily: mono, fontSize: compact ? 36 : 46, fontWeight: 700, color: B, lineHeight: 1, letterSpacing: "-0.03em" }}>{price}</div>
        <div style={{ fontFamily: mono, fontSize: 11, color: "#888", letterSpacing: "0.1em" }}>/ {period}</div>
      </div>
      <div style={{ marginTop: "auto" }}>
        <CtaBar text={cta} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#888", letterSpacing: "0.15em", textTransform: "uppercase" }}>Гишүүд</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>{bigNum}</div>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#555", letterSpacing: "0.08em", marginTop: 2 }}>{bigNumLabel}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#888", letterSpacing: "0.15em", textTransform: "uppercase" }}>Одоо элсэх</div>
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
      <div style={{ border: "1px solid rgba(239,44,88,0.08)", position: "relative", marginBottom: 12 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: B }} />
        {lessons.map((ls, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none", background: ls.active ? "rgba(239,44,88,0.04)" : "transparent" }}>
            <span style={{ fontFamily: mono, fontSize: 9, color: ls.active ? B : "#555", minWidth: 20, letterSpacing: "0.05em" }}>{ls.num}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: ls.active ? "#fff" : "#aaa", marginBottom: ls.sub ? 2 : 0 }}>{ls.title}</div>
              {ls.sub && <div style={{ fontFamily: mono, fontSize: 9, color: ls.active ? "#888" : "#555" }}>{ls.sub}</div>}
            </div>
            {ls.active && <span style={{ fontFamily: mono, fontSize: 8, color: B, border: `1px solid rgba(239,44,88,0.3)`, padding: "2px 7px", letterSpacing: "0.1em" }}>TODAY</span>}
          </div>
        ))}
      </div>
      <div style={{ marginTop: "auto" }}>
        <CtaBar text={cta} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#888", letterSpacing: "0.15em", textTransform: "uppercase" }}>Хугацаа</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{duration}</div>
          </div>
          <div style={{ flex: 1, margin: "0 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 8, color: "#555", letterSpacing: "0.1em", marginBottom: 4 }}><span>Эхлэл</span><span>Бүрэн</span></div>
            <div style={{ height: 2, background: "rgba(255,255,255,0.06)", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, progress)}%`, background: B }} />
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#888", letterSpacing: "0.12em", textTransform: "uppercase" }}>Зорилго</div>
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
  return (
    <>
      <PosterTag text={tag} />
      <PosterHeader title1={title1} title2={title2} subtitle={subtitle} badge={badge} showBadge={showBadge} compact={compact} />
      <div style={{ fontFamily: mono, fontSize: compact ? 46 : 54, fontWeight: 700, color: B, lineHeight: 1, letterSpacing: "-0.03em", marginBottom: 4 }}>{liveTime}</div>
      <div style={{ fontFamily: mono, fontSize: 9, color: "#555", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>{liveLabel}</div>
      <InfoBlock rows={[{ key: k1, val: v1, highlight: true }, { key: k2, val: v2 }]} />
      <div style={{ marginTop: "auto" }}>
        <CtaBar text={cta} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#888", letterSpacing: "0.15em", textTransform: "uppercase" }}>Платформ</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{platform}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid rgba(239,44,88,0.3)`, background: "rgba(239,44,88,0.06)", padding: "7px 14px" }}>
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
      <div style={{ fontFamily: mono, fontSize: compact ? 38 : 46, fontWeight: 700, color: B, lineHeight: 1, letterSpacing: "-0.03em", marginBottom: 4 }}>{bigNum}</div>
      <div style={{ fontFamily: mono, fontSize: 9, color: "#555", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>{bigNumLabel}</div>
      <InfoBlock rows={[{ key: k1, val: v1, highlight: true }, { key: k2, val: v2 }]} />
      <div style={{ marginTop: "auto" }}>
        <CtaBar text={cta} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid rgba(239,44,88,0.3)`, background: "rgba(239,44,88,0.06)", padding: "7px 14px" }}>
            <span style={{ width: 7, height: 7, background: B, borderRadius: "50%", animation: "posterPulse 1s ease-in-out infinite" }} />
            <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 500, color: B, letterSpacing: "0.2em" }}>LIVE</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#888", letterSpacing: "0.12em", textTransform: "uppercase" }}>Үйлдэл</div>
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, background: B, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: "#fff" }}>AQ</span>
        </div>
        <div>
          <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 500, color: "#fff", letterSpacing: "0.05em" }}>{handle}</div>
          <div style={{ fontFamily: mono, fontSize: 8, color: "#000", background: B, padding: "1px 6px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500, display: "inline-block" }}>AI COMMUNITY</div>
        </div>
      </div>

      <div style={{ fontFamily: mono, fontSize: 36, color: "rgba(239,44,88,0.15)", lineHeight: 0.6, marginBottom: 8, fontWeight: 700 }}>&ldquo;</div>
      <div style={{ fontSize: compact ? 16 : 18, fontWeight: 700, color: "#fff", lineHeight: 1.35, letterSpacing: "-0.01em", marginBottom: 14 }} dangerouslySetInnerHTML={{ __html: qHTML }} />

      {body && (
        <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.7, marginBottom: 14, borderLeft: "2px solid rgba(239,44,88,0.15)", paddingLeft: 12 }}>{body}</div>
      )}

      <div style={{ height: 1, background: `linear-gradient(90deg, ${B}, transparent)`, opacity: 0.2, marginBottom: 12 }} />

      <div style={{ display: "flex", border: "1px solid rgba(239,44,88,0.08)", marginBottom: 12 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ flex: 1, padding: "8px 12px", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: B, lineHeight: 1, marginBottom: 2 }}>{statNums[i]}</div>
            <div style={{ fontFamily: mono, fontSize: 8, color: "#888", letterSpacing: "0.1em", textTransform: "uppercase" }}>{statLabels[i]}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 500, color: B, letterSpacing: "0.15em" }}>ANTAQOR</div>
          <div style={{ fontFamily: mono, fontSize: 8, color: "#555", letterSpacing: "0.1em" }}>antaqor.com</div>
        </div>
        <div style={{ fontFamily: mono, fontSize: 9, color: "#000", background: B, padding: "6px 14px", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 500 }}>ДАГАХ</div>
      </div>
    </>
  );
}
