import mongoose, { Schema, Document, Types } from "mongoose";

export type MetaPlatform = "instagram" | "messenger";
export type MetaConversationStatus = "open" | "archived";
export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";

export interface IMetaConversation extends Document {
  platform: MetaPlatform;
  partnerId: string;
  account?: string;
  partnerName?: string;
  partnerUsername?: string;
  partnerProfilePic?: string;
  partnerVerified?: boolean;
  partnerFollowsUs?: boolean;
  weFollowPartner?: boolean;
  leadStatus?: LeadStatus;
  adminNotes?: string;
  leadUpdatedAt?: Date;
  leadUpdatedByEmail?: string;
  linkedUserId?: Types.ObjectId;
  lastMessagePreview: string;
  lastMessageDirection: "in" | "out";
  lastMessageAt: Date;
  lastInboundAt?: Date;
  unreadCount: number;
  status: MetaConversationStatus;
  aiDisabled: boolean;
  intentScore: number;
  intentLabel: "hot" | "warm" | "cold" | "support" | "fan" | "unknown";
  internalNote: string;
  safetyFlag: "distress" | "violence" | null;
  escalatedToHuman: boolean;
  disclosureSent: boolean;
  welcomeMenuSent: boolean;
  // Pointer to the Flow Builder card this contact is currently parked on, or
  // null when not mid-flow. Mirror of the active MetaFlowSession; kept on the
  // conversation so the webhook hot path reads position in a single doc.
  activeFlow?: { flowId: string; nodeId: string } | null;
  broadcastOptOut?: boolean;
  lastBroadcastAt?: Date;
  funnel?: {
    name: string;
    step: number;
    answers: Record<string, string>;
  } | null;
  userMemo?: {
    business?: string;
    goals?: string[];
    pain?: string[];
    notes?: string;
    updatedAt?: Date;
  } | null;
  profile?: Record<string, Record<string, string> & { completedAt?: Date }> | null;
  createdAt: Date;
  updatedAt: Date;
}

const MetaConversationSchema = new Schema<IMetaConversation>(
  {
    platform: { type: String, enum: ["instagram", "messenger"], required: true, index: true },
    partnerId: { type: String, required: true, index: true },
    account: { type: String, default: "antaqor", index: true },
    partnerName: { type: String, default: "" },
    partnerUsername: { type: String, default: "" },
    partnerProfilePic: { type: String, default: "" },
    partnerVerified: { type: Boolean, default: false },
    partnerFollowsUs: { type: Boolean, default: false },
    weFollowPartner: { type: Boolean, default: false },
    leadStatus: {
      type: String,
      enum: ["new", "contacted", "qualified", "won", "lost"],
      default: "new",
      index: true,
    },
    adminNotes: { type: String, default: "" },
    leadUpdatedAt: { type: Date },
    leadUpdatedByEmail: { type: String, default: "" },
    linkedUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    lastMessagePreview: { type: String, default: "" },
    lastMessageDirection: { type: String, enum: ["in", "out"], default: "in" },
    lastMessageAt: { type: Date, default: () => new Date() },
    lastInboundAt: { type: Date, index: true },
    unreadCount: { type: Number, default: 0 },
    status: { type: String, enum: ["open", "archived"], default: "open", index: true },
    aiDisabled: { type: Boolean, default: false },
    intentScore: { type: Number, default: 0 },
    intentLabel: {
      type: String,
      enum: ["hot", "warm", "cold", "support", "fan", "unknown"],
      default: "unknown",
    },
    internalNote: { type: String, default: "" },
    safetyFlag: {
      type: String,
      enum: ["distress", "violence", null],
      default: null,
      index: true,
    },
    escalatedToHuman: { type: Boolean, default: false, index: true },
    disclosureSent: { type: Boolean, default: false },
    welcomeMenuSent: { type: Boolean, default: false },
    activeFlow: { type: Schema.Types.Mixed, default: null },
    broadcastOptOut: { type: Boolean, default: false, index: true },
    lastBroadcastAt: { type: Date },
    funnel: { type: Schema.Types.Mixed, default: null },
    userMemo: { type: Schema.Types.Mixed, default: null },
    profile: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

MetaConversationSchema.index({ platform: 1, partnerId: 1 }, { unique: true });
MetaConversationSchema.index({ lastMessageAt: -1 });
MetaConversationSchema.index({ intentScore: -1 });

export default (mongoose.models.MetaConversation as mongoose.Model<IMetaConversation>) ||
  mongoose.model<IMetaConversation>("MetaConversation", MetaConversationSchema);
