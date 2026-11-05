import mongoose, { Schema, Document, Model } from "mongoose";

/* Хүрээлэлд нэгдсэн гишүүн. Нэг хүн нэг хүрээлэлд нэг л удаа. */
export interface ICircleMember extends Document {
  circle: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  createdAt: Date;
}

const CircleMemberSchema = new Schema<ICircleMember>(
  {
    circle: { type: Schema.Types.ObjectId, ref: "Circle", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

/* Давхар нэгдэхээс сэргийлнэ — "нэгдэх" товчийг хоёр удаа дарахад
   хоёр мөр үүсэх нь гишүүдийн тоог худал болгоно. */
CircleMemberSchema.index({ circle: 1, user: 1 }, { unique: true });

export default (mongoose.models.CircleMember as Model<ICircleMember>) ||
  mongoose.model<ICircleMember>("CircleMember", CircleMemberSchema);
