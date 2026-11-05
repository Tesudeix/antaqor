import mongoose, { Schema, Document, Model } from "mongoose";

/* Өдөр бүрийн дагагчийн тоо — суваг бүрийн өсөлтийг цаг хугацаагаар харна
   (Graph API зөвхөн ОДООГИЙН тоог өгдөг тул түүхийг өөрсдөө хадгална). */
export interface ISocialSnapshot extends Document { day: string; platform: string; followers: number; posts: number }
const S = new Schema<ISocialSnapshot>({
  day: { type: String, required: true },
  platform: { type: String, required: true },
  followers: { type: Number, default: 0 },
  posts: { type: Number, default: 0 },
}, { timestamps: true });
S.index({ day: 1, platform: 1 }, { unique: true });
const SocialSnapshot: Model<ISocialSnapshot> = mongoose.models.SocialSnapshot || mongoose.model<ISocialSnapshot>("SocialSnapshot", S);
export default SocialSnapshot;
