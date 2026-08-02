import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPost extends Document {
  _id: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  authorLevel: number;
  content: string;
  // `image` kept for back-compat with old posts. New posts should populate
  // `images[]`. Display code reads `images.length ? images : [image]`.
  image: string;
  images: string[];
  // Optional short-form video (≤20s). Single video per post — the carousel
  // pattern only fits one without forcing a player-juggle UX.
  video?: string;
  videoDurationSec?: number;
  visibility: "free" | "members";
  category: string;
  // When set, the feed renders this post as the named empire agent
  // (avatar/name/badge sourced from src/lib/empireAgents.ts) instead of
  // the underlying admin user. Stays empty for normal user posts.
  agentSlug?: string;
  // Original AI prompt used to generate the attached image.
  // Visible only to paid Edgerunners members — the API strips this field
  // from responses for non-members. Lets us monetise prompt access while
  // keeping the visual public.
  aiPrompt?: string;
  taskId?: mongoose.Types.ObjectId;
  likes: mongoose.Types.ObjectId[];
  reactions: Map<string, mongoose.Types.ObjectId[]>;
  commentsCount: number;
  viewsCount: number;
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
      maxlength: 50000,
    },
    image: {
      type: String,
      default: "",
    },
    images: {
      type: [{ type: String }],
      default: [],
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length <= 10,
        message: "Maximum 10 images per post",
      },
    },
    video: {
      type: String,
      default: "",
      trim: true,
    },
    videoDurationSec: {
      type: Number,
      default: 0,
      min: 0,
      max: 30, // hard cap above the UX 20s limit (gives buffer for tiny encode drift)
    },
    visibility: {
      type: String,
      enum: ["free", "members"],
      default: "members",
    },
    category: {
      type: String,
      // No enum — categories are now dynamic. Validity is enforced by the
      // API against the `Category` collection so admins can add new ones.
      trim: true,
      default: "пост",
      maxlength: 50,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
    },
    agentSlug: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 30,
      index: true,
    },
    aiPrompt: {
      type: String,
      trim: true,
      maxlength: 50000,
      default: "",
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
    viewsCount: { type: Number, default: 0 },
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
