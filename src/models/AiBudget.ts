import mongoose, { Schema, Document, Model } from "mongoose";

/* AI provider-ийн цэнэглэлтийн бүртгэл (2026-10-18). OpenAI/Google нь API
   түлхүүрээр үлдэгдэл харуулдаггүй — тиймээс эзэн цэнэглэх бүрдээ энд
   бичнэ, систем бодит зарцуулалтыг (AiImage.usd, AiVideo-оос тооцсон)
   хасаж үлдэгдэл ба "≈ хэдэн зураг/видео" гэж харуулна. */
export interface IAiBudget extends Document {
  provider: "openai" | "gemini" | "higgsfield";
  topups: { usd: number; note: string; at: Date }[];
}
const S = new Schema<IAiBudget>({
  provider: { type: String, enum: ["openai", "gemini", "higgsfield"], unique: true, required: true },
  topups: { type: [{ usd: Number, note: { type: String, default: "" }, at: { type: Date, default: Date.now } }], default: [] },
}, { timestamps: true });
const AiBudget: Model<IAiBudget> = mongoose.models.AiBudget || mongoose.model<IAiBudget>("AiBudget", S);
export default AiBudget;
