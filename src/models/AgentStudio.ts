import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── Antaqor Agent студи (2026-10-23) ───────────────────────────────────
   AgentNote     — эзний дижитал тэмдэглэлийн дэвтэр. Агент эндээс хэв маяг,
                   сэтгэлгээг сурна (vector + cognitive профайл).
   AgentAudience — зорилтот хэрэглэгч (хэн, өвдөлт, хүсэл, түвшин).
   AgentProduct  — санал болгох курс/үйлчилгээ — зөвхөн эндээс баримт авна.
   AgentRule     — тогтмол хуваарь: «Өдөр бүр 08:00 — AI мэдээ (богино)». */

export interface IAgentNote extends Document { ws: string; title: string; body: string; tags: string[]; createdAt: Date; updatedAt: Date }
const NoteS = new Schema<IAgentNote>({ ws: { type: String, default: "main", index: true }, title: { type: String, default: "" }, body: { type: String, default: "" }, tags: { type: [String], default: [] } }, { timestamps: true });

export interface IAgentAudience extends Document { ws: string; name: string; who: string; pains: string; desires: string; level: string; isDefault: boolean }
const AudS = new Schema<IAgentAudience>({ ws: { type: String, default: "main", index: true }, name: { type: String, required: true }, who: { type: String, default: "" }, pains: { type: String, default: "" }, desires: { type: String, default: "" }, level: { type: String, default: "" }, isDefault: { type: Boolean, default: false } }, { timestamps: true });

export type GalleryItem = { url: string; kind: "image" | "video"; label: string; mediaId: string; at: Date };
export type DetectedItem = { mn: string; en: string; part: string };
/** Vision шинжилгээ — зургийн URL-аар кэшлэнэ (дахин дуудахгүй) */
export type Analysis = { src: string; category: string; summary: string; items: DetectedItem[]; hasPerson: boolean; at: Date };
export interface IAgentProduct extends Document { ws: string; name: string; pitch: string; price: string; link: string; cta: string; imageUrl: string; active: boolean; gallery: GalleryItem[]; category: string; analysis: Analysis | null }
const ProdS = new Schema<IAgentProduct>({ ws: { type: String, default: "main", index: true }, name: { type: String, required: true }, pitch: { type: String, default: "" }, price: { type: String, default: "" }, link: { type: String, default: "" }, cta: { type: String, default: "" }, imageUrl: { type: String, default: "" }, active: { type: Boolean, default: true },
  /* Студиос гарсан зураг/видео (салгасан, студи, 3D, хөдөлгөөн) — «Үндсэн зураг болгох» боломжтой */
  gallery: { type: [{ _id: false, url: String, kind: { type: String, default: "image" }, label: String, mediaId: String, at: Date }], default: [] },
  category: { type: String, default: "" }, analysis: { type: Schema.Types.Mixed, default: null } }, { timestamps: true });

export interface IAgentRule extends Document {
  ws: string; name: string; active: boolean; days: number[]; hour: number; minute: number;
  format: "spark" | "value" | "offer" | "infographic" | "image" | "video"; source: "auto" | "notebook" | "top" | "product";
  topic: string; audienceId: string; productId: string; platforms: string[]; lastRunDay: string;
}
const RuleS = new Schema<IAgentRule>({
  ws: { type: String, default: "main", index: true }, name: { type: String, default: "" }, active: { type: Boolean, default: true }, days: { type: [Number], default: [] },
  hour: { type: Number, default: 8, min: 0, max: 23 }, minute: { type: Number, default: 0, min: 0, max: 59 },
  format: { type: String, enum: ["spark", "value", "offer", "infographic", "image", "video"], default: "spark" },
  source: { type: String, enum: ["auto", "notebook", "top", "product"], default: "auto" },
  topic: { type: String, default: "" }, audienceId: { type: String, default: "" }, productId: { type: String, default: "" },
  platforms: { type: [String], default: ["threads"] }, lastRunDay: { type: String, default: "" },
}, { timestamps: true });

/* AgentMedia — Higgsfield-ээр үүсгэсэн зураг/видео (медиа сан). Пост руу холбогдож болно.
   status: running → done (url = манай /uploads) | failed. usd = тооцоолсон өртөг (өдрийн хязгаарт). */
export interface IAgentMedia extends Document {
  ws: string; kind: "image" | "video"; modelId: string; prompt: string; idea: string; ratio: string; res: string; dur: number;
  status: "running" | "done" | "failed"; requestId: string; endpoint: string; url: string; usd: number; error: string;
  postId: string; refs: string[]; pollUntil: Date | null; createdAt: Date; updatedAt: Date;
  /** Бүтээгдэхүүний студи: аль бүтээгдэхүүн, ямар загвар, бэлэн болмогц дараагийн алхам (хөдөлгөөн) */
  productId: string; preset: string; then: string; personaId: string;
  /** «AI зураг»: нэг удаагийн бүтээлтийн бүлэг, чанар, Higgsfield завгүй үед хүлээж буй илгээлт */
  batch: string; q: string; job: { model: string; opts: Record<string, unknown> } | null;
  /** AI Studio кредит (2026-10-26): гишүүнээс хассан кредит, хэнээс, амжилтгүй бол буцаасан эсэх */
  credits: number; payer: string; refunded: boolean;
}
const MediaS = new Schema<IAgentMedia>({
  ws: { type: String, default: "main", index: true }, kind: { type: String, enum: ["image", "video"], default: "image" }, modelId: { type: String, default: "" }, prompt: { type: String, default: "" }, idea: { type: String, default: "" },
  ratio: { type: String, default: "" }, res: { type: String, default: "" }, dur: { type: Number, default: 0 },
  status: { type: String, enum: ["running", "done", "failed"], default: "running", index: true }, requestId: { type: String, default: "" }, endpoint: { type: String, default: "" },
  url: { type: String, default: "" }, usd: { type: Number, default: 0 }, error: { type: String, default: "" }, postId: { type: String, default: "", index: true },
  refs: { type: [String], default: [] }, pollUntil: { type: Date, default: null },
  productId: { type: String, default: "", index: true }, preset: { type: String, default: "" }, then: { type: String, default: "" }, personaId: { type: String, default: "" },
  batch: { type: String, default: "", index: true }, q: { type: String, default: "" }, job: { type: Schema.Types.Mixed, default: null },
  credits: { type: Number, default: 0 }, payer: { type: String, default: "" }, refunded: { type: Boolean, default: false },
}, { timestamps: true });

