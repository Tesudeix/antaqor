"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { emitXPFromResponse } from "@/lib/xpToast";
import { CreditIcon } from "@/components/CreditIcon";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";

// ─── Brand icons (mirrored from /tools/nano-banano so the modal feels like
//     a quick-launch surface for the same AI toolset users already know) ──
const GoogleIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" className={className}>
    <path d="M2.55464 6.25768C3.24798 4.87705 4.31161 3.71644 5.62666 2.90557C6.94171 2.0947 8.45636 1.66553 10.0013 1.66602C12.2471 1.66602 14.1338 2.49102 15.5763 3.83685L13.1871 6.22685C12.323 5.40102 11.2246 4.98018 10.0013 4.98018C7.83047 4.98018 5.99297 6.44685 5.3388 8.41602C5.17214 8.91602 5.07714 9.44935 5.07714 9.99935C5.07714 10.5493 5.17214 11.0827 5.3388 11.5827C5.9938 13.5527 7.83047 15.0185 10.0013 15.0185C11.1221 15.0185 12.0763 14.7227 12.823 14.2227C13.2558 13.9377 13.6264 13.5679 13.9123 13.1356C14.1982 12.7033 14.3935 12.2176 14.4863 11.7077H10.0013V8.48435H17.8496C17.948 9.02935 18.0013 9.59768 18.0013 10.1885C18.0013 12.7268 17.093 14.8635 15.5163 16.3135C14.138 17.5868 12.2513 18.3327 10.0013 18.3327C8.90683 18.3331 7.823 18.1179 6.81176 17.6992C5.80051 17.2806 4.88168 16.6668 4.10777 15.8929C3.33386 15.119 2.72005 14.2001 2.30141 13.1889C1.88278 12.1777 1.66753 11.0938 1.66797 9.99935C1.66797 8.65435 1.98964 7.38268 2.55464 6.25768Z" fill="currentColor" />
  </svg>
);

const ChatGptIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M22.408 9.80741C22.9487 8.17778 22.7685 6.37037 21.8974 4.88889C20.5758 2.60741 17.9024 1.45185 15.2891 1.98519C14.1477 0.711111 12.4656 0 10.7234 0C8.0501 0 5.70717 1.68889 4.86612 4.17778C3.15398 4.53333 1.68214 5.57037 0.811051 7.08148C-0.510601 9.36296 -0.210226 12.2074 1.56199 14.163C1.02131 15.8222 1.23158 17.6 2.10267 19.0815C3.42432 21.363 6.09766 22.5481 8.71093 21.9852C9.88239 23.2593 11.5345 24 13.2766 24C15.95 24 18.2929 22.3111 19.134 19.8222C20.8461 19.4667 22.3179 18.4296 23.189 16.9185C24.5107 14.637 24.2103 11.763 22.408 9.80741ZM13.2766 22.4296C12.1953 22.4296 11.174 22.0741 10.363 21.3926C10.393 21.363 10.4831 21.3333 10.5132 21.3037L15.3492 18.5481C15.5895 18.4 15.7397 18.163 15.7397 17.8667V11.1407L17.7823 12.2963C17.8123 12.2963 17.8123 12.3259 17.8123 12.3556V17.9259C17.8423 20.4148 15.7998 22.4296 13.2766 22.4296ZM3.48439 18.3111C2.94372 17.3926 2.76349 16.3259 2.94372 15.2889C2.97375 15.3185 3.03383 15.3481 3.0939 15.3778L7.92995 18.1333C8.17025 18.2815 8.47063 18.2815 8.71093 18.1333L14.6283 14.7556V17.0963C14.6283 17.1259 14.6283 17.1556 14.5983 17.1556L9.70216 19.9407C7.53946 21.1852 4.74597 20.4444 3.48439 18.3111ZM2.22282 7.88148C2.76349 6.96296 3.60454 6.28148 4.59578 5.8963V11.5852C4.59578 11.8519 4.74597 12.1185 4.98627 12.2667L10.9037 15.6444L8.86111 16.8C8.83108 16.8 8.80104 16.8296 8.80104 16.8L3.90492 14.0148C1.68214 12.7704 0.961239 10.0148 2.22282 7.88148ZM19.0438 11.7333L13.1264 8.35556L15.169 7.2C15.199 7.2 15.2291 7.17037 15.2291 7.2L20.1252 9.98519C22.3179 11.2296 23.0388 13.9852 21.7773 16.1185C21.2366 17.037 20.3955 17.7185 19.4043 18.0741V12.4148C19.4343 12.1481 19.2841 11.8815 19.0438 11.7333ZM21.0564 8.71111C21.0263 8.68148 20.9662 8.65185 20.9062 8.62222L16.0701 5.86667C15.8298 5.71852 15.5294 5.71852 15.2891 5.86667L9.37175 9.24444V6.9037C9.37175 6.87407 9.37175 6.84444 9.40179 6.84444L14.2979 4.05926C16.4906 2.81481 19.2541 3.55556 20.5157 5.71852C21.0564 6.60741 21.2366 7.67407 21.0564 8.71111ZM8.26036 12.8593L6.21781 11.7037C6.18777 11.7037 6.18777 11.6741 6.18777 11.6444V6.07407C6.18777 3.58519 8.23032 1.57037 10.7535 1.57037C11.8348 1.57037 12.8561 1.92593 13.6671 2.60741C13.6371 2.63704 13.577 2.66667 13.5169 2.6963L8.68089 5.45185C8.44059 5.6 8.2904 5.83704 8.2904 6.13333V12.8593H8.26036ZM9.37175 10.4889L12.0151 8.97778L14.6584 10.4889V13.4815L12.0151 14.9926L9.37175 13.4815V10.4889Z" fill="currentColor" />
  </svg>
);

const KlingIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M16.7522 2.86984L16.818 2.93745L16.8199 2.93552C18.087 4.25441 17.7236 6.90443 15.8863 9.90864L19.5 13.6567L19.3447 13.9703C18.7372 15.1986 17.9147 16.2992 16.9193 17.216C15.608 18.43 14.0251 19.2853 12.3143 19.7044L12.2522 19.7198L12.1634 19.7417L12.0994 19.7565L11.9584 19.7887L11.8416 19.8126L11.754 19.8299C11.6609 19.8493 11.5634 19.8673 11.4683 19.884L11.3888 19.8963L11.3286 19.904C11.2429 19.916 11.1576 19.9272 11.0727 19.9375C9.64831 20.1036 8.20616 19.9376 6.8516 19.4517C5.49703 18.9658 4.2643 18.1723 3.24348 17.1291L3.18385 17.0692C1.91429 15.7503 2.27391 13.0983 4.11366 10.0922L0.5 6.34416L0.65528 6.03054C1.26118 4.80131 2.0846 3.70115 3.08261 2.78741C4.10242 1.8473 5.28649 1.11848 6.57081 0.640344C6.86894 0.528933 7.18075 0.431691 7.48696 0.34926C7.73931 0.279139 7.9944 0.220054 8.25155 0.172163C8.33851 0.154131 8.43665 0.135456 8.53168 0.118712C10.0139 -0.12084 11.5297 0.00325476 12.9574 0.481036C14.385 0.958817 15.6847 1.77698 16.7522 2.86984ZM14.6876 8.95876C14.4708 10.2995 13.7559 11.6545 12.672 12.777C11.5913 13.9001 10.282 14.642 8.98696 14.8687C7.77516 15.0812 6.72981 14.8043 6.04472 14.0959C5.36149 13.3868 5.09441 12.3069 5.29938 11.044C5.51615 9.7045 6.22919 8.3489 7.30807 7.22771C8.40062 6.09944 9.70497 5.3595 10.9969 5.13539C12.2087 4.92287 13.2516 5.1985 13.9391 5.90818C14.6224 6.61657 14.8894 7.69847 14.6845 8.9594H14.6882L14.6876 8.95876Z"
      fill="currentColor"
    />
  </svg>
);

