import mongoose, { Schema, Document, Model } from "mongoose";

// ─── SocialFlow runtime session — нэг харилцан яриа флоу дотор хаана байгааг
// хадгална. Товч хүлээж буй (waiting_button) эсвэл delay-ийн дараа
// үргэлжлүүлэхийг хүлээж буй (waiting_delay) төлөвтэй. ───
export interface ISocialFlowSession extends Document {
  conversationId: mongoose.Types.ObjectId;
  flowId: mongoose.Types.ObjectId;
  platform: "instagram" | "messenger";
  account: string;
  partnerId: string;
  nodeId: string; // resume/continue эхлэх node
  status: "waiting_button" | "waiting_delay" | "done";
  resumeAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SocialFlowSessionSchema = new Schema<ISocialFlowSession>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "MetaConversation", required: true },
    flowId: { type: Schema.Types.ObjectId, ref: "SocialFlow", required: true },
    platform: { type: String, enum: ["instagram", "messenger"], required: true },
    account: { type: String, default: "antaqor" },
    partnerId: { type: String, required: true },
    nodeId: { type: String, required: true },
    status: { type: String, enum: ["waiting_button", "waiting_delay", "done"], default: "waiting_button" },
    resumeAt: { type: Date, default: null },
  },
  { timestamps: true }
);

SocialFlowSessionSchema.index({ conversationId: 1, flowId: 1 }, { unique: true });
SocialFlowSessionSchema.index({ status: 1, resumeAt: 1 });

const SocialFlowSession: Model<ISocialFlowSession> =
  mongoose.models.SocialFlowSession ||
  mongoose.model<ISocialFlowSession>("SocialFlowSession", SocialFlowSessionSchema);

export default SocialFlowSession;
