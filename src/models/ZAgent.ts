import mongoose, { Schema, Types, type Model } from "mongoose";

/* ─── /z — AI Entrepreneur Mentor агент (2026-11-03) ──────────────────────────
   ZCard   — гишүүн бүрийн worldview карт (agent-ийн `card` гаралтаас нийлүүлнэ)
             + summary: агентын «санах ой» — гишүүний бизнес, явцын товч түүх.
   ZMsg    — ярианы мөр + agent-ийн дотоод log (гишүүнд харагдахгүй).
   ZTest   — 7 хоногийн туршилт: action · metric · threshold · due → check-in.
   ZPersona — эзний 1% датасетийн карт (3,392). ЗӨВХӨН нэгтгэсэн prior-д;
              бичвэрийг нь гишүүнд хэзээ ч гаргахгүй.
   ZVec    — (2026-11-04) вектор санах ой: voice (1% датасетийн нэргүй пост),
             outcome (хаагдсан туршилт), msg (гишүүний өөрийн мессеж). */

const ZCardSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", unique: true, index: true },
    card: { type: Schema.Types.Mixed, default: {} },
    summary: { type: String, default: "", maxlength: 1500 },
    turns: { type: Number, default: 0 },
  },
  { timestamps: true, minimize: false },
);

const ZMsgSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    role: { type: String, enum: ["user", "agent"], required: true },
    text: { type: String, required: true, maxlength: 6000 },
    log: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);
ZMsgSchema.index({ user: 1, createdAt: -1 });

const ZTestSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    action: { type: String, required: true, maxlength: 500 },
    metric: { type: String, default: "", maxlength: 200 },
    threshold: { type: String, default: "", maxlength: 200 },
    due: { type: Date, required: true },
    status: { type: String, enum: ["open", "keep", "tweak", "kill", "dropped"], default: "open", index: true },
    value: { type: String, default: "" },
    beliefUpdate: { type: String, default: "" },
  },
  { timestamps: true },
);

const ZPersonaSchema = new Schema(
  {
    pid: { type: String, unique: true },
    archetype: { type: String, index: true },
    resolution: { type: String, index: true },
    stage: { type: String, index: true },
    blocks: [String],
    focus: [String],
    beliefs: [String],
    drivers: [String],
    entry: [String],
    locus: String,
    domains: [String],
    offer: String,
    abroad: Boolean,
    ageBand: String,
  },
  { versionKey: false },
);

const ZVecSchema = new Schema(
  {
    kind: { type: String, enum: ["voice", "outcome", "msg"], required: true, index: true },
    ref: { type: String, unique: true, sparse: true },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    text: { type: String, required: true, maxlength: 2000 },
    meta: { type: Schema.Types.Mixed },
    vector: { type: [Number], select: false },
    embModel: { type: String },
  },
  { timestamps: true, versionKey: false },
);
ZVecSchema.index({ kind: 1, user: 1 });

export type ZCardDoc = { user: Types.ObjectId; card: Record<string, unknown>; summary?: string; turns: number };

export const ZCard: Model<ZCardDoc> = mongoose.models.ZCard || mongoose.model<ZCardDoc>("ZCard", ZCardSchema);
export const ZMsg = mongoose.models.ZMsg || mongoose.model("ZMsg", ZMsgSchema);
export const ZTest = mongoose.models.ZTest || mongoose.model("ZTest", ZTestSchema);
export const ZPersona = mongoose.models.ZPersona || mongoose.model("ZPersona", ZPersonaSchema);
export const ZVec = mongoose.models.ZVec || mongoose.model("ZVec", ZVecSchema);
