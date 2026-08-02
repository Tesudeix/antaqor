import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Гишүүдийн нэгдсэн LIVE room — бүх гишүүн автоматаар "орсон" байдаг,
// WhatsApp маягийн нэг том групп. Join гэж байхгүй: гишүүн л бол бичнэ. ───
export interface IChatMessage extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  avatar: string;
  text: string;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, default: "" },
    avatar: { type: String, default: "" },
    text: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ChatMessageSchema.index({ createdAt: -1 });

const ChatMessage: Model<IChatMessage> =
  mongoose.models.ChatMessage || mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);

export default ChatMessage;
