import mongoose, { Schema, Document } from "mongoose";

export interface INurtureStep {
  delayMinutes: number;
  dmText: string;
  stopOnReply: boolean;
}

export interface IMetaNurture extends Document {
  name: string;
  description: string;
  enabled: boolean;
  steps: INurtureStep[];
  enrolledCount: number;
  completedCount: number;
  createdByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const NurtureStepSchema = new Schema<INurtureStep>(
  {
    delayMinutes: { type: Number, required: true, min: 0 },
    dmText: { type: String, required: true },
    stopOnReply: { type: Boolean, default: true },
  },
  { _id: false }
);

const MetaNurtureSchema = new Schema<IMetaNurture>(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    enabled: { type: Boolean, default: true },
    steps: { type: [NurtureStepSchema], default: [] },
    enrolledCount: { type: Number, default: 0 },
    completedCount: { type: Number, default: 0 },
    createdByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

export default (mongoose.models.MetaNurture as mongoose.Model<IMetaNurture>) ||
  mongoose.model<IMetaNurture>("MetaNurture", MetaNurtureSchema);
