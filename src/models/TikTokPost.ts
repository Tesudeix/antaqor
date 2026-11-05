import mongoose, { Schema, Document, Model } from "mongoose";

// Нэг нийтлэх ОРОЛДЛОГО. `AiVideo`-той ижил зарчим: оролдлого БҮР
// бичигдэнэ — амжилтгүй нь ч — тэгснээр "юу болсон бэ" гэдэгт TikTok-ийн
// самбар руу орохгүйгээр хариулж чадна.
//
// `status` нь МАНАЙ төлөв; `tiktokStatus` нь TikTok-ийн буцаасан түүхий
// утга (PROCESSING_UPLOAD / PUBLISH_COMPLETE / FAILED ...). Хоёрыг зориуд
// салгасан: TikTok "SEND_TO_USER_INBOX" гэж буцаах үе бий бөгөөд тэр нь
// бидний хувьд бүтсэн боловч "нийтлэгдсэн" биш.

export type TikTokPostStatus =
  | "QUEUED"
  | "UPLOADING"
  | "PROCESSING"
  | "PUBLISHED"
  | "FAILED";

export interface ITikTokPost extends Document {
  userId: string;
  openId: string;
  sourceKind: "aivideo" | "aicreation";
  sourceId: string; // манай талын видеоны _id
  videoUrl: string; // /uploads/... — аудит хийхэд
  publishId: string;
  caption: string;
  privacyLevel: string;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  isAigc: boolean;
  bytes: number;
  status: TikTokPostStatus;
  tiktokStatus: string;
  errorCode: string;
  errorMessage: string;
  createdAt: Date;
  updatedAt: Date;
}

const TikTokPostSchema = new Schema<ITikTokPost>(
  {
    userId: { type: String, required: true, index: true },
    openId: { type: String, default: "" },
    sourceKind: { type: String, enum: ["aivideo", "aicreation"], default: "aivideo" },
    sourceId: { type: String, default: "" },
    videoUrl: { type: String, default: "" },
    publishId: { type: String, default: "", index: true },
    caption: { type: String, default: "", maxlength: 2200 },
    privacyLevel: { type: String, default: "" },
    disableComment: { type: Boolean, default: false },
    disableDuet: { type: Boolean, default: false },
    disableStitch: { type: Boolean, default: false },
    isAigc: { type: Boolean, default: false },
    bytes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["QUEUED", "UPLOADING", "PROCESSING", "PUBLISHED", "FAILED"],
      default: "QUEUED",
      index: true,
    },
    tiktokStatus: { type: String, default: "" },
    errorCode: { type: String, default: "" },
    errorMessage: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true }
);

TikTokPostSchema.index({ userId: 1, createdAt: -1 });

const TikTokPost: Model<ITikTokPost> =
  (mongoose.models.TikTokPost as Model<ITikTokPost>) ||
  mongoose.model<ITikTokPost>("TikTokPost", TikTokPostSchema);

export default TikTokPost;
