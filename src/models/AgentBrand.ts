import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── Контент агентын брэнд (2026-10-23) ──────────────────────────────────
   personal — antaqor: дуу хоолой нь BrandProfile + playbook + өөрийн шилдэг постууд.
   product  — Hooji г.м: дуу хоолой нь энд бичсэн бриф. Агент `facts`-аас
              өөр тоо, баримт, сэтгэгдэл ЗОХИОХГҮЙ (сурталчилгааны хуулийн эрсдэл).
   Суваг бүр брэндийн ӨӨРИЙН аккаунт руу явна (metaAccount / threadsUserId);
   хоосон бол батлах боломжгүй — Hooji-гийн пост antaqor руу андуурч явахгүй. */

export interface IAgentBrand extends Document {
  key: string;
  name: string;
  kind: "personal" | "product";
  active: boolean;
  runWeekday: number;   // 1 = Даваа … 7 = Ням (УБ)
  runHour: number;      // 0–23 (УБ)
  postsPerWeek: number;
  maxPerDay: number;
  hours: number[];      // нийтлэх цагууд (УБ), эхнийх нь гол
  channels: string[];
  metaAccount: string;
  threadsUserId: string;
  imageMode: "auto" | "manual" | "off";
  imageShare: number;   // зурагтай постын эзлэх хувь
  visualStyle: string;
  voiceNotes: string;
  pillars: { name: string; share: number; hint: string }[];
  product: {
    name: string; oneLiner: string; description: string; price: string; offer: string; link: string; cta: string;
    audience: string; usps: string[]; facts: string[]; banned: string[]; refImages: string[];
  };
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const S = new Schema<IAgentBrand>({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  kind: { type: String, enum: ["personal", "product"], default: "product" },
  active: { type: Boolean, default: false },
  runWeekday: { type: Number, default: 1, min: 1, max: 7 },
  runHour: { type: Number, default: 9, min: 0, max: 23 },
  postsPerWeek: { type: Number, default: 7, min: 1, max: 21 },
  maxPerDay: { type: Number, default: 2, min: 1, max: 4 },
  hours: { type: [Number], default: [21, 12] },
  channels: { type: [String], default: ["threads", "facebook", "instagram"] },
  metaAccount: { type: String, default: "" },
  threadsUserId: { type: String, default: "" },
  imageMode: { type: String, enum: ["auto", "manual", "off"], default: "auto" },
  imageShare: { type: Number, default: 40, min: 0, max: 100 },
  visualStyle: { type: String, default: "" },
  voiceNotes: { type: String, default: "" },
  pillars: { type: [{ _id: false, name: String, share: Number, hint: String }], default: [] },
  product: {
    name: { type: String, default: "" }, oneLiner: { type: String, default: "" }, description: { type: String, default: "" },
    price: { type: String, default: "" }, offer: { type: String, default: "" }, link: { type: String, default: "" },
    cta: { type: String, default: "" }, audience: { type: String, default: "" },
    usps: { type: [String], default: [] }, facts: { type: [String], default: [] }, banned: { type: [String], default: [] },
    refImages: { type: [String], default: [] },
  },
  lastRunAt: { type: Date, default: null },
}, { timestamps: true });

const AgentBrand: Model<IAgentBrand> =
  (mongoose.models.AgentBrand as Model<IAgentBrand>) || mongoose.model<IAgentBrand>("AgentBrand", S);
export default AgentBrand;
