import mongoose, { Schema, Document, Model } from "mongoose";

export type NewsCategory =
  | "AI"
  | "LLM"
  | "Agents"
  | "Research"
  | "Бизнес"
  | "Tool"
  | "Монгол";

export interface INews extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: NewsCategory;
  tags: string[];
  source: string;
  sourceUrl: string;
  authorName: string;
  authorAvatar: string;
  featured: boolean;
  published: boolean;
  views: number;
  readingMinutes: number;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NewsSchema = new Schema<INews>(
  {
    title: { type: String, required: true, trim: true, maxlength: 220 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    excerpt: { type: String, default: "", trim: true, maxlength: 400 },
    content: { type: String, default: "", trim: true, maxlength: 50000 },
    coverImage: { type: String, default: "" },
    category: {
      type: String,
      enum: ["AI", "LLM", "Agents", "Research", "Бизнес", "Tool", "Монгол"],
      default: "AI",
    },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    source: { type: String, default: "", trim: true, maxlength: 80 },
    sourceUrl: { type: String, default: "", trim: true, maxlength: 600 },
    authorName: { type: String, default: "Antaqor", trim: true, maxlength: 80 },
    authorAvatar: { type: String, default: "" },
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    readingMinutes: { type: Number, default: 1 },
    publishedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

NewsSchema.index({ published: 1, featured: -1, publishedAt: -1 });
NewsSchema.index({ category: 1, publishedAt: -1 });

const News: Model<INews> =
  mongoose.models.News || mongoose.model<INews>("News", NewsSchema);

export default News;
