import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICompanionMessage extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  // Affection delta caused by this turn (for the user message that prompted
  // the assistant reply, the delta is stored on the assistant message).
  affectionDelta: number;
  affectionAfter?: number;
  createdAt: Date;
}

const CompanionMessageSchema = new Schema<ICompanionMessage>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, maxlength: 4000 },
    affectionDelta: { type: Number, default: 0 },
    affectionAfter: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CompanionMessageSchema.index({ user: 1, createdAt: -1 });

const CompanionMessage: Model<ICompanionMessage> =
  mongoose.models.CompanionMessage ||
  mongoose.model<ICompanionMessage>("CompanionMessage", CompanionMessageSchema);

export default CompanionMessage;
