import mongoose, { Schema, Document } from "mongoose";

export type TriggerMatchMode = "exact" | "contains" | "starts_with" | "word";
export type TriggerPlatform = "instagram" | "messenger" | "both";
export type TriggerSurface = "comment" | "dm" | "both";

export interface IQuickReplyButton {
  label: string;
  payload: string;
}

export interface IMetaTrigger extends Document {
  name: string;
  keywords: string[];
  matchMode: TriggerMatchMode;
  caseSensitive: boolean;
  platform: TriggerPlatform;
  surface: TriggerSurface;
  account: string;
  dmTemplate: string;
  commentReply: string;
  commentLike: boolean;
  postId: string;
  quickReplies: IQuickReplyButton[];
  buttons: { label: string; url: string }[];
  cards: { imageUrl: string; title: string; subtitle: string; buttons: { label: string; url: string }[] }[];
  enrollNurtureId?: mongoose.Types.ObjectId;
  enabled: boolean;
  hitCount: number;
  lastFiredAt?: Date;
  createdByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const MetaTriggerSchema = new Schema<IMetaTrigger>(
  {
    name: { type: String, required: true },
    keywords: { type: [String], default: [] },
    matchMode: { type: String, enum: ["exact", "contains", "starts_with", "word"], default: "contains" },
    caseSensitive: { type: Boolean, default: false },
    platform: { type: String, enum: ["instagram", "messenger", "both"], default: "both" },
    surface: { type: String, enum: ["comment", "dm", "both"], default: "both" },
    dmTemplate: { type: String, required: true },
    commentReply: { type: String, default: "" },
    // Like the commenter's comment as the Page when this trigger fires.
    commentLike: { type: Boolean, default: false },
    postId: { type: String, default: "" },
    quickReplies: {
      type: [
        new Schema(
          {
            label: { type: String, required: true },
            payload: { type: String, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    buttons: {
      type: [new Schema({ label: { type: String, required: true }, url: { type: String, default: "" } }, { _id: false })],
      default: [],
    },
    cards: {
      type: [
        new Schema(
          {
            imageUrl: { type: String, default: "" },
            title: { type: String, required: true },
            subtitle: { type: String, default: "" },
            buttons: {
              type: [new Schema({ label: { type: String, required: true }, url: { type: String, default: "" } }, { _id: false })],
              default: [],
            },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    enrollNurtureId: { type: Schema.Types.ObjectId, ref: "MetaNurture" },
    account: { type: String, default: "antaqor", index: true },
    enabled: { type: Boolean, default: true },
    hitCount: { type: Number, default: 0 },
    lastFiredAt: { type: Date },
    createdByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

MetaTriggerSchema.index({ enabled: 1, surface: 1, platform: 1 });

export default (mongoose.models.MetaTrigger as mongoose.Model<IMetaTrigger>) ||
  mongoose.model<IMetaTrigger>("MetaTrigger", MetaTriggerSchema);
