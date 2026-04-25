import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPost extends Document {
  _id: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  authorLevel: number;
  content: string;
  image: string;
  visibility: "free" | "members";
  category: "мэдээлэл" | "ялалт" | "промт" | "бүтээл" | "танилцуулга";
  taskId?: mongoose.Types.ObjectId;
  likes: mongoose.Types.ObjectId[];
  reactions: Map<string, mongoose.Types.ObjectId[]>;
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
    authorLevel: {
      type: Number,
      default: 1,
      min: 1,
      index: true,
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
    visibility: {
      type: String,
      enum: ["free", "members"],
      default: "members",
    },
    category: {
      type: String,
      enum: ["мэдээлэл", "ялалт", "промт", "бүтээл", "танилцуулга"],
      default: "мэдээлэл",
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    reactions: {
      type: Map,
      of: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: () => new Map(),
    },
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
PostSchema.index({ visibility: 1, createdAt: -1 });
PostSchema.index({ category: 1, createdAt: -1 });
PostSchema.index({ visibility: 1, authorLevel: 1, createdAt: -1 });

const Post: Model<IPost> =
  mongoose.models.Post || mongoose.model<IPost>("Post", PostSchema);

export default Post;
