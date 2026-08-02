import mongoose, { Schema, Document, Types } from "mongoose";

// One row per (conversation, flow) that the 24h auto-send has dispatched.
// Acts as the idempotency guard: the cron skips any conversation that already
// has a log row, so a flow is auto-sent at most once per conversation.

export interface IMetaFlowAutoSendLog extends Document {
  flowId: Types.ObjectId;
  conversationId: Types.ObjectId;
  platform: "instagram" | "messenger";
  partnerId: string;
  account: string;
  status: "sent" | "failed";
  detail?: string;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MetaFlowAutoSendLogSchema = new Schema<IMetaFlowAutoSendLog>(
  {
    flowId: { type: Schema.Types.ObjectId, ref: "MetaFlow", required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "MetaConversation", required: true, index: true },
    platform: { type: String, enum: ["instagram", "messenger"], required: true },
    partnerId: { type: String, required: true },
    account: { type: String, default: "antaqor" },
    status: { type: String, enum: ["sent", "failed"], default: "sent" },
    detail: { type: String, default: "" },
    sentAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// Idempotency: at most one auto-send per (conversation, flow).
MetaFlowAutoSendLogSchema.index({ conversationId: 1, flowId: 1 }, { unique: true });

export default (mongoose.models.MetaFlowAutoSendLog as mongoose.Model<IMetaFlowAutoSendLog>) ||
  mongoose.model<IMetaFlowAutoSendLog>("MetaFlowAutoSendLog", MetaFlowAutoSendLogSchema);
