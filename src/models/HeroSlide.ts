import mongoose, { Schema } from "mongoose";

// ─── Нүүрний hero слайд — админаас зурагтайгаар удирдана ───
export interface IHeroSlide {
  _id: mongoose.Types.ObjectId;
  order: number;
  chrome: string; // eyebrow, ж: "ANTAQOR /// ШИНЭ ЭЛСЭЛТ"
  line1: string; // шар мөр
  line2: string; // хар том мөр (accent)
  sub: string;
  ctaLabel: string;
  ctaHref: string;
  image: string; // /uploads/... — баруун талд character/visual болж харагдана
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HeroSlideSchema = new Schema<IHeroSlide>(
  {
    order: { type: Number, default: 0 },
    chrome: { type: String, default: "", maxlength: 80 },
    line1: { type: String, required: true, maxlength: 60 },
    line2: { type: String, default: "", maxlength: 60 },
    sub: { type: String, default: "", maxlength: 200 },
    ctaLabel: { type: String, default: "Эхлэх", maxlength: 40 },
    ctaHref: { type: String, default: "/auth/signup?plan=starter", maxlength: 200 },
    image: { type: String, default: "", maxlength: 500 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default (mongoose.models.HeroSlide as mongoose.Model<IHeroSlide>) ||
  mongoose.model<IHeroSlide>("HeroSlide", HeroSlideSchema);
