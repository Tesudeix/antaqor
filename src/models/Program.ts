import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── ХӨТӨЛБӨР ─────────────────────────────────────────────────────────
   Нүүр хуудасны сонголт, бүртгэлийн алхам, админы жагсаалт гурвуулаа
   ЭНЭ нэг цуглуулгаас уншина. Гурван газарт гурван хувилбар бичвэл
   заавал зөрнө — тэр нь [[antaqor-cms-ownership]]-д тэмдэглэсэн
   алдаа.

   Агуулгыг эзэн /admin/programs-аас засна. Код дотор ХАТУУ бичсэн
   бичвэр БАЙХГҮЙ — зөвхөн анхны үр (seed) нь байна. */

export interface IProgramStat {
  value: string;
  label: string;
}

export interface IProgram extends Document {
  slug: string;
  /** "ХӨТӨЛБӨР 01" — картын дээд мөр. */
  code: string;
  title: string;
  /** Төрлийн тэмдэг, ж: "CLAUDE AGENTS". */
  kicker: string;
  /** Хэнд зориулсан — гарчгийн доорх нэг мөр. */
  audience: string;
  scheduleDays: string;
  scheduleTime: string;
  summary: string;
  lessonCount: number;
  /** 2×2 тоон сүлжээ. */
  stats: IProgramStat[];
  /** "ТАНД ҮЛДЭХ ЗҮЙЛС" хэсгийн бие. */
  takeaway: string;
  bullets: string[];
  /** Картын дээд зурвасны өнгө. Цагаан дээр бичиг болоход хангалттай
   *  бараан утга сонгоно — teal нь дүүргэлтэд сайн ч бичигт 1.61:1. */
  accent: string;
  order: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StatSchema = new Schema<IProgramStat>(
  { value: { type: String, default: "" }, label: { type: String, default: "" } },
  { _id: false }
);

const ProgramSchema = new Schema<IProgram>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    code: { type: String, default: "" },
    title: { type: String, required: true },
    kicker: { type: String, default: "" },
    audience: { type: String, default: "" },
    scheduleDays: { type: String, default: "" },
    scheduleTime: { type: String, default: "" },
    summary: { type: String, default: "" },
    lessonCount: { type: Number, default: 0 },
    stats: { type: [StatSchema], default: [] },
    takeaway: { type: String, default: "" },
    bullets: { type: [String], default: [] },
    accent: { type: String, default: "#1F1AD9" },
    order: { type: Number, default: 100, index: true },
    enabled: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

ProgramSchema.index({ enabled: 1, order: 1 });

export default (mongoose.models.Program as Model<IProgram>) ||
  mongoose.model<IProgram>("Program", ProgramSchema);
