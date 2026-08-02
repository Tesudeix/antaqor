import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBudjargalMessage extends Document {
  _id: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId;
  guestKey?: string;
  role: "user" | "assistant";
  content: string;
  affectionDelta: number;
  affectionAfter?: number;
  suggestedReplies?: string[];
  actions?: { label: string; href: string }[];
  createdAt: Date;
}

const BudjargalMessageSchema = new Schema<IBudjargalMessage>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User" },
    guestKey: { type: String },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, maxlength: 4000 },
    affectionDelta: { type: Number, default: 0 },
    affectionAfter: { type: Number },
    suggestedReplies: { type: [String], default: [] },
    actions: {
      type: [{ label: String, href: String, _id: false }],
      default: [],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

BudjargalMessageSchema.index({ user: 1, createdAt: -1 });
BudjargalMessageSchema.index({ guestKey: 1, createdAt: -1 });

const BudjargalMessage: Model<IBudjargalMessage> =
  mongoose.models.BudjargalMessage ||
  mongoose.model<IBudjargalMessage>("BudjargalMessage", BudjargalMessageSchema);

export default BudjargalMessage;
