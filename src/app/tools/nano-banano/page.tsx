"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const NEON = "#1080CA";
const MAX_IMAGES = 4;

type ModelId = "nano2" | "nanoPro" | "gpt" | "kling" | "seeddream" | "seeddance" | "grok";
type AspectId = "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
type Resolution = "standard" | "hd";

// 2K adds a 50% premium on top of the model's base cost.
const RESOLUTIONS: { id: Resolution; label: string; sub: string; mult: number }[] = [
  { id: "standard", label: "1K", sub: "1024px · хурдан",  mult: 1 },
  { id: "hd",       label: "2K", sub: "өндөр чанар",       mult: 1.5 },
];

interface ModelDef {
  id: ModelId;
  label: string;
  sub: string;
  ready: boolean;
  cost: number;
  Icon: React.FC<{ className?: string }>;
}

// ─── Brand SVG icons (provided by the user) ─────────────────────────────
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

const SeedIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" className={className}>
    <path d="M2.7601 10.635L0.466553 11.2084V1.04883L2.7601 1.62222V10.635Z" fill="currentColor" />
    <path d="M13.8448 11.2295L11.5469 11.8029V0.454102L13.8448 1.02324V11.2295Z" fill="currentColor" />
    <path d="M6.39853 10.9452L4.10498 11.5186V5.53418L6.39853 6.10752V10.9452Z" fill="currentColor" />
    <path d="M7.89722 4.64663L10.1952 4.07324V10.0577L7.89722 9.48433V4.64663Z" fill="currentColor" />
  </svg>
);

const GrokIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" className={className} fill="none">
    <g clipPath="url(#grokClip)">
      <path d="M9.23842 15.4055L17.3051 9.26292C17.7006 8.9618 18.2658 9.07925 18.4543 9.54702C19.446 12.0138 19.0029 14.9784 17.0297 17.0138C15.0566 19.0492 12.3111 19.4955 9.80163 18.4789L7.06027 19.7882C10.9922 22.5604 15.7667 21.8748 18.7504 18.795C21.117 16.3538 21.8499 13.0262 21.1646 10.0254L21.1708 10.0318C20.1769 5.62354 21.4151 3.86151 23.9515 0.258408C23.9702 0.231693 23.9351 0.202703 23.9123 0.226139L20.7939 3.44289V3.43221L9.23842 15.4055Z" fill="currentColor" />
      <path d="M7.65167 7.33217C5.24368 9.81392 4.75711 14.1176 7.57924 16.8984L7.57713 16.9005L0.0792788 23.8097C0.0528384 23.834 0.0162235 23.8015 0.0377551 23.7728C0.487937 23.1707 1.01883 22.595 1.54932 22.0198L1.57777 21.9889C3.28214 20.1411 4.97141 18.3097 3.93926 15.7216C2.55615 12.2552 3.36158 8.19287 5.9228 5.55089C8.58547 2.80639 12.507 2.1144 15.7826 3.5048C16.5072 3.78245 17.1388 4.17758 17.6315 4.54493L14.8964 5.84777C12.3497 4.7457 9.43229 5.49537 7.65167 7.33217Z" fill="currentColor" />
    </g>
    <defs>
      <clipPath id="grokClip"><rect width="24" height="24" fill="white" /></clipPath>
    </defs>
  </svg>
);

const KlingIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M16.7522 2.86984L16.818 2.93745L16.8199 2.93552C18.087 4.25441 17.7236 6.90443 15.8863 9.90864L19.5 13.6567L19.3447 13.9703C18.7372 15.1986 17.9147 16.2992 16.9193 17.216C15.608 18.43 14.0251 19.2853 12.3143 19.7044L12.2522 19.7198L12.1634 19.7417L12.0994 19.7565L11.9584 19.7887L11.8416 19.8126L11.754 19.8299C11.6609 19.8493 11.5634 19.8673 11.4683 19.884L11.3888 19.8963L11.3286 19.904C11.2429 19.916 11.1576 19.9272 11.0727 19.9375C9.64831 20.1036 8.20616 19.9376 6.8516 19.4517C5.49703 18.9658 4.2643 18.1723 3.24348 17.1291L3.18385 17.0692C1.91429 15.7503 2.27391 13.0983 4.11366 10.0922L0.5 6.34416L0.65528 6.03054C1.26118 4.80131 2.0846 3.70115 3.08261 2.78741C4.10242 1.8473 5.28649 1.11848 6.57081 0.640344C6.86894 0.528933 7.18075 0.431691 7.48696 0.34926C7.73931 0.279139 7.9944 0.220054 8.25155 0.172163C8.33851 0.154131 8.43665 0.135456 8.53168 0.118712C10.0139 -0.12084 11.5297 0.00325476 12.9574 0.481036C14.385 0.958817 15.6847 1.77698 16.7522 2.86984ZM15.5304 3.03083H15.5267L15.5304 3.03276C14.3025 2.63864 12.354 3.27555 10.2944 4.68267C11.8615 4.22994 13.377 4.46435 14.3565 5.48057C15.2845 6.44462 15.5385 7.90777 15.187 9.44497C15.1704 9.52697 15.1497 9.61005 15.1248 9.69419C16.8062 7.05706 17.3441 4.58993 16.2795 3.48807C16.262 3.4682 16.2433 3.44949 16.2236 3.43204L16.2155 3.42431L16.2037 3.41336L16.1683 3.38503C16.153 3.37215 16.1371 3.3597 16.1205 3.34768L16.0944 3.32836C15.9242 3.19657 15.7334 3.09594 15.5304 3.03083ZM14.6876 8.95876C14.4708 10.2995 13.7559 11.6545 12.672 12.777C11.5913 13.9001 10.282 14.642 8.98696 14.8687C7.77516 15.0812 6.72981 14.8043 6.04472 14.0959C5.36149 13.3868 5.09441 12.3069 5.29938 11.044C5.51615 9.7045 6.22919 8.3489 7.30807 7.22771C7.30807 7.22771 7.30994 7.22771 7.31429 7.22127L7.31801 7.21483C8.40062 6.09944 9.70497 5.3595 10.9969 5.13539C12.2087 4.92287 13.2516 5.1985 13.9391 5.90818C14.6224 6.61657 14.8894 7.69847 14.6845 8.9594H14.6882L14.6876 8.95876ZM3.70621 3.51061C2.88113 4.26712 2.1865 5.16395 1.65217 6.16255L1.64596 6.16449L4.78137 9.40762C5.04127 9.02837 5.31475 8.65932 5.60124 8.30124C5.70311 8.17567 5.80807 8.04558 5.91553 7.91614L5.95652 7.86784L6.10559 7.69525C6.10994 7.69139 6.11429 7.68301 6.11429 7.68301L6.14161 7.65082L6.1559 7.63343L6.23292 7.54456C6.27226 7.49819 6.31284 7.45247 6.35466 7.40739C6.35466 7.40288 6.36087 7.39644 6.36087 7.39644L6.42795 7.32045L6.47578 7.26893C6.47785 7.26592 6.4795 7.26507 6.4795 7.26507C6.48385 7.26249 6.48385 7.25863 6.48385 7.25863C6.48675 7.25562 6.48965 7.25176 6.49255 7.24703L6.50124 7.23609C6.50882 7.23006 6.51569 7.22314 6.52174 7.21548L6.53354 7.2026C6.55901 7.17619 6.58944 7.14528 6.61677 7.11437C6.63126 7.09591 6.64783 7.07745 6.66646 7.05899L6.69193 7.03194C6.69627 7.0255 6.70807 7.01326 6.70807 7.01326L6.7559 6.96432L6.84907 6.86901L6.88012 6.83488L6.91491 6.79688C7.5863 6.09838 8.30377 5.44917 9.06211 4.85397L9.16149 4.77862H9.16211V4.77798L9.16335 4.77733L9.26273 4.70134C9.37371 4.61505 9.48551 4.53068 9.59814 4.44825C9.71822 4.36325 9.8383 4.27953 9.95838 4.1971C11.587 3.0714 13.182 2.39586 14.4839 2.26191C12.7422 1.17239 10.6864 0.752921 8.6764 1.07697C8.58944 1.09114 8.50621 1.10595 8.41677 1.12462C8.36025 1.13493 8.31118 1.14523 8.26149 1.15554L8.23168 1.16198C7.77515 1.25942 7.3258 1.39004 6.88696 1.55288C5.71551 1.9877 4.63519 2.65238 3.70621 3.51061ZM3.87888 16.6531C4.05279 16.7905 4.25093 16.8949 4.47329 16.9661H4.46894C5.70497 17.3577 7.64596 16.7188 9.69814 15.3156C8.13292 15.7664 6.6205 15.532 5.64099 14.5157C4.71739 13.5562 4.46335 12.0885 4.81304 10.5513C4.83043 10.4693 4.85093 10.3863 4.87453 10.3021C3.19379 12.9399 2.65714 15.4064 3.7205 16.5089C3.77062 16.56 3.8235 16.6082 3.87888 16.6531ZM18.346 13.8389V13.8402C17.8108 14.8373 17.1168 15.7333 16.2932 16.4902C15.0606 17.625 13.5707 18.4173 11.9627 18.7931L11.9429 18.7983L11.8894 18.8112C11.8291 18.8281 11.7679 18.8418 11.7062 18.8524C11.666 18.8614 11.6251 18.8693 11.5832 18.8762C11.4967 18.8936 11.4097 18.9087 11.3224 18.9213L11.2497 18.9342L11.1671 18.9451C11.1008 18.9545 11.0329 18.9631 10.9634 18.9709C9.06697 19.1922 7.15308 18.7592 5.51801 17.7389C6.77143 17.6108 8.29752 16.9764 9.86273 15.9274L9.95217 15.8668L10.0416 15.8057L10.1634 15.7206H10.164L10.3994 15.5545C10.5128 15.4721 10.6246 15.3877 10.7348 15.3014C10.8035 15.2503 10.871 15.1994 10.9373 15.1488C11.6946 14.5518 12.4122 13.9025 13.0851 13.2052C13.1012 13.1881 13.1164 13.1713 13.1304 13.155L13.1491 13.1331C13.1822 13.1009 13.2133 13.0693 13.2422 13.0384L13.2894 12.9895C13.2894 12.9895 13.3019 12.9766 13.3037 12.9702L13.3217 12.9521L13.3292 12.9438L13.3832 12.8884L13.4248 12.8433C13.4389 12.8296 13.4528 12.815 13.4665 12.7995L13.4776 12.7866C13.4837 12.7792 13.4906 12.7725 13.4981 12.7667L13.5075 12.7551L13.5161 12.7441C13.5161 12.7441 13.5224 12.7377 13.5261 12.7358L13.5429 12.7171L13.5596 12.6984L13.5758 12.6823C13.5584 12.7012 13.5418 12.7209 13.5261 12.7416L13.5646 12.6997L13.5652 12.6984C13.5921 12.6684 13.6188 12.6396 13.6453 12.6121C13.6453 12.6121 13.6453 12.6057 13.6516 12.6057C13.688 12.5653 13.7234 12.5245 13.7578 12.4833L13.828 12.4022C13.8372 12.396 13.8447 12.3873 13.8497 12.3771L13.8894 12.3275L13.8994 12.3152C13.9478 12.2616 13.9952 12.2073 14.0416 12.1523L14.0901 12.0943C14.1679 12.0003 14.2453 11.9057 14.3224 11.8103L14.4155 11.6951L14.4447 11.6577C14.482 11.6092 14.5188 11.562 14.5553 11.516C14.5863 11.4774 14.6168 11.4379 14.6466 11.3975C14.8451 11.1367 15.0377 10.8711 15.2242 10.6009L18.346 13.8389ZM18.346 13.8389C18.346 13.8368 18.3472 13.835 18.3497 13.8338V13.8441L18.346 13.8402H18.3472L18.346 13.8389Z"
      fill="currentColor"
    />
  </svg>
);

