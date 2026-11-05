import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── Antaqor Agent SaaS (2026-10-24) ────────────────────────────────────
   AgentWorkspace — нэг байгууллага (туршилтын хэрэглэгч). Эзэн (Antaqor) = "main",
   түүний өгөгдөл хуучнаараа. Бусад бүх агентын цуглуулга `ws` талбараар тусгаарлагдана.
   AgentConn      — ТҮРЭЭСЛЭГЧИЙН сошиал холболт (FB хуудас + IG, Threads). Эзний
                    MetaPage/ThreadsToken-оос ТУСДАА: эзний инсайт, бот, өрсөлдөгч зэрэг
                    `ThreadsToken.findOne({})` дууддаг олон функц түрээслэгчийн токенд
                    хэзээ ч хүрэхгүй. Нийтлэгч (metaTargetFor, getThreadsClient) л fallback-аар уншина. */

export interface IAgentWorkspace extends Document {
  wsId: string; name: string; ownerUserId: string; ownerEmail: string; ownerName: string;
  /* member = Antaqor-ийн төлбөртэй гишүүн (AI зураг + AI ихэр л). active = бизнес багц (paidUntil хүртэл). */
  plan: "trial" | "active" | "expired" | "waitlist" | "member"; trialEndsAt: Date | null; paidUntil: Date | null;
  business: { name: string; about: string; audience: string; tone: string; brandColor: string; logoUrl: string; website: string; contact: string };
  usage: { day: string; gens: number; total: number };
  lastActiveAt: Date | null; adminNote: string; createdAt: Date; updatedAt: Date;
}
const WsS = new Schema<IAgentWorkspace>({
  wsId: { type: String, required: true, unique: true }, name: { type: String, default: "" },
  ownerUserId: { type: String, required: true, unique: true }, ownerEmail: { type: String, default: "", index: true }, ownerName: { type: String, default: "" },
  plan: { type: String, enum: ["trial", "active", "expired", "waitlist", "member"], default: "trial", index: true }, trialEndsAt: { type: Date, default: null }, paidUntil: { type: Date, default: null },
  business: {
    name: { type: String, default: "" }, about: { type: String, default: "" }, audience: { type: String, default: "" }, tone: { type: String, default: "" },
    brandColor: { type: String, default: "" }, logoUrl: { type: String, default: "" }, website: { type: String, default: "" }, contact: { type: String, default: "" },
  },
  usage: { day: { type: String, default: "" }, gens: { type: Number, default: 0 }, total: { type: Number, default: 0 } },
  lastActiveAt: { type: Date, default: null }, adminNote: { type: String, default: "" },
}, { timestamps: true });

export interface IAgentConn extends Document {
  ws: string; platform: "meta" | "threads"; key: string; label: string;
  pageId: string; igId: string; igUsername: string; pageToken: string;
  threadsUserId: string; username: string; accessToken: string; expiresAt: Date | null;
  status: string; connectedBy: string; createdAt: Date; updatedAt: Date;
}
const ConnS = new Schema<IAgentConn>({
  ws: { type: String, required: true, index: true }, platform: { type: String, enum: ["meta", "threads"], required: true },
  /* meta: "<ws>:<pageId>" (SocialPost.metaAccount), threads: threadsUserId */
  key: { type: String, required: true }, label: { type: String, default: "" },
  pageId: { type: String, default: "" }, igId: { type: String, default: "" }, igUsername: { type: String, default: "" }, pageToken: { type: String, default: "", select: false },
  threadsUserId: { type: String, default: "", index: true }, username: { type: String, default: "" }, accessToken: { type: String, default: "", select: false }, expiresAt: { type: Date, default: null },
  status: { type: String, default: "active" }, connectedBy: { type: String, default: "" },
}, { timestamps: true });
ConnS.index({ platform: 1, key: 1 }, { unique: true });

export const AgentWorkspace: Model<IAgentWorkspace> = (mongoose.models.AgentWorkspace as Model<IAgentWorkspace>) || mongoose.model<IAgentWorkspace>("AgentWorkspace", WsS);
export const AgentConn: Model<IAgentConn> = (mongoose.models.AgentConn as Model<IAgentConn>) || mongoose.model<IAgentConn>("AgentConn", ConnS);
