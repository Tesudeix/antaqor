import mongoose, { Schema } from "mongoose";

/* Агент бүрийн шийдвэр — «яагаад хариулсангүй» гэдгийг эзэн харж чадна. 30 хоногийн TTL. */
const ConciergeLogSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, index: true },
    partner: { type: String, default: "" },
    platform: { type: String, default: "messenger" },
    inText: { type: String, default: "" },
    action: { type: String, default: "reply" }, // reply | skip | handoff | batched | error
    why: { type: String, default: "" },
    reply: { type: String, default: "" },
    provider: { type: String, default: "" },
    ms: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30, index: true },
  },
  { versionKey: false }
);

export default (mongoose.models.ConciergeLog as mongoose.Model<any>) ||
  mongoose.model("ConciergeLog", ConciergeLogSchema);
