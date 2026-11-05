import { IMAGE_PROMPT_LIMIT, IMAGE_FULL_PROMPT_LIMIT } from "@/lib/imagePrompt";
import mongoose, { Schema, Document, Model } from "mongoose";

// One AI-generated IMAGE (the /tools/nano-banano studio). Videos live in
// AiCreation; this is the image ledger — history for the member, cost
// accounting for the admin. Every generation attempt is written, including
// failures (status "failed", refunded: true) so spend reports reconcile
// with CreditTx exactly.

export type AiImageStatus = "done" | "failed";

export interface IAiImage extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  // ── Input ──
  prompt: string;       // what the member typed
  fullPrompt: string;   // prompt + style + aspect hint actually sent
  modelId: string;      // catalog id: nano2 | nanoPro | nanoLite | nano | gpt | kling
  modelVersion: string; // provider model that served it, e.g. gemini-3.1-flash-image
  provider: "gemini" | "openai" | "kling";
  aspectRatio: string;
  resolution: "standard" | "hd";
  style: string;
  refCount: number;     // reference images supplied (0 = text-to-image)
  // ── Output ──
  url: string;          // /uploads/tool-gen-*.png
  mime: string;
  bytes: number;
  status: AiImageStatus;
  error: string;
  durationMs: number;
  // ── Money ──
  cost: number;         // credits charged
  refunded: boolean;
  usd: number;          // provider cost in USD (from usage tokens)
  usdEstimate: boolean; // true when the rate was not verified
  tokens: { prompt: number; image: number; total: number };
  // ── Social ──
  sharedPostId?: mongoose.Types.ObjectId;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AiImageSchema = new Schema<IAiImage>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    prompt: { type: String, default: "", maxlength: IMAGE_PROMPT_LIMIT },
    fullPrompt: { type: String, default: "", maxlength: IMAGE_FULL_PROMPT_LIMIT },
    modelId: { type: String, default: "nano2", index: true },
    modelVersion: { type: String, default: "" },
    provider: { type: String, enum: ["gemini", "openai", "kling"], default: "gemini" },
    aspectRatio: { type: String, default: "1:1" },
    resolution: { type: String, enum: ["standard", "hd"], default: "standard" },
    style: { type: String, default: "auto" },
    refCount: { type: Number, default: 0 },
    url: { type: String, default: "" },
    mime: { type: String, default: "" },
    bytes: { type: Number, default: 0 },
    status: { type: String, enum: ["done", "failed"], default: "done", index: true },
    error: { type: String, default: "", maxlength: 500 },
    durationMs: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    refunded: { type: Boolean, default: false },
    usd: { type: Number, default: 0 },
    usdEstimate: { type: Boolean, default: false },
    tokens: {
      prompt: { type: Number, default: 0 },
      image: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    sharedPostId: { type: Schema.Types.ObjectId, ref: "Post" },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

AiImageSchema.index({ user: 1, createdAt: -1 });
AiImageSchema.index({ createdAt: -1 });
AiImageSchema.index({ status: 1, createdAt: -1 });

const AiImage: Model<IAiImage> =
  mongoose.models.AiImage || mongoose.model<IAiImage>("AiImage", AiImageSchema);

export default AiImage;
