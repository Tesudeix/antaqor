import mongoose, { Schema, Document, Model } from "mongoose";

export type ThreadsMatchMode = "any" | "contains" | "exact" | "starts_with";
export type ThreadsTriggerType = "new_comment" | "new_like";
export type ThreadsScope = "all" | "post" | "hashtag";
// Only actions the Threads API actually supports. "like_back" / "dm" are NOT
// available via the API — the UI shows them disabled, they never reach here.
export type ThreadsAction = "reply" | "log_lead" | "reply_and_log";

export interface IThreadsTrigger extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  // ── Trigger ──
  triggerType: ThreadsTriggerType;
  scope: ThreadsScope; // all posts | one post id | posts whose text has a hashtag
  scopeValue: string; // post id or hashtag (without #)
  threadsUserId: string; // which connected account; "" = all accounts
  // ── Conditions (comment triggers) ──
  keywords: string[];
  matchMode: ThreadsMatchMode;
  caseSensitive: boolean;
  excludeKeywords: string[]; // skip if comment contains any of these
  firstTimeOnly: boolean; // only fire for engagers we've never seen before
  activeFrom: number; // hour 0-23 (Asia/Ulaanbaatar); from==to → always on
  activeTo: number;
  // ── Action ──
  action: ThreadsAction;
  replyTemplate: string; // supports {{username}}; for new_like: {{count}}
  replyVariations: string[];
  leadLabel: string; // tag applied to logged leads
  // ── State ──
  enabled: boolean;
  hitCount: number;
  lastFiredAt?: Date;
  createdByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const ThreadsTriggerSchema = new Schema<IThreadsTrigger>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    triggerType: { type: String, enum: ["new_comment", "new_like"], default: "new_comment" },
    scope: { type: String, enum: ["all", "post", "hashtag"], default: "all" },
    scopeValue: { type: String, default: "", trim: true },
    threadsUserId: { type: String, default: "" },
    keywords: { type: [String], default: [] },
    matchMode: {
      type: String,
      enum: ["any", "contains", "exact", "starts_with"],
      default: "contains",
    },
    caseSensitive: { type: Boolean, default: false },
    excludeKeywords: { type: [String], default: [] },
    firstTimeOnly: { type: Boolean, default: false },
    activeFrom: { type: Number, default: 0, min: 0, max: 23 },
    activeTo: { type: Number, default: 0, min: 0, max: 23 },
    action: { type: String, enum: ["reply", "log_lead", "reply_and_log"], default: "reply" },
    replyTemplate: { type: String, default: "", trim: true, maxlength: 480 },
    replyVariations: { type: [String], default: [] },
    leadLabel: { type: String, default: "", trim: true, maxlength: 60 },
    enabled: { type: Boolean, default: true },
    hitCount: { type: Number, default: 0 },
    lastFiredAt: { type: Date },
    createdByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

ThreadsTriggerSchema.index({ enabled: 1 });

const ThreadsTrigger: Model<IThreadsTrigger> =
  mongoose.models.ThreadsTrigger ||
  mongoose.model<IThreadsTrigger>("ThreadsTrigger", ThreadsTriggerSchema);

export default ThreadsTrigger;
