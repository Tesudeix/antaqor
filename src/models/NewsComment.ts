import mongoose, { Schema, Document, Model } from "mongoose";

export interface INewsComment extends Document {
  _id: mongoose.Types.ObjectId;
  news: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const NewsCommentSchema = new Schema<INewsComment>(
  {
    news: { type: Schema.Types.ObjectId, ref: "News", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

NewsCommentSchema.index({ news: 1, createdAt: -1 });

const NewsComment: Model<INewsComment> =
  mongoose.models.NewsComment || mongoose.model<INewsComment>("NewsComment", NewsCommentSchema);

export default NewsComment;
