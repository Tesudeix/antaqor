import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Ботоор цугласан захиалга + идэвхтэй захиалгын session ───

export type OrderStatus = "new" | "confirmed" | "paid" | "delivered";

export interface ICommentOrder extends Document {
  botId: mongoose.Types.ObjectId;
  account: string;
  platform: "instagram" | "messenger";
  partnerId: string;
  username: string;
  conversationId: mongoose.Types.ObjectId | null;
  product: string;
  qty: number;
  phone: string;
  phoneUnverified: boolean;
  address: string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

const CommentOrderSchema = new Schema<ICommentOrder>(
  {
    botId: { type: Schema.Types.ObjectId, ref: "CommentBot", required: true },
    account: { type: String, default: "antaqor" },
    platform: { type: String, enum: ["instagram", "messenger"], required: true },
    partnerId: { type: String, required: true },
    username: { type: String, default: "" },
    conversationId: { type: Schema.Types.ObjectId, ref: "MetaConversation", default: null },
    product: { type: String, default: "" },
    qty: { type: Number, default: 1 },
    phone: { type: String, default: "" },
    phoneUnverified: { type: Boolean, default: false },
    address: { type: String, default: "", maxlength: 500 },
    status: { type: String, enum: ["new", "confirmed", "paid", "delivered"], default: "new" },
  },
  { timestamps: true }
);

CommentOrderSchema.index({ status: 1, createdAt: -1 });

export const CommentOrder: Model<ICommentOrder> =
  mongoose.models.CommentOrder || mongoose.model<ICommentOrder>("CommentOrder", CommentOrderSchema);

// ── Dedupe: нэг хэрэглэгч нэг пост дээр нэг ботоос НЭГ л удаа хариу авна ──
export interface ICommentBotHit extends Document {
  botId: mongoose.Types.ObjectId;
  postId: string;
  igUserId: string;
  createdAt: Date;
}

const CommentBotHitSchema = new Schema<ICommentBotHit>(
  {
    botId: { type: Schema.Types.ObjectId, ref: "CommentBot", required: true },
    postId: { type: String, default: "" },
    igUserId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
CommentBotHitSchema.index({ botId: 1, postId: 1, igUserId: 1 }, { unique: true });

export const CommentBotHit: Model<ICommentBotHit> =
  mongoose.models.CommentBotHit || mongoose.model<ICommentBotHit>("CommentBotHit", CommentBotHitSchema);

// ── Идэвхтэй захиалгын session — харилцан яриа аль алхам дээр байгаа ──
export type OrderStep = "product" | "qty" | "phone" | "address" | "confirm";

export interface IOrderSession extends Document {
  conversationId: mongoose.Types.ObjectId;
  botId: mongoose.Types.ObjectId;
  account: string;
  platform: "instagram" | "messenger";
  partnerId: string;
  username: string;
  step: OrderStep;
  product: string;
  qty: number;
  phone: string;
  phoneUnverified: boolean;
  phoneAttempts: number;
  address: string;
  updatedAt: Date;
  createdAt: Date;
}

const OrderSessionSchema = new Schema<IOrderSession>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "MetaConversation", required: true, unique: true },
    botId: { type: Schema.Types.ObjectId, ref: "CommentBot", required: true },
    account: { type: String, default: "antaqor" },
    platform: { type: String, enum: ["instagram", "messenger"], required: true },
    partnerId: { type: String, required: true },
    username: { type: String, default: "" },
    step: { type: String, enum: ["product", "qty", "phone", "address", "confirm"], default: "product" },
    product: { type: String, default: "" },
    qty: { type: Number, default: 1 },
    phone: { type: String, default: "" },
    phoneUnverified: { type: Boolean, default: false },
    phoneAttempts: { type: Number, default: 0 },
    address: { type: String, default: "" },
  },
  { timestamps: true }
);

export const OrderSession: Model<IOrderSession> =
  mongoose.models.OrderSession || mongoose.model<IOrderSession>("OrderSession", OrderSessionSchema);
