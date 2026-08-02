import mongoose, { Schema, Document, Types } from "mongoose";
import type { MetaPlatform } from "./MetaConversation";

export type MetaMessageDirection = "in" | "out";
export type MetaMessageSource = "user" | "ai" | "manual" | "trigger";

export interface IMetaMessage extends Document {
  conversationId: Types.ObjectId;
  platform: MetaPlatform;
  direction: MetaMessageDirection;
  source: MetaMessageSource;
  text: string;
  mid?: string;
  errorBody?: string;
  manualSenderEmail?: string;
  triggerId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MetaMessageSchema = new Schema<IMetaMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "MetaConversation", required: true, index: true },
    platform: { type: String, enum: ["instagram", "messenger"], required: true },
    direction: { type: String, enum: ["in", "out"], required: true },
    source: { type: String, enum: ["user", "ai", "manual", "trigger"], required: true },
    text: { type: String, required: true },
    mid: { type: String, index: true, sparse: true },
    errorBody: { type: String, default: "" },
    manualSenderEmail: { type: String, default: "" },
    triggerId: { type: Schema.Types.ObjectId, ref: "MetaTrigger" },
  },
  { timestamps: true }
);

MetaMessageSchema.index({ conversationId: 1, createdAt: 1 });

export default (mongoose.models.MetaMessage as mongoose.Model<IMetaMessage>) ||
  mongoose.model<IMetaMessage>("MetaMessage", MetaMessageSchema);