// ─── UI primitives ─────────────────────────────────────────────────────
function Icon({ path, cls = "h-4 w-4", stroke = 1.7 }: { path: string; cls?: string; stroke?: number }) {
  return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={stroke} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

const NEON = "var(--accent-ink, #2E29FF)";
const MAX_IMAGES = 4;

type Mode = "text" | "aiImage" | "aiVideo";
type AiModel = "nano2" | "nanoPro" | "gpt" | "kling";
type Aspect = "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
type Resolution = "standard" | "hd";

const MODELS: { id: AiModel; label: string; sub: string; cost: number; Icon: React.FC<{ className?: string }> }[] = [
  { id: "nano2",   label: "Nano Banana 2",   sub: "Gemini · ердийн",     cost: 10, Icon: GoogleIcon },
  { id: "nanoPro", label: "Nano Banana Pro", sub: "Gemini · дээд",       cost: 15, Icon: GoogleIcon },
  { id: "gpt",     label: "ChatGPT",         sub: "OpenAI · gpt-image",  cost: 15, Icon: ChatGptIcon },
  { id: "kling",   label: "Kling Image",     sub: "Kling AI · эх ref",   cost: 12, Icon: KlingIcon },
];

const ASPECTS: { id: Aspect; w: number; h: number; cls: string }[] = [
  { id: "1:1",  w: 18, h: 18, cls: "квадрат" },
  { id: "9:16", w: 12, h: 20, cls: "утас" },
  { id: "16:9", w: 22, h: 12, cls: "дэлгэц" },
  { id: "4:3",  w: 20, h: 15, cls: "4:3" },
  { id: "3:4",  w: 15, h: 20, cls: "3:4" },
];

const CATEGORY_PILLS = [
  { slug: "ялалт",     label: "Ялалт" },
  { slug: "промт",     label: "Промт" },
  { slug: "мэдээлэл",  label: "Мэдээлэл" },
  { slug: "бүтээл",    label: "Бүтээл" },
];

interface ImageCell { url: string; preview: string; }

export default function ComposerModal() {
  const router = useRouter();
  const { data: session } = useSession();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("aiImage");

  // Shared post body state
  const [content, setContent] = useState("");
  const [images, setImages] = useState<ImageCell[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoPreview, setVideoPreview] = useState("");
  const [videoDurationSec, setVideoDurationSec] = useState(0);
  const [aiPrompt, setAiPrompt] = useState("");
  const [category, setCategory] = useState("ерөнхий");

  // Category pills come from the admin-ordered /api/categories (same source as
  // the home feed tabs), so upload + feed categories stay consistent.
  const [pills, setPills] = useState<{ slug: string; label: string }[]>(CATEGORY_PILLS);
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.categories) && d.categories.length) {
          const list = d.categories
            .filter((c: { slug: string }) => c.slug !== "пост")
            .map((c: { slug: string; name: string }) => ({
              slug: c.slug,
              label: c.name.charAt(0).toUpperCase() + c.name.slice(1),
            }));
          if (list.length) setPills(list);
        }
      })
      .catch(() => {});
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // AI Image panel
  const [aiImgPrompt, setAiImgPrompt] = useState("");
  const [aiImgModel, setAiImgModel] = useState<AiModel>("nano2");
  const [aiImgAspect, setAiImgAspect] = useState<Aspect>("1:1");
  const [aiImgRes, setAiImgRes] = useState<Resolution>("standard");
  const [aiImgBusy, setAiImgBusy] = useState(false);
  const [aiImgError, setAiImgError] = useState("");

  // Synthesis (reference images for AI Image)
  const [refImages, setRefImages] = useState<string[]>([]); // data URIs
  const refInputRef = useRef<HTMLInputElement>(null);

  // AI Video panel
  const [aiVidPrompt, setAiVidPrompt] = useState("");
  const [aiVidDuration, setAiVidDuration] = useState<"5" | "10">("5");
  const [aiVidQuality, setAiVidQuality] = useState<"std" | "pro">("std");
  const [aiVidAspect, setAiVidAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [aiVidRefUrl, setAiVidRefUrl] = useState("");
  const [aiVidRefPreview, setAiVidRefPreview] = useState("");
  const [aiVidPhase, setAiVidPhase] = useState<"idle" | "submitting" | "polling">("idle");
  const [aiVidElapsed, setAiVidElapsed] = useState(0);
  const [aiVidStatus, setAiVidStatus] = useState("");
  const [aiVidError, setAiVidError] = useState("");
  const aiVidRefInputRef = useRef<HTMLInputElement>(null);

  // Plain upload (text mode)
  const fileRef = useRef<HTMLInputElement>(null);

  // Progressive disclosure — hide advanced options behind one tap
  const [showAiImgOptions, setShowAiImgOptions] = useState(false);
  const [showAiVidOptions, setShowAiVidOptions] = useState(false);

  // ─── Drag-driven motion values for smooth swipe-to-dismiss ────────────
  // The sheet's y is bound to a motion value so framer-motion can animate
  // it from any drag-released position straight to off-screen — no
  // snap-back-then-fly-down jank. Backdrop opacity tracks the same y.
  const sheetY = useMotionValue(0);
  const bgOpacity = useTransform(sheetY, [0, 320], [1, 0]);
  const closingRef = useRef(false);

  const reset = useCallback(() => {
    setContent("");
    setImages([]);
    setVideoUrl("");
    setVideoPreview("");
    setVideoDurationSec(0);
    setAiPrompt("");
    setCategory("ерөнхий");
    setMode("aiImage");
    setAiImgPrompt("");
    setAiImgRes("standard");
    setRefImages([]);
    setAiVidPrompt("");
    setAiVidRefUrl("");
    setAiVidRefPreview("");
    setAiVidPhase("idle");
    setAiVidElapsed(0);
    setError("");
    setAiImgError("");
    setAiVidError("");
  }, []);

  // Smooth close — animate sheetY DOWN from current dragged position to
  // off-screen, then unmount. Prevents the "snap-back-then-fly" jank when
  // the drag-end threshold trips.
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    animate(sheetY, 1200, {
      type: "spring",
      damping: 38,
      stiffness: 360,
      mass: 0.9,
      onComplete: () => {
        setOpen(false);
        closingRef.current = false;
      },
    });
  }, [sheetY]);

  // ─── Open via global event so any component can trigger us ────────────
  useEffect(() => {
    // Prime y BEFORE setting open so the first render of the sheet paints
    // it off-screen — prevents a 1-frame flash at rest before useEffect runs.
    const onOpen = () => { sheetY.set(1200); setOpen(true); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("composer:open", onOpen as EventListener);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("composer:open", onOpen as EventListener);
      window.removeEventListener("keydown", onKey);
    };
  }, [requestClose, sheetY]);

  // Animate sheet up from off-screen on open
  useEffect(() => {
    if (!open) return;
    closingRef.current = false;
    sheetY.set(1200);
    const c = animate(sheetY, 0, {
      type: "spring",
      damping: 34,
      stiffness: 320,
      mass: 0.9,
    });
    return () => c.stop();
  }, [open, sheetY]);

  // Body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!session) {
    // Even when not authed we still mount, but never render — no-op.
    // The + button itself will route to /auth/signin from the parents
    // if we ever wire that. For now, modal silently stays closed.
    if (open) setOpen(false);
  }

  // ─── Upload helpers ───────────────────────────────────────────────────
  const uploadFile = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      return res.ok ? (data.url as string) : null;
    } catch { return null; }
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;
    const accepted = files.slice(0, remaining).filter((f) => f.type.startsWith("image/") && f.size <= 12 * 1024 * 1024);
    const news = accepted.map((f) => ({ url: "", preview: URL.createObjectURL(f) }));
    setImages((prev) => [...prev, ...news]);
    const baseIdx = images.length;
    const uploaded = await Promise.all(accepted.map((f) => uploadFile(f)));
    setImages((prev) => {
      const next = [...prev];
      uploaded.forEach((u, i) => { if (u) next[baseIdx + i] = { ...next[baseIdx + i], url: u }; });
      return next.filter((c) => c.preview);
    });
  };

  // Reference image (synthesis) — data URI for the AI Image API
  const fileToDataURI = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const handleAddRef = async (files: File[]) => {
    const accepted = files.slice(0, 4 - refImages.length).filter((f) => f.type.startsWith("image/"));
    for (const f of accepted) {
      try { const uri = await fileToDataURI(f); setRefImages((p) => [...p, uri]); } catch { /* skip */ }
    }
  };

  // ─── AI Image: generate → push into images[] ──────────────────────────
  const handleAiImageGenerate = async () => {
    if (aiImgBusy) return;
    if (aiImgPrompt.trim().length < 3) { setAiImgError("Промпт хэт богино"); return; }
    if (images.length >= MAX_IMAGES) { setAiImgError(`Хамгийн ихдээ ${MAX_IMAGES} зураг`); return; }
    setAiImgError("");
    setAiImgBusy(true);
    try {
      const body: Record<string, unknown> = {
        prompt: aiImgPrompt.trim(),
        model: aiImgModel,
        aspectRatio: aiImgAspect,
        resolution: aiImgRes,
      };
      if (refImages.length > 0) {
        body.inputImages = refImages;
        body.inputImage = refImages[0];
      }
      const res = await fetch("/api/tools/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setAiImgError(data.error || "Үүсгэж чадсангүй"); return; }
      const url: string | undefined = data.url;
      if (!url) { setAiImgError("Зураг буцаагдсангүй"); return; }
      setImages((prev) => [...prev, { url, preview: url }]);
      setAiPrompt(aiImgPrompt.trim());
      setMode("text");
      setAiImgPrompt("");
      setRefImages([]);
    } catch {
      setAiImgError("Сүлжээний алдаа");
    } finally { setAiImgBusy(false); }
  };

  // ─── AI Video: upload ref → submit Kling i2v → poll → set videoUrl ────
  const uploadAiVidRef = async (file: File) => {
    setAiVidError("");
    setAiVidRefPreview(URL.createObjectURL(file));
    const url = await uploadFile(file);
    if (!url) { setAiVidError("Ачааллахад алдаа"); setAiVidRefPreview(""); return; }
    setAiVidRefUrl(url);
  };

  const handleAiVideoGenerate = async () => {
    if (aiVidPhase !== "idle") return;
    if (!aiVidRefUrl) { setAiVidError("Лавлагаа зураг шаардлагатай"); return; }
    if (aiVidPrompt.trim().length < 3) { setAiVidError("Промпт хэт богино"); return; }
    setAiVidError("");
    setAiVidPhase("submitting");
    setAiVidStatus("Дараалалд орлоо");
    setAiVidElapsed(0);
    try {
      const res = await fetch("/api/kling/image2video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: aiVidRefUrl,
          prompt: aiVidPrompt.trim(),
          duration: aiVidDuration,
          mode: aiVidQuality,
          aspectRatio: aiVidAspect,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiVidError(data.error || "Үүсгэх боломжгүй");
        setAiVidPhase("idle");
        return;
      }
      const taskId = data.taskId as string;
      setAiVidPhase("polling");
      const startedAt = Date.now();
      const elapsedTimer = setInterval(() => {
        setAiVidElapsed(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);

      const poll = async (): Promise<boolean> => {
        try {
          const r = await fetch(`/api/kling/status/${taskId}`);
          const d = await r.json();
          if (!r.ok) { setAiVidError(d.error || "Статус авах боломжгүй"); return true; }
          setAiVidStatus(
            d.status === "submitted" ? "Дараалалд орлоо" :
            d.status === "processing" ? "Боловсруулж байна" :
            d.status === "succeed" ? "Бэлэн боллоо" :
            d.status === "failed" ? (d.message || "Үүсгэхэд алдаа") : ""
          );
          if (d.status === "succeed" && d.videoUrl) {
            setVideoUrl(d.videoUrl);
            setVideoPreview(d.videoUrl);
            const dur = parseInt(String(d.duration || aiVidDuration), 10);
            setVideoDurationSec(Number.isFinite(dur) ? dur : parseInt(aiVidDuration, 10));
            setAiPrompt(aiVidPrompt.trim());
            setMode("text");
            return true;
          }
          if (d.status === "failed") { setAiVidError(d.message || "Үүсгэхэд алдаа"); return true; }
          return false;
        } catch { return false; }
      };

      let done = await poll();
      const interval = setInterval(async () => {
        if (done) return;
        done = await poll();
        if (done) {
          clearInterval(interval);
          clearInterval(elapsedTimer);
          setAiVidPhase("idle");
        }
      }, 4000);

      setTimeout(() => {
        if (!done) {
          clearInterval(interval);
          clearInterval(elapsedTimer);
          setAiVidPhase("idle");
          setAiVidError("Хугацаа дууссан");
        }
      }, 300_000);
    } catch {
      setAiVidError("Сүлжээний алдаа");
      setAiVidPhase("idle");
    }
  };

  // ─── Submit post ──────────────────────────────────────────────────────
  const validImages = images.filter((c) => c.url).map((c) => c.url);
  const canPost = !submitting && (content.trim().length > 0 || validImages.length > 0 || videoUrl);

  const handleSubmit = async () => {
    if (!canPost) return;
    setError("");
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        content: content.trim(),
        image: validImages[0] || "",
        images: validImages,
        category,
      };
      if (videoUrl) {
        body.video = videoUrl;
        body.videoDurationSec = videoDurationSec;
      }
      if (aiPrompt.trim()) body.aiPrompt = aiPrompt.trim();
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Илгээж чадсангүй"); return; }
      // Notify any mounted feed/profile to prepend the new post immediately —
      // no refetch latency, no waiting on router.refresh() to invalidate RSC.
      try {
        window.dispatchEvent(new CustomEvent("feed:refresh", { detail: data.post }));
      } catch { /* old browsers — fall back to navigation */ }
      emitXPFromResponse(data, "BUILD");
      requestClose();
      reset();
      router.push("/");
    } finally { setSubmitting(false); }
  };

  const finalCost = Math.ceil(MODELS.find((m) => m.id === aiImgModel)!.cost * (aiImgRes === "hd" ? 1.5 : 1));

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    open ? (
      <motion.div
        style={{ opacity: bgOpacity }}
        className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-md"
        onClick={requestClose}
      >
        {/* ─── Bottom sheet — slides up from bottom edge ──────────────── */}
        <motion.div
          style={{
            y: sheetY,
            backgroundImage:
              "radial-gradient(ellipse 60% 40% at top left, rgba(46,41,255,0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 30% at top right, rgba(46,41,255,0.06) 0%, transparent 60%)",
          }}
          drag="y"
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0.04 }}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            if (info.offset.y > 120 || info.velocity.y > 500) {
              requestClose();
            } else {
              animate(sheetY, 0, { type: "spring", damping: 30, stiffness: 320 });
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="relative max-h-[92vh] w-full max-w-[680px] overflow-hidden rounded-t-[4px] border border-b-0 border-[rgba(46,41,255,0.22)] bg-[#0A0A0A] shadow-[0_-24px_80px_rgba(0,0,0,0.8)] pb-[env(safe-area-inset-bottom)]"
        >
            {/* Bracket-corner ticks at top edge — Antaqor хүрээлэл HUD vibe */}
            <span className="pointer-events-none absolute left-3 top-3 h-2 w-2 border-l border-t border-[#2E29FF]" />
            <span className="pointer-events-none absolute right-3 top-3 h-2 w-2 border-r border-t border-[#2E29FF]" />
            {/* Bright accent edge segment top-left per SKILL.md */}
            <span className="pointer-events-none absolute left-3 top-0 h-px w-12 bg-gradient-to-r from-[#2E29FF] via-[#2E29FF] to-transparent shadow-[0_0_8px_rgba(46,41,255,0.6)]" />

            {/* ─── Drag handle ────────────────────────────────────────── */}
            <div className="flex cursor-grab items-center justify-center pb-1 pt-2 active:cursor-grabbing">
              <span className="h-1 w-10 rounded-[4px] bg-[rgba(15,23,38,0.18)]" />
            </div>

            {/* ─── Header strip: eyebrow + PATCH / LIVE pill ──────────── */}
            <div className="flex items-center justify-between px-5 pb-2 pt-1">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rotate-45 bg-[#2E29FF] shadow-[0_0_10px_rgba(46,41,255,0.8)]" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.30em] text-[#2E29FF]">
                  ANTAQOR / CREATE
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#5a5a5a]">
                  PATCH 001
                </span>
                <span className="flex items-center gap-1 rounded-[4px] border border-[rgba(46,41,255,0.45)] bg-[rgba(46,41,255,0.06)] px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#2E29FF] backdrop-blur">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-[#2E29FF] shadow-[0_0_6px_rgba(46,41,255,0.9)]" />
                  LIVE
                </span>
                <button
                  onClick={requestClose}
                  className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] text-[#E2E4E8] transition hover:border-[#2E29FF] hover:text-[#2E29FF]"
                  aria-label="Хаах"
                >
                  <Icon path="M6 18L18 6M6 6l12 12" cls="h-3 w-3" stroke={2.4} />
                </button>
              </div>
            </div>

            {/* ─── Handjet headline ───────────────────────────────────── */}
            <div className="px-5 pb-3">
              <h2
                style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  lineHeight: 0.92,
                }}
                className="text-[26px] uppercase text-[#f5f5f7] sm:text-[22px] md:text-[32px]"
              >
                ШИНЭ<span
                  style={{
                    color: "var(--accent-ink, #2E29FF)",
                    fontWeight: 900,
                    letterSpacing: "0.04em",
                    textShadow: "0 0 24px rgba(46,41,255,0.55), 0 0 48px rgba(46,41,255,0.35)",
                    WebkitTextStroke: "1px rgba(15,23,38,0.12)",
                  }}
                > ПОСТ</span><span style={{ color: "var(--accent-ink, #2E29FF)", textShadow: "0 0 20px #2E29FF" }}>.</span>
              </h2>
            </div>

            {/* Layered double-line divider — HUD-tactical per SKILL.md */}
            <div className="relative px-5 pb-3 pt-0.5">
              <div className="h-[2px] w-full bg-[#2E29FF] shadow-[0_0_8px_rgba(46,41,255,0.5)]" />
              <div
                className="mt-1 h-px w-full"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg, rgba(46,41,255,0.5) 0 3px, transparent 3px 6px)",
                }}
              />
            </div>

            {/* ─── Mode tabs (no emoji, mono labels) ──────────────────── */}
            <div className="px-3 pb-2">
              <div className="flex gap-1 rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] p-1">
                {([
                  { k: "aiImage" as Mode, label: "AI ЗУРАГ", iconPath: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
                  { k: "aiVideo" as Mode, label: "AI ВИДЕО", iconPath: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
                  { k: "text" as Mode,    label: "ТЕКСТ",    iconPath: "M4 6h16M4 12h16M4 18h12" },
                ]).map((m) => {
                  const active = mode === m.k;
                  return (
                    <button
                      key={m.k}
                      type="button"
                      onClick={() => setMode(m.k)}
                      className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-[4px] py-2 font-mono text-[10px] font-bold tracking-[0.22em] transition ${
                        active
                          ? "bg-[#2E29FF] text-white shadow-[0_0_14px_rgba(46,41,255,0.45)]"
                          : "text-[#E2E4E8] hover:text-[#0e1726]"
                      }`}
                    >
                      <Icon path={m.iconPath} cls="h-3.5 w-3.5" stroke={1.8} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Body — scrollable */}
            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {/* AI IMAGE PANEL */}
              {mode === "aiImage" && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <textarea
                    value={aiImgPrompt}
                    onChange={(e) => setAiImgPrompt(e.target.value.slice(0, 1000))}
                    placeholder="Юу үүсгэх вэ?  Жишээ: Cinematic portrait of a Mongolian creator in neon Ulaanbaatar"
                    rows={3}
                    className="w-full resize-none rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-3 py-2.5 text-[14px] leading-relaxed text-[#0e1726] placeholder:text-[#E2E4E8] focus:border-[#2E29FF] focus:outline-none"
                  />

                  {/* ─── Compact summary row — one click to expand options ─ */}
                  {(() => {
                    const m = MODELS.find((x) => x.id === aiImgModel)!;
                    const M = m.Icon;
                    return (
                      <button
                        type="button"
                        onClick={() => setShowAiImgOptions((v) => !v)}
                        className="flex w-full items-center gap-2 rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] p-2 text-left transition hover:border-[rgba(46,41,255,0.4)]"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(46,41,255,0.12)] text-[#2E29FF]">
                          <M className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-bold text-[#0e1726]">{m.label}</p>
                          <p className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-[#E2E4E8]">
                            {aiImgAspect} · {aiImgRes === "hd" ? "2K" : "1K"}
                            {refImages.length > 0 ? ` · ${refImages.length} REF` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-[4px] bg-[rgba(46,41,255,0.1)] px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-[#2E29FF]">
                          <CreditIcon size={10} className="mr-0.5" />{finalCost}
                        </span>
                        <Icon
                          path="M19 9l-7 7-7-7"
                          cls={`h-3.5 w-3.5 shrink-0 text-[#E2E4E8] transition-transform duration-200 ${showAiImgOptions ? "rotate-180 text-[#2E29FF]" : ""}`}
                          stroke={2.2}
                        />
                      </button>
                    );
                  })()}

                  {/* ─── Collapsible advanced options ───────────────────── */}
                  <AnimatePresence initial={false}>
                    {showAiImgOptions && (
                      <motion.div
                        key="aiImgOpts"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 pt-1">
                          {/* Model grid */}
                          <div className="grid grid-cols-2 gap-1.5">
                            {MODELS.map((m) => {
                              const active = aiImgModel === m.id;
                              const M = m.Icon;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => setAiImgModel(m.id)}
                                  className={`flex items-center gap-2 rounded-[4px] border p-2 text-left transition ${
                                    active
                                      ? "border-[#2E29FF] bg-[rgba(46,41,255,0.06)] shadow-[0_0_12px_rgba(46,41,255,0.18)]"
                                      : "border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] hover:border-[rgba(15,23,38,0.18)]"
                                  }`}
                                >
                                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] ${active ? "bg-[rgba(46,41,255,0.12)] text-[#2E29FF]" : "bg-[#ffffff] text-[#E2E4E8]"}`}>
                                    <M className="h-3.5 w-3.5" />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className={`truncate text-[11px] font-bold ${active ? "text-[#0e1726]" : "text-[#334155]"}`}>{m.label}</p>
                                    <p className="flex items-center gap-0.5 truncate font-mono text-[11px] tabular-nums text-[#E2E4E8]"><CreditIcon size={9} />{m.cost}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {/* Aspect chips + resolution */}
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1">
                              {ASPECTS.map((a) => {
                                const active = aiImgAspect === a.id;
                                return (
                                  <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => setAiImgAspect(a.id)}
                                    className={`flex items-center gap-1.5 rounded-[4px] border px-2 py-1 transition ${
                                      active ? "border-[#2E29FF] bg-[rgba(46,41,255,0.06)]" : "border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] hover:border-[rgba(15,23,38,0.16)]"
                                    }`}
                                  >
                                    <span
                                      className={`block rounded-[4px] ${active ? "bg-[#2E29FF]" : "bg-[#d5dce3]"}`}
                                      style={{ width: a.w / 2, height: a.h / 2 }}
                                    />
                                    <span className={`font-mono text-[10px] tabular-nums font-bold ${active ? "text-[#0e1726]" : "text-[#E2E4E8]"}`}>
                                      {a.id}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex gap-1 rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] p-1">
                              {([
                                { id: "standard" as Resolution, label: "1K · ХУРДАН" },
                                { id: "hd" as Resolution,       label: "2K · +50%" },
                              ]).map((r) => {
                                const active = aiImgRes === r.id;
                                return (
                                  <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => setAiImgRes(r.id)}
                                    className={`flex-1 rounded-[4px] py-1.5 font-mono text-[10px] font-bold tracking-[0.2em] transition ${active ? "bg-[#2E29FF] text-white" : "text-[#E2E4E8]"}`}
                                  >{r.label}</button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Synthesis */}
                          <div>
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8]">SYNTHESIS · {refImages.length}/4</span>
                              <button
                                type="button"
                                onClick={() => refInputRef.current?.click()}
                                className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#2E29FF] hover:text-[#f2547a]"
                              >
                                + ЗУРАГ
                              </button>
                            </div>
                            <input
                              ref={refInputRef}
                              type="file"
                              multiple
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => { handleAddRef(Array.from(e.target.files || [])); if (refInputRef.current) refInputRef.current.value = ""; }}
                            />
                            {refImages.length > 0 && (
                              <div className="flex gap-1.5 overflow-x-auto">
                                {refImages.map((src, i) => (
                                  <div key={i} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[4px] border border-[rgba(15,23,38,0.08)]">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={src} alt="ref" className="h-full w-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => setRefImages((p) => p.filter((_, j) => j !== i))}
                                      className="absolute right-0 top-0 flex h-3.5 w-3.5 items-center justify-center bg-black/70 text-white"
                                      aria-label="Устгах"
                                    >
                                      <Icon path="M6 18L18 6M6 6l12 12" cls="h-2 w-2" stroke={2.5} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {aiImgError && (
                    <p className="rounded-[4px] border border-[#2E29FF]/30 bg-[#2E29FF]/5 px-2.5 py-1.5 text-[11px] text-[#8FC1EA]">{aiImgError}</p>
                  )}

                  <button
                    type="button"
                    onClick={handleAiImageGenerate}
                    disabled={aiImgBusy || aiImgPrompt.trim().length < 3}
                    className="flex w-full items-center justify-center gap-2 rounded-[4px] bg-[#2E29FF] py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-white transition hover:shadow-[0_0_18px_rgba(46,41,255,0.4)] disabled:cursor-not-allowed disabled:bg-[#F2F2F4] disabled:text-[#E2E4E8] disabled:shadow-none"
                  >
                    {aiImgBusy ? (
                      <>
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        ҮҮСГЭЖ БАЙНА
                      </>
                    ) : (
                      <>
                        <Icon path="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" cls="h-3.5 w-3.5" stroke={1.8} />
                        ҮҮСГЭХ · <CreditIcon size={11} />{finalCost}
                      </>
                    )}
                  </button>

                  {/* Quick-launch: Brand Shot (Nano Banana → pink 3D product) */}
                  <a
                    href="/tools/brand-shot"
                    className="mt-2 flex items-center justify-between gap-2 rounded-[4px] border border-[rgba(46,41,255,0.3)] bg-gradient-to-r from-[rgba(46,41,255,0.06)] to-[#f2f5f8] p-2.5 transition hover:border-[rgba(46,41,255,0.55)]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[rgba(46,41,255,0.12)] text-[#2E29FF]">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </span>
                      <div>
                        <p className="text-[12px] font-bold text-[#0e1726]">Бренд шот</p>
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#E2E4E8]">ПИНК · 3D · АВТО</p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#2E29FF]">ОРОХ →</span>
                  </a>
                </motion.div>
              )}

              {/* AI VIDEO PANEL */}
              {mode === "aiVideo" && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <input
                    ref={aiVidRefInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadAiVidRef(f);
                      if (aiVidRefInputRef.current) aiVidRefInputRef.current.value = "";
                    }}
                  />
                  {!aiVidRefPreview ? (
                    <button
                      type="button"
                      onClick={() => aiVidRefInputRef.current?.click()}
                      className="flex w-full flex-col items-center justify-center gap-2 rounded-[4px] border-2 border-dashed border-[rgba(15,23,38,0.1)] bg-[#f2f5f8] py-7 transition hover:border-[#2E29FF]"
                    >
                      <Icon path="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" cls="h-6 w-6 text-[#E2E4E8]" stroke={1.5} />
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8]">ЛАВЛАГАА ЗУРАГ</p>
                      <p className="text-[10px] text-[#E2E4E8]">Эхлэх зургаа сонго</p>
                    </button>
                  ) : (
                    <div className="relative overflow-hidden rounded-[4px] border border-[rgba(15,23,38,0.08)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={aiVidRefPreview} alt="ref" className="max-h-[180px] w-full bg-[#ffffff] object-contain" />
                      <button
                        type="button"
                        onClick={() => { setAiVidRefUrl(""); setAiVidRefPreview(""); }}
                        className="absolute right-2 top-2 rounded-[4px] bg-black/70 px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white hover:bg-black"
                      >
                        СОЛИХ
                      </button>
                    </div>
                  )}

                  <textarea
                    value={aiVidPrompt}
                    onChange={(e) => setAiVidPrompt(e.target.value.slice(0, 2500))}
                    placeholder="Хэрхэн хөдөлгөх вэ? Жишээ: Камер удаанаар ойртож дүр инээмсэглэнэ"
                    rows={2}
                    className="w-full resize-none rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-3 py-2.5 text-[14px] text-[#0e1726] placeholder:text-[#E2E4E8] focus:border-[#2E29FF] focus:outline-none"
                  />

                  {/* Compact summary — one click to expand video options */}
                  <button
                    type="button"
                    onClick={() => setShowAiVidOptions((v) => !v)}
                    className="flex w-full items-center gap-2 rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] p-2 text-left transition hover:border-[rgba(46,41,255,0.4)]"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(46,41,255,0.12)] text-[#2E29FF]">
                      <Icon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" cls="h-4 w-4" stroke={1.8} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-bold text-[#0e1726]">Kling Video</p>
                      <p className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-[#E2E4E8]">
                        {aiVidDuration}С · {aiVidQuality === "pro" ? "PRO" : "ЭНГИЙН"} · {aiVidAspect}
                      </p>
                    </div>
                    <Icon
                      path="M19 9l-7 7-7-7"
                      cls={`h-3.5 w-3.5 shrink-0 text-[#E2E4E8] transition-transform duration-200 ${showAiVidOptions ? "rotate-180 text-[#2E29FF]" : ""}`}
                      stroke={2.2}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {showAiVidOptions && (
                      <motion.div
                        key="aiVidOpts"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div>
                            <span className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8]">УРТ</span>
                            <div className="flex gap-1 rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] p-1">
                              {(["5", "10"] as const).map((d) => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => setAiVidDuration(d)}
                                  className={`flex-1 rounded-[4px] py-1 text-[11px] font-bold transition ${
                                    aiVidDuration === d ? "bg-[#2E29FF] text-white" : "text-[#E2E4E8]"
                                  }`}
                                >{d}с</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8]">ЧАНАР</span>
                            <div className="flex gap-1 rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] p-1">
                              {(["std", "pro"] as const).map((q) => (
                                <button
                                  key={q}
                                  type="button"
                                  onClick={() => setAiVidQuality(q)}
                                  className={`flex-1 rounded-[4px] py-1 text-[11px] font-bold transition ${
                                    aiVidQuality === q ? "bg-[#2E29FF] text-white" : "text-[#E2E4E8]"
                                  }`}
                                >{q === "std" ? "ЭНГ" : "PRO"}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8]">ХЭЛБЭР</span>
                            <select
                              value={aiVidAspect}
                              onChange={(e) => setAiVidAspect(e.target.value as "16:9" | "9:16" | "1:1")}
                              className="w-full rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] px-2 py-1.5 text-[11px] font-bold text-[#0e1726]"
                            >
                              <option value="16:9">16:9</option>
                              <option value="9:16">9:16</option>
                              <option value="1:1">1:1</option>
                            </select>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {aiVidError && (
                    <p className="rounded-[4px] border border-[#2E29FF]/30 bg-[#2E29FF]/5 px-2.5 py-1.5 text-[11px] text-[#8FC1EA]">{aiVidError}</p>
                  )}

                  {aiVidPhase !== "idle" ? (
                    <div className="rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-bold text-[#0e1726]">{aiVidStatus || "Илгээж байна…"}</p>
                        <p className="font-mono text-[11px] tabular-nums text-[#E2E4E8]">
                          {Math.floor(aiVidElapsed / 60)}:{String(aiVidElapsed % 60).padStart(2, "0")}
                        </p>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-[4px] bg-[#F2F2F4]">
                        <motion.div
                          animate={{ width: `${Math.min(95, Math.floor((aiVidElapsed / (aiVidQuality === "pro" ? 240 : 120)) * 100))}%` }}
                          transition={{ duration: 1, ease: "linear" }}
                          className="h-full bg-gradient-to-r from-[#2E29FF] to-[#f2547a]"
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAiVideoGenerate}
                      disabled={!aiVidRefUrl || aiVidPrompt.trim().length < 3 || !!videoUrl}
                      className="flex w-full items-center justify-center gap-2 rounded-[4px] bg-[#2E29FF] py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-white transition hover:shadow-[0_0_18px_rgba(46,41,255,0.4)] disabled:cursor-not-allowed disabled:bg-[#F2F2F4] disabled:text-[#E2E4E8] disabled:shadow-none"
                    >
                      <Icon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" cls="h-3.5 w-3.5" stroke={1.8} />
                      {videoUrl ? "✓ ВИДЕО ПОСТОНД" : "ҮҮСГЭХ · ~" + (aiVidQuality === "pro" ? "3-5" : "1-3") + " МИН"}
                    </button>
                  )}
                </motion.div>
              )}

              {/* TEXT PANEL — caption + manual upload */}
              {mode === "text" && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value.slice(0, 2000))}
                    placeholder={images.length > 0 || videoUrl ? "Гарчиг бичих… (заавал биш)" : "Юу нийтлэх вэ?"}
                    rows={5}
                    className="w-full resize-none rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-3 py-2.5 text-[14px] leading-relaxed text-[#0e1726] placeholder:text-[#E2E4E8] focus:border-[#2E29FF] focus:outline-none"
                  />

                  <div className="flex items-center justify-between">
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { handleFiles(Array.from(e.target.files || [])); if (fileRef.current) fileRef.current.value = ""; }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={images.length >= MAX_IMAGES}
                      className="flex items-center gap-1.5 rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#E2E4E8] transition hover:border-[#2E29FF] hover:text-[#0e1726] disabled:opacity-30"
                    >
                      <Icon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" cls="h-3 w-3" stroke={1.8} />
                      ЗУРАГ ОРУУЛАХ
                    </button>
                    <span className="font-mono text-[11px] tabular-nums text-[#E2E4E8]">{content.length}/2000</span>
                  </div>
                </motion.div>
              )}

              {/* MEDIA STRIP — always visible across all modes */}
              {(images.length > 0 || videoPreview) && (
                <div className="mt-4 space-y-2">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8]">МЕДИА</span>
                  <div className="flex gap-1.5 overflow-x-auto">
                    {images.map((c, i) => (
                      <div key={i} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[4px] border border-[rgba(15,23,38,0.08)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.preview} alt={`img ${i + 1}`} className="h-full w-full object-cover" />
                        {!c.url && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2E29FF]" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-[4px] bg-black/75 text-white"
                          aria-label="Устгах"
                        >
                          <Icon path="M6 18L18 6M6 6l12 12" cls="h-2.5 w-2.5" stroke={2.4} />
                        </button>
                      </div>
                    ))}
                    {videoPreview && (
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[4px] border border-[rgba(15,23,38,0.08)]">
                        <video src={videoPreview} className="h-full w-full object-cover" muted />
                        <span className="absolute left-0.5 top-0.5 rounded-[4px] bg-[#2E29FF] px-1 py-0.5 font-mono text-[8px] font-bold tracking-[0.18em] text-white">VID</span>
                        <button
                          type="button"
                          onClick={() => { setVideoUrl(""); setVideoPreview(""); setVideoDurationSec(0); }}
                          className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-[4px] bg-black/75 text-white"
                          aria-label="Устгах"
                        >
                          <Icon path="M6 18L18 6M6 6l12 12" cls="h-2.5 w-2.5" stroke={2.4} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CATEGORIES */}
              <div className="mt-4">
                <span className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8]">КАТЕГОРИ</span>
                <div className="flex flex-wrap gap-1">
                  {pills.map((c) => {
                    const active = category === c.slug;
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => setCategory(c.slug)}
                        className={`rounded-[4px] border px-2.5 py-1 text-[11px] font-bold transition ${
                          active
                            ? "border-[#2E29FF] bg-[rgba(46,41,255,0.06)] text-[#2E29FF]"
                            : "border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] text-[#E2E4E8] hover:text-[#0e1726]"
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <p className="mt-3 rounded-[4px] border border-[#2E29FF]/30 bg-[#2E29FF]/5 px-2.5 py-1.5 text-[11px] text-[#8FC1EA]">{error}</p>
              )}
            </div>

            {/* ─── Footer — bright accent edge segment + animated arrow ── */}
            <div className="relative flex items-center justify-between gap-3 border-t border-[rgba(15,23,38,0.06)] bg-[#0A0A0A] px-5 py-3">
              <span className="pointer-events-none absolute left-3 top-0 h-px w-12 bg-gradient-to-r from-[#2E29FF] via-[#2E29FF] to-transparent shadow-[0_0_8px_rgba(46,41,255,0.6)]" />
              <div className="flex items-center gap-2">
                <span className="h-1 w-1 rotate-45 bg-[#2E29FF]" />
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-[#E2E4E8]">
                  {validImages.length > 0 || videoUrl
                    ? `${validImages.length} ЗУРАГ${videoUrl ? " · 1 ВИДЕО" : ""}`
                    : canPost
                    ? "БЭЛЭН"
                    : "ХООСОН"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canPost}
                className="group flex items-center gap-2 rounded-[4px] bg-[#2E29FF] px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.26em] text-white transition hover:shadow-[0_0_24px_rgba(46,41,255,0.5)] disabled:cursor-not-allowed disabled:bg-[#F2F2F4] disabled:text-[#E2E4E8] disabled:shadow-none"
              >
                {submitting ? (
                  <>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    ИЛГЭЭЖ БАЙНА
                  </>
                ) : (
                  <>
                    ИЛГЭЭХ
                    <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                      <Icon path="M5 12h14m-7-7l7 7-7 7" cls="h-3.5 w-3.5" stroke={2.2} />
                    </span>
                  </>
                )}
              </button>
            </div>
        </motion.div>
      </motion.div>
    ) : null
  );
}