const MODELS: ModelDef[] = [
  { id: "nano2",     label: "Nano Banana 2",   sub: "Gemini · ердийн",    ready: true,  cost: 10, Icon: GoogleIcon },
  { id: "nanoPro",   label: "Nano Banana Pro", sub: "Gemini · дээд",      ready: true,  cost: 15, Icon: GoogleIcon },
  { id: "gpt",       label: "ChatGPT",         sub: "OpenAI · gpt-image", ready: true,  cost: 15, Icon: ChatGptIcon },
  { id: "kling",     label: "Kling Image",     sub: "Kling AI · эх ref",  ready: true,  cost: 12, Icon: KlingIcon },
  { id: "seeddream", label: "SeedDream",       sub: "Удахгүй",            ready: false, cost: 0,  Icon: SeedIcon },
  { id: "seeddance", label: "SeedDance",       sub: "Удахгүй",            ready: false, cost: 0,  Icon: SeedIcon },
  { id: "grok",      label: "Grok Imagine",    sub: "Удахгүй",            ready: false, cost: 0,  Icon: GrokIcon },
];

const ASPECTS: { id: AspectId; cls: string }[] = [
  { id: "1:1",  cls: "aspect-square" },
  { id: "9:16", cls: "aspect-[9/16]" },
  { id: "16:9", cls: "aspect-video" },
  { id: "4:3",  cls: "aspect-[4/3]" },
  { id: "3:4",  cls: "aspect-[3/4]" },
];

interface Generation { url: string; prompt: string; ts: number; aspect: AspectId; model: ModelId; }

interface TrendingPrompt { _id: string; label: string; text: string; }

// Rotating placeholder examples that cycle when prompt is empty.
const PLACEHOLDERS = [
  "Mongolian warrior in cyberpunk Ulaanbaatar, neon rain…",
  "Founder portrait, soft window light, modern minimal office…",
  "Buddhist stupa at golden hour, prayer flags catching wind…",
  "Premium black bottle on glossy neon-pink podium, studio…",
  "A small herder yurt in green steppe, soft watercolor light…",
  "Minimal flat geometric logo for an AI startup, scalable…",
];

// One-tap prompt prefixes — user clicks to seed the textarea.
const PROMPT_STARTERS = [
  { label: "Portrait",  prefix: "Cinematic portrait of " },
  { label: "Landscape", prefix: "Wide-angle landscape of " },
  { label: "Product",   prefix: "Product photo of " },
  { label: "Logo",      prefix: "Minimal flat logo for " },
  { label: "Cyber",     prefix: "Cyberpunk neon-lit " },
];

// ─── Character Sheet preset ───
// Full AAA-grade reference-sheet prompt — drops in when user uploads images
// (face / wardrobe / physique). Triple-image input → 9-view turnaround sheet.
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

