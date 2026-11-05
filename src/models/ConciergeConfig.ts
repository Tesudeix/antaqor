import mongoose, { Schema } from "mongoose";

/* Messenger «Чат агент» — нэг хуудас, нэг баримт. Эзэн энд ҮНДСЭН мэдээллээ
   бичнэ; бусдыг (хэв маяг, хариулах эсэх, урт) агент өөрөө шийднэ. */
const ConciergeConfigSchema = new Schema(
  {
    account: { type: String, default: "antaqor", unique: true },
    enabled: { type: Boolean, default: false },
    includeInstagram: { type: Boolean, default: false },
    name: { type: String, default: "Antaqor" },
    about: { type: String, default: "" },
    offers: { type: String, default: "" },
    facts: { type: String, default: "" },
    goal: { type: String, default: "" },
    rules: { type: String, default: "" },
    handoffPhone: { type: String, default: "" },
    address: { type: String, default: "чи", enum: ["чи", "та"] },
    useThreads: { type: Boolean, default: true },
    useFeed: { type: Boolean, default: true },
    disclosure: { type: Boolean, default: true },
    waitSec: { type: Number, default: 6 },
    maxPerDay: { type: Number, default: 30 },
  },
  { timestamps: true }
);

export default (mongoose.models.ConciergeConfig as mongoose.Model<any>) ||
  mongoose.model("ConciergeConfig", ConciergeConfigSchema);
