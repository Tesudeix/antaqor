import mongoose, { Schema, Document, Model } from "mongoose";

export type BroadcastAudience = "new7" | "new30" | "paid" | "all";
export type BroadcastStatus = "running" | "done" | "cancelled" | "failed";

export interface IEmailBroadcast extends Document {
  audience: BroadcastAudience;
  subject: string;
  message: string;
  /** Илгээх бүх хаяг — дараалал нь тогтмол, cursor үүн дээр явна. */
  recipients: string[];
  /** Дуусгасан хаягийн тоо. Дахин эхлүүлэхэд эндээс үргэлжилнэ. */
  cursor: number;
  sent: number;
  failed: number;
  /** Зохиомол/буруу гэж шүүгдээд огт илгээгээгүй хаягийн тоо. */
  skipped: number;
  errorSamples: string[];
  status: BroadcastStatus;
  /** Ажиллаж байгаа процесс багц тутамд шинэчилнэ — уналтыг илрүүлнэ. */
  heartbeatAt: Date;
  startedBy: string;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EmailBroadcastSchema = new Schema<IEmailBroadcast>(
  {
    audience: { type: String, enum: ["new7", "new30", "paid", "all"], required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    recipients: { type: [String], default: [] },
    cursor: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    errorSamples: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["running", "done", "cancelled", "failed"],
      default: "running",
      index: true,
    },
    heartbeatAt: { type: Date, default: Date.now },
    startedBy: { type: String, default: "" },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

EmailBroadcastSchema.index({ status: 1, createdAt: -1 });

export default (mongoose.models.EmailBroadcast as Model<IEmailBroadcast>) ||
  mongoose.model<IEmailBroadcast>("EmailBroadcast", EmailBroadcastSchema);
