import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICompanionMessage extends Document {
  _id: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId;
  guestKey?: string;
  role: "user" | "assistant";
  content: string;
  affectionDelta: number;
  affectionAfter?: number;
  // Suggestions Antaqor offered after THIS message (if role="assistant").
  suggestedReplies?: string[];
  // Page-push action chips (label + internal href).
  actions?: { label: string; href: string }[];
  createdAt: Date;
}

const CompanionMessageSchema = new Schema<ICompanionMessage>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    guestKey: { type: String, index: true },
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

CompanionMessageSchema.index({ user: 1, createdAt: -1 });
CompanionMessageSchema.index({ guestKey: 1, createdAt: -1 });

const CompanionMessage: Model<ICompanionMessage> =
  mongoose.models.CompanionMessage ||
  mongoose.model<ICompanionMessage>("CompanionMessage", CompanionMessageSchema);

export default CompanionMessage;
