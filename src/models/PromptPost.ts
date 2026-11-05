import mongoose, { Schema, Document, Model } from "mongoose";

// Carousel-хэлбэрийн prompt багц: дэс дараалалтай слайдууд, слайд бүр нэг
// хуулж болох prompt. freeSlides хүртэлх нь хэнд ч нээлттэй (нэвтрэлтгүй),
// цааших нь requiredPlan-аар нээгдэнэ.
export interface IPromptSlide {
  title: string;
  prompt: string;
}

/** Content type a pack produces — what the person is actually shopping for. */
export type PromptCategory = "image" | "video" | "text" | "business" | "code" | "other";
export const PROMPT_CATEGORIES: PromptCategory[] = ["image", "video", "text", "business", "code", "other"];

export interface IPromptPost extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  /** 1.91:1 card. Same ratio Facebook/LinkedIn/Threads crop link previews to,
   *  so one image serves the grid, the detail hero and the share card without
   *  ever being re-cropped. */
  coverImage: string;
  category: PromptCategory;
  /** Hand-picked for the Trending rail. */
  featured: boolean;
  tags: string[];
  /** Credits to unlock permanently. 0 = plan gate only, no credit sale. */
  creditPrice: number;
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
    coverImage: { type: String, default: "" },
    category: {
      type: String,
      enum: ["image", "video", "text", "business", "code", "other"],
      default: "text",
      index: true,
    },
    featured: { type: Boolean, default: false, index: true },
    tags: { type: [String], default: [] },
    creditPrice: { type: Number, default: 0, min: 0 },
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