/* AgentPersona — «Миний дүр»: хэрэглэгчийн биеийн зураг → дүрийн ref sheet (урд, ¾, хажуу, ар, хөрөг).
   Студи (try-on, кампанит ажил, 3D), Медиа студи, AI зурагтай постод 1-р лавлах зураг болж орно. */
export type TwinSheetDoc = { kind: string; url: string; mediaId: string; label: string; at: Date };
export interface IAgentPersona extends Document {
  ws: string; name: string; photos: string[]; sheetUrl: string; status: "rendering" | "ready" | "failed"; mediaId: string; error: string; isDefault: boolean; createdAt: Date; updatedAt: Date;
  /* AI ихэр (2026-10-24): нүүр / бие / гар / стилийн лавлах тусдаа, агентын бичсэн профайл (засагдана),
     стиль + өнгө + илэрхийлэл, анхдагч хувцас, бүтээгдсэн sheet-үүд (толгой, бие, скульптур, хувцас…) */
  faces: string[]; bodies: string[]; hands: string[]; styleRef: string; styleText: string;
  profile: { gender: string; age: string; eyeColor: string; hair: string; skin: string; build: string; dna: string } | null;
  style: string; palette: string; expr: string; outfit: string[]; outfitLabels: string[]; sheets: TwinSheetDoc[];
}
const PersonaS = new Schema<IAgentPersona>({
  ws: { type: String, default: "main", index: true }, name: { type: String, default: "" }, photos: { type: [String], default: [] }, sheetUrl: { type: String, default: "" },
  status: { type: String, enum: ["rendering", "ready", "failed"], default: "rendering" }, mediaId: { type: String, default: "" }, error: { type: String, default: "" }, isDefault: { type: Boolean, default: false },
  faces: { type: [String], default: [] }, bodies: { type: [String], default: [] }, hands: { type: [String], default: [] }, styleRef: { type: String, default: "" }, styleText: { type: String, default: "" },
  profile: { type: Schema.Types.Mixed, default: null },
  style: { type: String, default: "hyper" }, palette: { type: String, default: "dark_blue" }, expr: { type: String, default: "calm" },
  outfit: { type: [String], default: [] }, outfitLabels: { type: [String], default: [] },
  sheets: { type: [{ _id: false, kind: String, url: String, mediaId: String, label: String, at: Date }], default: [] },
}, { timestamps: true });

/* AgentWardrobe — хэрэглэгчийн хувцасны шүүгээ (оруулсан зураг). Анхдагч 4 хувцас кодонд
   (twinPresets.DEFAULT_WARDROBE), бүтээгдэхүүний студийн «салгах» зургууд автоматаар нэмэгдэнэ. */
export interface IAgentWardrobe extends Document { ws: string; url: string; label: string; part: string; createdAt: Date }
const WardS = new Schema<IAgentWardrobe>({ ws: { type: String, default: "main", index: true }, url: { type: String, required: true }, label: { type: String, default: "" }, part: { type: String, default: "" } }, { timestamps: true });

/* Энгийн хэлбэр — generic `m<T>(name, schema)` туслах нь Mongoose-ийн төрлийг тэсрүүлж
   TypeScript-ийг (build) 2.3GB+ санах ойгоор дүүргэсэн (2026-10-23). */
export const AgentNote: Model<IAgentNote> = (mongoose.models.AgentNote as Model<IAgentNote>) || mongoose.model<IAgentNote>("AgentNote", NoteS);
export const AgentAudience: Model<IAgentAudience> = (mongoose.models.AgentAudience as Model<IAgentAudience>) || mongoose.model<IAgentAudience>("AgentAudience", AudS);
export const AgentProduct: Model<IAgentProduct> = (mongoose.models.AgentProduct as Model<IAgentProduct>) || mongoose.model<IAgentProduct>("AgentProduct", ProdS);
export const AgentRule: Model<IAgentRule> = (mongoose.models.AgentRule as Model<IAgentRule>) || mongoose.model<IAgentRule>("AgentRule", RuleS);
export const AgentWardrobe: Model<IAgentWardrobe> = (mongoose.models.AgentWardrobe as Model<IAgentWardrobe>) || mongoose.model<IAgentWardrobe>("AgentWardrobe", WardS);
export const AgentPersona: Model<IAgentPersona> = (mongoose.models.AgentPersona as Model<IAgentPersona>) || mongoose.model<IAgentPersona>("AgentPersona", PersonaS);
export const AgentMedia: Model<IAgentMedia> = (mongoose.models.AgentMedia as Model<IAgentMedia>) || mongoose.model<IAgentMedia>("AgentMedia", MediaS);
