import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Comment-Order Bot — нэгдсэн автоматжуулалтын гол нэгж ───
// "Пост дээр түлхүүр үг comment хийвэл → авто DM → захиалга авах" гэдэг
// НЭГ ойлгомжтой загвар. /admin/automation-аас удирдана.

export interface IBotProduct {
  name: string;
  price: number; // ₮ — 0 бол үнэ харуулахгүй
}

export interface IBotButton {
  label: string;
  url: string;
}

export interface ICommentBot extends Document {
  name: string;
  account: string; // antaqor / joymassage / joybilliard
  platform: "instagram" | "messenger" | "both";
  postId: string; // "" = бүх пост
  keywords: string[];
  matchWholeWord: boolean; // false = агуулсан бол (default)
  commentReply: string; // нийтэд харагдах comment хариу ({{username}})
  dmText: string; // DM #1
  dmImage: string;
  dmButtons: IBotButton[];
  collectOrders: boolean;
  products: IBotProduct[];
  enabled: boolean;
  stats: { triggered: number; dmSent: number; orders: number };
  lastError: string;
  createdByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommentBotSchema = new Schema<ICommentBot>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    account: { type: String, default: "antaqor" },
    platform: { type: String, enum: ["instagram", "messenger", "both"], default: "instagram" },
    postId: { type: String, default: "", trim: true },
    keywords: { type: [String], default: [] },
    matchWholeWord: { type: Boolean, default: false },
    commentReply: { type: String, default: "", maxlength: 300 },
    dmText: { type: String, required: true, maxlength: 900 },
    dmImage: { type: String, default: "", maxlength: 500 },
    dmButtons: {
      type: [
        new Schema({ label: { type: String, required: true, maxlength: 20 }, url: { type: String, required: true, maxlength: 500 } }, { _id: false }),
      ],
      default: [],
    },
    collectOrders: { type: Boolean, default: false },
    products: {
      type: [
        new Schema({ name: { type: String, required: true, maxlength: 60 }, price: { type: Number, default: 0 } }, { _id: false }),
      ],
      default: [],
    },
    enabled: { type: Boolean, default: true },
    stats: {
      triggered: { type: Number, default: 0 },
      dmSent: { type: Number, default: 0 },
      orders: { type: Number, default: 0 },
    },
    lastError: { type: String, default: "" },
    createdByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

CommentBotSchema.index({ enabled: 1, account: 1 });

const CommentBot: Model<ICommentBot> =
  mongoose.models.CommentBot || mongoose.model<ICommentBot>("CommentBot", CommentBotSchema);

export default CommentBot;
