import mongoose, { Schema, Document, Model } from "mongoose";

// One AI-generated video in the /ai studio feed.
export type AiCreationStatus = "processing" | "done" | "failed";

export interface IAiCreation extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  userName: string; // denormalized for fast feed rendering
  userAvatar: string;
  // ── Input ──
  prompt: string; // what the user typed
  presetId: string; // camera-motion preset ("" = free)
  presetLabel: string;
  fullPrompt: string; // prompt + motion fragment actually sent to the engine
  engine: string; // seedance tier: mini | fast | pro (legacy: std | pro via kling)
  provider: "piapi" | "kling";
  resolution: string; // 480p | 720p | 1080p
  inputType: "text" | "image";
  imageUrl: string; // source/start frame
  aspectRatio: "16:9" | "9:16" | "1:1";
  duration: "5" | "10";
  // ── Task ──
  taskId: string;
  taskType: "text2video" | "image2video";
  status: AiCreationStatus;
  videoUrl: string;
  error: string;
  cost: number;
  refunded: boolean;
  // ── Social ──
  isPublic: boolean;
  likes: string[]; // user ids
  likeCount: number;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

const AiCreationSchema = new Schema<IAiCreation>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userName: { type: String, default: "" },
    userAvatar: { type: String, default: "" },
    prompt: { type: String, default: "", maxlength: 2500 },
    presetId: { type: String, default: "" },
    presetLabel: { type: String, default: "" },
    fullPrompt: { type: String, default: "" },
    engine: { type: String, default: "mini" },
    provider: { type: String, enum: ["piapi", "kling"], default: "piapi" },
    resolution: { type: String, default: "720p" },
    inputType: { type: String, enum: ["text", "image"], default: "text" },
    imageUrl: { type: String, default: "" },
    aspectRatio: { type: String, enum: ["16:9", "9:16", "1:1"], default: "9:16" },
    duration: { type: String, enum: ["5", "10"], default: "5" },
    taskId: { type: String, default: "" },
    taskType: { type: String, enum: ["text2video", "image2video"], default: "text2video" },
    status: { type: String, enum: ["processing", "done", "failed"], default: "processing" },
    videoUrl: { type: String, default: "" },
    error: { type: String, default: "" },
    cost: { type: Number, default: 0 },
    refunded: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: true },
    likes: { type: [String], default: [] },
    likeCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AiCreationSchema.index({ createdAt: -1 });
AiCreationSchema.index({ status: 1, isPublic: 1, createdAt: -1 });

const AiCreation: Model<IAiCreation> =
  mongoose.models.AiCreation || mongoose.model<IAiCreation>("AiCreation", AiCreationSchema);

export default AiCreation;