Avoid: bulky gym-built physique, broad bodybuilder shoulders, thick arms, short proportions, skinny underweight build, identity drift between angles, body proportion variation, wardrobe variation between views (different tie length, different shirt color, different jacket fit), shirt color shift, tie position shift, missing tie in any view (back view shows collar but tie is hidden behind body — not removed), plastic smoothed skin, beauty-retouched magazine look, T-pose stiffness, mannequin pose, cartoon, anime, painted illustration aesthetic (the reference was anime — final output is photorealistic), 3D render look, HDR oversaturation, props, weapons, snakes, foliage, color backgrounds, decorative elements.`;

export default function NanoBananoPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><div className="h-2 w-2 animate-pulse rounded-full bg-[#1080CA]" /></div>}>
      <NanoBananoInner />
    </Suspense>
  );
}

function NanoBananoInner() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [model, setModel] = useState<ModelId>("nano2");
  const [aspect, setAspect] = useState<AspectId>("1:1");
  const [resolution, setResolution] = useState<Resolution>("standard");
  const [refImages, setRefImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [result, setResult] = useState<Generation | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const [trending, setTrending] = useState<TrendingPrompt[]>([]);
  const [shared, setShared] = useState<string | null>(null); // generation.ts when shared
  const [sharing, setSharing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const modelBtnRef = useRef<HTMLDivElement>(null);

  // Rotate placeholders every 3.5s while prompt is empty + textarea unfocused.
  useEffect(() => {
    if (prompt || focused) return;
    const t = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 3500);
    return () => clearInterval(t);
  }, [prompt, focused]);

  // ─── Auto-suggest Character Sheet when user uploads images with empty prompt.
  // We don't auto-fill (would surprise the user); we surface a one-tap banner.
  // Banner clears once the user types or dismisses.
  const [csDismissed, setCsDismissed] = useState(false);
  const showCharSheetBanner = refImages.length >= 1 && !prompt.trim() && !csDismissed;
  const applyCharSheet = useCallback(() => {
    setPrompt(CHARACTER_SHEET_PROMPT);
    setAspect("1:1");
    setCsDismissed(true);
    requestAnimationFrame(() => {
      promptRef.current?.focus();
      promptRef.current?.setSelectionRange(0, 0);
    });
  }, []);

  const activeModel = MODELS.find((m) => m.id === model) || MODELS[0];
  const activeRes = RESOLUTIONS.find((r) => r.id === resolution) || RESOLUTIONS[0];
  const finalCost = Math.ceil(activeModel.cost * activeRes.mult);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/credits")
      .then((r) => r.json())
      .then((d) => { if (typeof d.balance === "number") setBalance(d.balance); })
      .catch(() => {});
  }, [status]);

  // Trending prompts — admin curated. Fall back to nothing if empty.
  useEffect(() => {
    fetch("/api/trending-prompts")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.prompts)) setTrending(d.prompts); })
      .catch(() => {});
  }, []);

  // Read `?prompt=...&model=...&aspect=...` URL params on first mount —
  // e.g. when user clicks "Use prompt" on a shared post.
  useEffect(() => {
    if (!searchParams) return;
    const pq = searchParams.get("prompt");
    if (pq) setPrompt(pq.slice(0, 4000));
    const mq = searchParams.get("model");
    if (mq && (MODELS.find((m) => m.id === mq && m.ready))) setModel(mq as ModelId);
    const aq = searchParams.get("aspect");
    if (aq && ASPECTS.find((a) => a.id === aq)) setAspect(aq as AspectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close model popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelBtnRef.current && !modelBtnRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    };
    if (modelOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelOpen]);

  const readFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setRefImages((prev) => {
      const room = MAX_IMAGES - prev.length;
      if (room <= 0) { setErr(`Хамгийн ихдээ ${MAX_IMAGES} зураг`); return prev; }
      const accepted = list.slice(0, room).filter((f) => {
        if (!f.type.startsWith("image/")) { setErr("Зөвхөн зургийн файл"); return false; }
        if (f.size > 8 * 1024 * 1024) { setErr("Зураг 8MB-аас бага"); return false; }
        return true;
      });
      if (accepted.length === 0) return prev;
      setErr("");
      Promise.all(accepted.map((f) => new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(String(reader.result || ""));
        reader.onerror = rej;
        reader.readAsDataURL(f);
      }))).then((urls) => setRefImages((p) => [...p, ...urls].slice(0, MAX_IMAGES)));
      return prev;
    });
  }, []);

  const removeImage = (idx: number) => setRefImages((p) => p.filter((_, i) => i !== idx));

  const shareToProfile = useCallback(async (gen: Generation) => {
    if (!session || sharing) return;
    setSharing(true);
    try {
      const date = new Date(gen.ts).toLocaleDateString("mn-MN", { year: "numeric", month: "short", day: "numeric" });
      const modelLabel = MODELS.find((m) => m.id === gen.model)?.label || gen.model;
      // Public caption — does NOT contain the prompt. The prompt is stored in
      // post.aiPrompt and gated behind paid-membership in the feed UI + API.
      const caption = `AI бүтээл · ${modelLabel} · ${gen.aspect} · ${date}`;
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: caption,
          aiPrompt: gen.prompt,
          image: gen.url,
          images: [gen.url],
          category: "бүтээл",
        }),
      });
      if (res.ok) {
        setShared(String(gen.ts));
      }
    } finally {
      setSharing(false);
    }
  }, [session, sharing]);

  const onPaste = useCallback((e: ClipboardEvent) => {
    if (!e.clipboardData) return;
    const imgs: File[] = [];
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) imgs.push(f);
      }
    }
    if (imgs.length > 0) { e.preventDefault(); readFiles(imgs); }
  }, [readFiles]);

  useEffect(() => {
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [onPaste]);

  const generate = useCallback(async () => {
    if (!activeModel.ready) {
      setErr("Энэ модель удахгүй гарна");
      return;
    }
    if (!prompt.trim()) {
      promptRef.current?.focus();
      return;
    }
    setErr("");
    setBusy(true);
    requestAnimationFrame(() => {
      canvasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    try {
      const res = await fetch("/api/tools/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model,
          aspectRatio: aspect,
          resolution,
          ...(refImages.length > 0 ? { inputImages: refImages, inputImage: refImages[0] } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Үүсгэж чадсангүй");
        return;
      }
      const url: string = data.url || "";
      if (!url) { setErr("Зураг буцаагдсангүй"); return; }
      setResult({ url, prompt, ts: Date.now(), aspect, model });
      if (typeof data.balance === "number") setBalance(data.balance);
    } catch {
      setErr("Сүлжээний алдаа");
    } finally {
      setBusy(false);
    }
  }, [prompt, refImages, model, aspect, resolution, activeModel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!busy && session) generate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, session, generate]);

  const lowBalance = balance !== null && balance < finalCost;

  return (
    <div className="mx-auto max-w-[700px] px-4 pb-10 pt-2 sm:px-5">
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: NEON, boxShadow: `0 0 8px ${NEON}` }} />
          <span className="text-[11px] font-black uppercase tracking-[0.22em] text-white">
            {model === "gpt" ? "ChatGPT image" : model === "kling" ? "Kling Image" : "Nano Banano"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {session && (
            <span className="hidden h-7 items-center gap-1 rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-2.5 sm:inline-flex">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#6b7280]">Баланс</span>
              <span className="text-[12px] font-black tabular-nums" style={{ color: lowBalance ? "#1080CA" : NEON }}>
                {balance ?? "…"}<span className="ml-0.5 text-[9px] text-[#6b7280]">₵</span>
              </span>
            </span>
          )}
          <Link
            href={session ? "/credits/buy" : "/auth/signin?next=/credits/buy"}
            className="inline-flex h-7 items-center gap-1.5 rounded-none px-2.5 text-[11px] font-black text-white transition active:scale-95"
            style={{ background: NEON, boxShadow: "0 0 10px rgba(16,128,202,0.35)" }}
          >
            <Icon path="M12 4v16m8-8H4" stroke={2.4} cls="h-3 w-3" />
            <span>Кредит</span>
            {session && <span className="ml-0.5 text-[9px] opacity-80 sm:hidden">{balance ?? "…"}₵</span>}
          </Link>
        </div>
      </header>

      {/* ── PROCESSING / RESULT (top) ──────────────────────────────────── */}
      <section ref={canvasRef} className="mb-5">
        {busy ? <Skeleton hasRef={refImages.length > 0} model={activeModel} aspect={aspect} /> :
         result ? (
           <ResultCard
             generation={result}
             onShare={() => shareToProfile(result)}
             sharedTs={shared}
             sharing={sharing}
             canShare={!!session}
             onIterate={async () => {
               // Pull the result image, convert to data-URL, push as a reference,
               // then scroll to the prompt textarea — single tap to iterate.
               try {
                 const r = await fetch(result.url);
                 const blob = await r.blob();
                 const reader = new FileReader();
                 reader.onload = () => {
                   const dataUrl = reader.result as string;
                   if (typeof dataUrl !== "string") return;
                   setRefImages((prev) => [...prev, dataUrl].slice(0, MAX_IMAGES));
                   const ta = document.querySelector<HTMLTextAreaElement>("textarea[data-prompt-input]");
                   ta?.focus();
                   ta?.scrollIntoView({ behavior: "smooth", block: "center" });
                 };
                 reader.readAsDataURL(blob);
               } catch {
                 // Network fail — keep current state
               }
             }}
           />
         ) :
         <EmptyHint aspect={aspect} />}
      </section>

      {/* ── PROMPT SECTION (bottom) ────────────────────────────────────── */}
      <section>
        {/* Reference images strip */}
        <RefImagesRow
          images={refImages}
          onAdd={() => fileRef.current?.click()}
          onDrop={readFiles}
          onRemove={removeImage}
          dragOver={dragOver}
          setDragOver={setDragOver}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => { if (e.target.files) readFiles(e.target.files); if (fileRef.current) fileRef.current.value = ""; }}
          className="hidden"
        />

        {/* Model + Aspect row */}
        <div className="mb-3 flex items-stretch gap-2">
          {/* Model picker — single button + popover */}
          <div ref={modelBtnRef} className="relative flex-1">
            <button
              type="button"
              onClick={() => setModelOpen(!modelOpen)}
              className="flex w-full items-center justify-between gap-2 rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-3 py-2 text-left transition hover:border-[rgba(15,23,38,0.18)]"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none bg-[rgba(15,23,38,0.05)]" style={{ color: activeModel.ready ? "#0e1726" : "#6b7280" }}>
                  <activeModel.Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 truncate">
                  <span className="block text-[12px] font-black leading-tight text-[#0e1726]">{activeModel.label}</span>
                  <span className="block text-[9px] uppercase tracking-wider text-[#6b7280]">{activeModel.sub}</span>
                </span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="rounded-none bg-[rgba(16,128,202,0.12)] px-1.5 py-0.5 text-[10px] font-black tabular-nums" style={{ color: NEON }}>
                  {activeModel.cost}₵
                </span>
                <Icon path="M19 9l-7 7-7-7" cls={`h-3 w-3 transition text-[#6b7280] ${modelOpen ? "rotate-180" : ""}`} stroke={2.5} />
              </span>
            </button>

            {modelOpen && (
              <div
                className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] shadow-[0_18px_40px_rgba(0,0,0,0.6)]"
                style={{ animation: "fadeIn 0.12s ease-out" }}
              >
                {MODELS.map((m) => {
                  const selected = m.id === model;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!m.ready}
                      onClick={() => { if (m.ready) { setModel(m.id); setModelOpen(false); } }}
                      className={`flex w-full items-center gap-2.5 border-b border-[rgba(15,23,38,0.04)] px-3 py-2 text-left transition last:border-b-0 ${
                        m.ready ? "hover:bg-[rgba(15,23,38,0.03)] cursor-pointer" : "opacity-50 cursor-not-allowed"
                      } ${selected ? "bg-[rgba(16,128,202,0.06)]" : ""}`}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none"
                        style={{
                          background: selected ? "rgba(16,128,202,0.15)" : "rgba(15,23,38,0.04)",
                          color: selected ? NEON : "#5b6573",
                        }}
                      >
                        <m.Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-bold text-[#0e1726]">{m.label}</span>
                        <span className="block text-[9px] uppercase tracking-wider text-[#6b7280]">{m.sub}</span>
                      </span>
                      {m.ready ? (
                        <span className="rounded-none bg-[rgba(15,23,38,0.04)] px-1.5 py-0.5 text-[10px] font-black tabular-nums text-[#6b7280]">
                          {m.cost}₵
                        </span>
                      ) : (
                        <span className="rounded-none border border-[rgba(15,23,38,0.06)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#6b7280]">
                          Soon
                        </span>
                      )}
                      {selected && (
                        <Icon path="M5 13l4 4L19 7" stroke={2.4} cls="h-3 w-3" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Aspect — compact chip */}
          <AspectMenu aspect={aspect} setAspect={setAspect} />
        </div>

        {/* Character Sheet auto-suggest banner — appears when user uploads
            reference images and the prompt is still empty. One tap loads the
            full AAA-grade reference-sheet prompt + sets aspect to 1:1. */}
        {showCharSheetBanner && (
          <div className="mb-3 flex items-center gap-2 rounded-none border bg-[rgba(16,128,202,0.06)] px-3 py-2 text-[11px] sm:gap-3" style={{ borderColor: "rgba(16,128,202,0.3)" }}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none bg-[rgba(16,128,202,0.12)]" style={{ color: NEON }}>
              <Icon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke={1.6} cls="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block font-bold text-[#0e1726]">Character Sheet үүсгэх үү?</span>
              <span className="block text-[10px] text-[#6b7280]">
                Зураг 1: нүүр · Зураг 2: хувцас · Зураг 3: бие · 9-views (нүүр + бие, 4 өнцөг)
              </span>
            </span>
            <button
              type="button"
              onClick={applyCharSheet}
              className="shrink-0 rounded-none px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition active:scale-95"
              style={{ background: NEON, boxShadow: "0 0 10px rgba(16,128,202,0.35)" }}
            >
              Тийм
            </button>
            <button
              type="button"
              onClick={() => setCsDismissed(true)}
              aria-label="Хаах"
              className="shrink-0 text-[#6b7280] transition hover:text-[#0e1726]"
            >
              <Icon path="M6 18L18 6M6 6l12 12" stroke={2} cls="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Resolution — segmented control */}
        <div className="mb-3 flex items-stretch gap-1 rounded-none border border-[rgba(15,23,38,0.08)] bg-[#ffffff] p-1">
          {RESOLUTIONS.map((r) => {
            const active = r.id === resolution;
            const cost = Math.ceil(activeModel.cost * r.mult);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setResolution(r.id)}
                className={`flex-1 rounded-none px-2 py-1.5 text-left transition ${
                  active ? "bg-[#f2f5f8] text-[#0e1726]" : "text-[#6b7280] hover:text-[#334155]"
                }`}
                style={active ? { boxShadow: "inset 0 0 0 1px rgba(16,128,202,0.35)" } : undefined}
              >
                <div className="flex items-center gap-1.5">
                  {active && <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: NEON }} />}
                  <span className="text-[11px] font-black uppercase tracking-wider">{r.label}</span>
                  <span className="ml-auto text-[9px] tabular-nums" style={{ color: active ? NEON : "#94a3b8" }}>
                    {cost}₵
                  </span>
                </div>
                <div className="text-[9px] uppercase tracking-wider text-[#94a3b8]">{r.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Prompt — Tesla-clean typography, rotating placeholder, focus glow */}
        <div
          className="relative rounded-none border bg-[#f2f5f8] transition-all"
          style={{
            borderColor: focused ? "rgba(16,128,202,0.45)" : "rgba(15,23,38,0.08)",
            boxShadow: focused ? "0 0 18px rgba(16,128,202,0.18)" : "none",
          }}
        >
          <textarea
            ref={promptRef}
            data-prompt-input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 4000))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={PLACEHOLDERS[phIdx]}
            rows={4}
            className="block max-h-[280px] min-h-[120px] w-full resize-y bg-transparent px-4 py-3.5 text-[16px] leading-[1.55] text-[#0e1726] placeholder-[#4a4a52] outline-none"
            style={{ caretColor: NEON, fontVariantLigatures: "common-ligatures" }}
          />
          {/* Inline footer: counter + shortcut hint */}
          <div className="pointer-events-none absolute bottom-2 right-3 flex items-center gap-2 text-[10px]">
            {prompt.length > 0 && (
              <span className={`tabular-nums ${prompt.length > 950 ? "text-[#1080CA]" : "text-[#94a3b8]"}`}>
                {prompt.length} / 4000
              </span>
            )}
            <span className="hidden items-center gap-0.5 text-[#94a3b8] sm:inline-flex">
              <kbd className="rounded-none border border-[rgba(15,23,38,0.1)] bg-[#ffffff] px-1 py-0.5 font-mono text-[9px]">⌘</kbd>
              <kbd className="rounded-none border border-[rgba(15,23,38,0.1)] bg-[#ffffff] px-1 py-0.5 font-mono text-[9px]">↵</kbd>
            </span>
          </div>
        </div>

        {/* ── ✨ Enhance prompt button — gpt-5-mini rewrites the user's draft
              into a richer, image-gen-tuned prompt. Highest single-feature
              quality lever for novice users. */}
        {prompt.trim().length >= 2 && (
          <button
            type="button"
            disabled={enhancing}
            onClick={async () => {
              if (enhancing) return;
              setEnhancing(true);
              try {
                const r = await fetch("/api/tools/enhance-prompt", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ prompt: prompt.trim() }),
                });
                if (r.ok) {
                  const d = await r.json() as { prompt?: string };
                  if (d.prompt) {
                    setPrompt(d.prompt.slice(0, 4000));
                    promptRef.current?.focus();
                  }
                }
              } finally {
                setEnhancing(false);
              }
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-none border border-[rgba(16,128,202,0.3)] bg-[rgba(16,128,202,0.06)] px-2.5 py-1 font-mono text-[10px] font-black tracking-[0.18em] text-[#1080CA] transition hover:bg-[rgba(16,128,202,0.12)] disabled:opacity-40"
            title="Промптыг AI-аар чанаржуулах"
          >
            {enhancing ? "ENHANCING…" : "✨ ENHANCE"}
          </button>
        )}

        {/* Trending prompts — admin curated. Falls back to static prefixes.
            Character Sheet preset is always pinned first so users can trigger
            the AAA-grade 9-view reference sheet without typing. */}
        {!prompt && (trending.length > 0 || PROMPT_STARTERS.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: trending.length > 0 ? NEON : "#94a3b8" }}>
              {trending.length > 0 ? "✦ Trending" : "Эхлэл"}
            </span>
            <button
              type="button"
              onClick={applyCharSheet}
              title="9-view character reference sheet (нүүр / хувцас / бие)"
              className="inline-flex items-center gap-1 rounded-none border px-2 py-1 text-[10px] font-bold transition active:scale-95"
              style={{ borderColor: "rgba(16,128,202,0.4)", background: "rgba(16,128,202,0.08)", color: NEON }}
            >
              <Icon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke={1.6} cls="h-2.5 w-2.5" />
              Character Sheet
            </button>
            {(trending.length > 0
              ? trending.map((t) => ({ key: t._id, label: t.label, full: t.text }))
              : PROMPT_STARTERS.map((s) => ({ key: s.label, label: s.label, full: s.prefix }))
            ).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  setPrompt(s.full);
                  promptRef.current?.focus();
                  requestAnimationFrame(() => {
                    if (promptRef.current) {
                      const len = s.full.length;
                      promptRef.current.setSelectionRange(len, len);
                    }
                  });
                }}
                className="inline-flex items-center gap-1 rounded-none border border-[rgba(15,23,38,0.06)] bg-[#ffffff] px-2 py-1 text-[10px] font-bold text-[#6b7280] transition hover:border-[rgba(16,128,202,0.35)] hover:text-[#1080CA]"
              >
                <Icon path="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" stroke={1.6} cls="h-2.5 w-2.5" />
                {s.label}
              </button>
            ))}
          </div>
        )}

        {err && <p className="mt-2 text-[11px] text-[#1080CA]">{err}</p>}

        <div className="mt-3">
          {!session ? (
            <Link
              href="/auth/signin?next=/tools/nano-banano"
              className="flex w-full items-center justify-center gap-2 rounded-none py-3 text-[13px] font-black text-white transition active:scale-[0.99]"
              style={{ background: NEON, boxShadow: "0 0 18px rgba(16,128,202,0.4)" }}
            >
              <Icon path="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" cls="h-4 w-4" />
              Үүсгэх <span className="opacity-70">· {finalCost}₵</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={generate}
              disabled={busy || !prompt.trim() || lowBalance || !activeModel.ready}
              className="flex w-full items-center justify-center gap-2 rounded-none py-3 text-[13px] font-black text-white transition active:scale-[0.99] disabled:opacity-40"
              style={{ background: NEON, boxShadow: "0 0 18px rgba(16,128,202,0.4)" }}
            >
              {busy ? (
                <>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Үүсгэж байна
                </>
              ) : (
                <>
                  <Icon path="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" cls="h-4 w-4" />
                  Үүсгэх <span className="opacity-70">· {finalCost}₵</span>
                </>
              )}
            </button>
          )}
          <p className="mt-1.5 text-right text-[9px] text-[#94a3b8]">
            <kbd className="rounded-none border border-[rgba(15,23,38,0.1)] bg-[#f2f5f8] px-1 py-0.5 font-mono text-[9px]">Cmd</kbd>+<kbd className="ml-0.5 rounded-none border border-[rgba(15,23,38,0.1)] bg-[#f2f5f8] px-1 py-0.5 font-mono text-[9px]">↵</kbd>
          </p>
        </div>
      </section>

      <style jsx global>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 14px ${NEON}; opacity: 1; }
          50%      { box-shadow: 0 0 28px ${NEON}; opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function Icon({ path, cls = "h-4 w-4", stroke = 1.7 }: { path: string; cls?: string; stroke?: number }) {
  return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={stroke} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function AspectMenu({ aspect, setAspect }: { aspect: AspectId; setAspect: (a: AspectId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const active = ASPECTS.find((a) => a.id === aspect)!;
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-full items-center gap-2 rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-3 transition hover:border-[rgba(15,23,38,0.18)]"
      >
        <span className={`${active.cls} w-3 rounded-none`} style={{ background: NEON }} />
        <span className="text-[11px] font-black tabular-nums text-[#0e1726]">{aspect}</span>
        <Icon path="M19 9l-7 7-7-7" cls={`h-3 w-3 text-[#6b7280] transition ${open ? "rotate-180" : ""}`} stroke={2.5} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1.5 w-[180px] overflow-hidden rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.6)]"
          style={{ animation: "fadeIn 0.12s ease-out" }}
        >
          {ASPECTS.map((a) => {
            const selected = a.id === aspect;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => { setAspect(a.id); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 rounded-none px-2.5 py-1.5 text-left transition ${
                  selected ? "bg-[rgba(16,128,202,0.08)]" : "hover:bg-[rgba(15,23,38,0.04)]"
                }`}
              >
                <span className={`${a.cls} w-4 rounded-none`} style={{ background: selected ? NEON : "rgba(15,23,38,0.2)" }} />
                <span className="flex-1 text-[11px] font-bold tabular-nums text-[#0e1726]">{a.id}</span>
                {selected && <Icon path="M5 13l4 4L19 7" stroke={2.4} cls="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RefImagesRow({
  images, onAdd, onDrop, onRemove, dragOver, setDragOver,
}: {
  images: string[];
  onAdd: () => void;
  onDrop: (f: FileList | File[]) => void;
  onRemove: (idx: number) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
}) {
  if (images.length === 0) {
    return (
      <button
        type="button"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) onDrop(e.dataTransfer.files); }}
        onClick={onAdd}
        className={`mb-3 flex w-full cursor-pointer items-center gap-3 rounded-none border border-dashed bg-[#ffffff] p-2.5 text-left transition ${
          dragOver ? "border-[rgba(16,128,202,0.6)] bg-[rgba(16,128,202,0.04)]" : "border-[rgba(15,23,38,0.1)] hover:border-[rgba(15,23,38,0.22)]"
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] text-[#6b7280]">
          <Icon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" cls="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[12px] font-bold text-[#0e1726]">Зураг нэмэх</p>
          <p className="text-[10px] text-[#6b7280]">{MAX_IMAGES} хүртэл · drag · click · paste</p>
        </div>
      </button>
    );
  }
  return (
    <div
      className="mb-3 rounded-none border border-[rgba(15,23,38,0.08)] bg-[#ffffff] p-2"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) onDrop(e.dataTransfer.files); }}
      style={dragOver ? { borderColor: "rgba(16,128,202,0.5)", background: "rgba(16,128,202,0.03)" } : undefined}
    >
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
        {images.map((src, i) => (
          <div key={i} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-none border border-[rgba(15,23,38,0.08)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`ref ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/75 text-white hover:text-[#0E0E10] transition hover:bg-[#1080CA]"
              aria-label="Устгах"
            >
              <Icon path="M6 18L18 6M6 6l12 12" cls="h-2.5 w-2.5" stroke={2.5} />
            </button>
            <span className="absolute bottom-0.5 left-0.5 rounded-none bg-black/60 px-1 py-0.5 text-[8px] font-black text-white">{i + 1}</span>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={onAdd}
            className="flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-none border border-dashed border-[rgba(15,23,38,0.1)] text-[#6b7280] transition hover:border-[rgba(16,128,202,0.45)] hover:text-[#1080CA]"
          >
            <Icon path="M12 4v16m8-8H4" stroke={2} cls="h-3.5 w-3.5" />
            <span className="text-[8px] font-black uppercase">Нэмэх</span>
          </button>
        )}
      </div>
      <p className="mt-1 text-[10px] text-[#94a3b8]">{images.length} / {MAX_IMAGES} зураг · variant горим</p>
    </div>
  );
}

function EmptyHint({ aspect }: { aspect: AspectId }) {
  const cls = ASPECTS.find((a) => a.id === aspect)?.cls || "aspect-square";
  return (
    <div className={`flex w-full items-center justify-center rounded-none border border-dashed border-[rgba(15,23,38,0.06)] bg-[#ffffff] ${cls}`}>
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: NEON, opacity: 0.6 }} />
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#94a3b8]">Бэлэн</p>
        <p className="text-[11px] leading-relaxed text-[#6b7280]">
          Промптоо бичээд{" "}
          <kbd className="rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-1 py-0.5 font-mono text-[10px] text-[#5b6573]">Cmd</kbd>+<kbd className="rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-1 py-0.5 font-mono text-[10px] text-[#5b6573]">↵</kbd>
        </p>
      </div>
    </div>
  );
}

function Skeleton({ hasRef, model, aspect }: { hasRef: boolean; model: ModelDef; aspect: AspectId }) {
  const cls = ASPECTS.find((a) => a.id === aspect)?.cls || "aspect-square";
  return (
    <div
      className={`relative w-full overflow-hidden rounded-none border border-[rgba(16,128,202,0.25)] bg-[#f2f5f8] ${cls}`}
      style={{ animation: "fadeIn 0.2s ease-out" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(110deg, rgba(15,23,38,0) 8%, rgba(16,128,202,0.06) 18%, rgba(15,23,38,0) 33%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.6s linear infinite",
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: NEON, animation: "pulseGlow 1.4s ease-in-out infinite" }} />
        <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: NEON }}>
          {hasRef ? "Variant үүсгэж байна" : "Үүсгэж байна"}
        </p>
        <p className="text-[10px] text-[#6b7280]">~10–20 сек</p>
      </div>
      <span
        className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider"
        style={{ background: "rgba(16,128,202,0.15)", color: NEON }}
      >
        <model.Icon className="h-3 w-3" />
        {model.label}
      </span>
    </div>
  );
}

function ResultCard({
  generation, onShare, sharedTs, sharing, canShare, onIterate,
}: {
  generation: Generation;
  onShare: () => void;
  sharedTs: string | null;
  sharing: boolean;
  canShare: boolean;
  onIterate?: () => void;
}) {
  const m = MODELS.find((x) => x.id === generation.model);
  const isShared = sharedTs === String(generation.ts);
  return (
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      <div className="overflow-hidden rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={generation.url} alt={generation.prompt} className="block w-full" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {m && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-none bg-[rgba(15,23,38,0.05)] text-[#6b7280]">
              <m.Icon className="h-3 w-3" />
            </span>
          )}
          <p className="line-clamp-1 text-[11px] text-[#6b7280]">{generation.prompt}</p>
        </div>
        {canShare && (
          <button
            type="button"
            onClick={onShare}
            disabled={sharing || isShared}
            className="inline-flex shrink-0 items-center gap-1 rounded-none px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white transition active:scale-95 disabled:opacity-60"
            style={
              isShared
                ? { background: "rgba(16,128,202,0.15)", color: NEON }
                : { background: NEON, boxShadow: "0 0 10px rgba(16,128,202,0.35)" }
            }
          >
            {isShared ? (
              <>
                <Icon path="M5 13l4 4L19 7" stroke={2.4} cls="h-3 w-3" />
                Хуваалцлаа
              </>
            ) : sharing ? (
              <>
                <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
                Илгээж...
              </>
            ) : (
              <>
                <Icon path="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" cls="h-3 w-3" />
                Хуваалцах
              </>
            )}
          </button>
        )}
        {onIterate && (
          <button
            type="button"
            onClick={onIterate}
            title="Энэ зургийг reference болгож шинээр үүсгэх"
            className="inline-flex shrink-0 items-center gap-1 rounded-none border border-[rgba(16,128,202,0.4)] bg-[rgba(16,128,202,0.06)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1080CA] transition hover:bg-[rgba(16,128,202,0.12)]"
          >
            <Icon path="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" cls="h-3 w-3" />
            Iterate
          </button>
        )}
        <a
          href={generation.url}
          download
          className="inline-flex shrink-0 items-center gap-1 rounded-none border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5b6573] transition hover:border-[rgba(16,128,202,0.4)] hover:text-[#1080CA]"
        >
          <Icon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" cls="h-3 w-3" />
          Татах
        </a>
      </div>
    </div>
  );
}
