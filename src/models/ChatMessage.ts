import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Гишүүдийн нэгдсэн LIVE room — бүх гишүүн автоматаар "орсон" байдаг,
// WhatsApp маягийн нэг том групп. Join гэж байхгүй: гишүүн л бол бичнэ. ───
export interface IChatMessage extends Document {
  /** Аль өрөө: "free" — нэвтэрсэн хүн бүрт, "premium" — гишүүдэд. */
  room: "free" | "premium";
  userId: mongoose.Types.ObjectId;
  name: string;
  avatar: string;
  text: string;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    /* Өгөгдмөл нь "premium" — ЭНЭ НЬ ЧУХАЛ: өрөө нэмэгдэхээс өмнө бичигдсэн
       бүх мессежийг зөвхөн гишүүн бичих боломжтой байсан тул тэдгээр нь
       гишүүдийн яриа мөн. Өгөгдмөлийг "free" болговол хуучин хаалттай яриа
       бүхэлдээ нээлттэй өрөөнд гэнэт харагдана. */
    room: { type: String, enum: ["free", "premium"], default: "premium", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, default: "" },
    avatar: { type: String, default: "" },
    text: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ChatMessageSchema.index({ room: 1, createdAt: -1 });

const ChatMessage: Model<IChatMessage> =
  mongoose.models.ChatMessage || mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);

export default ChatMessage;
