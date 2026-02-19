import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPost extends Document {
  _id: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  content: string;
  image: string;
  likes: mongoose.Types.ObjectId[];
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    image: {
      type: String,
      default: "",
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    commentsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

PostSchema.index({ createdAt: -1 });
PostSchema.index({ author: 1 });

const Post: Model<IPost> =
  mongoose.models.Post || mongoose.model<IPost>("Post", PostSchema);

export default Post;
