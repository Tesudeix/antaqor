import mongoose, { Schema, Document, Types } from "mongoose";

export type EnrollmentStatus = "active" | "completed" | "stopped";

export interface IMetaNurtureEnrollment extends Document {
  nurtureId: Types.ObjectId;
  conversationId: Types.ObjectId;
  platform: "instagram" | "messenger";
  partnerId: string;
  currentStep: number;
  nextRunAt: Date;
  status: EnrollmentStatus;
  stopReason?: string;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MetaNurtureEnrollmentSchema = new Schema<IMetaNurtureEnrollment>(
  {
    nurtureId: { type: Schema.Types.ObjectId, ref: "MetaNurture", required: true, index: true },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "MetaConversation",
      required: true,
      index: true,
    },
    platform: { type: String, enum: ["instagram", "messenger"], required: true },
    partnerId: { type: String, required: true },
    currentStep: { type: Number, default: 0 },
    nextRunAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["active", "completed", "stopped"],
      default: "active",
      index: true,
    },
    stopReason: { type: String, default: "" },
    startedAt: { type: Date, default: () => new Date() },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// One active enrollment per (nurture, conversation)
MetaNurtureEnrollmentSchema.index(
  { nurtureId: 1, conversationId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

export default (mongoose.models.MetaNurtureEnrollment as mongoose.Model<IMetaNurtureEnrollment>) ||
  mongoose.model<IMetaNurtureEnrollment>("MetaNurtureEnrollment", MetaNurtureEnrollmentSchema);
