import mongoose, { Schema, Document, Model } from "mongoose";

// Carousel-хэлбэрийн prompt багц: дэс дараалалтай слайдууд, слайд бүр нэг
// хуулж болох prompt. freeSlides хүртэлх нь хэнд ч нээлттэй (нэвтрэлтгүй),
// цааших нь requiredPlan-аар нээгдэнэ.
export interface IPromptSlide {
  title: string;
  prompt: string;
}

export interface IPromptPost extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  requiredPlan: "free" | "starter" | "builder" | "operator";
  freeSlides: number;
  slides: IPromptSlide[];
  published: boolean;
  copiesCount: number;
  sharesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const PromptPostSchema = new Schema<IPromptPost>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    requiredPlan: {
      type: String,
      enum: ["free", "starter", "builder", "operator"],
      default: "free",
    },
    freeSlides: { type: Number, default: 2 },
    slides: [
      {
        title: { type: String, default: "" },
        prompt: { type: String, required: true },
      },
    ],
    published: { type: Boolean, default: true },
    copiesCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const PromptPost: Model<IPromptPost> =
  mongoose.models.PromptPost || mongoose.model<IPromptPost>("PromptPost", PromptPostSchema);

export default PromptPost;
