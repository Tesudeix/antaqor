import mongoose, { Schema, Document, Model } from "mongoose";

// Last-seen like count per post — the Threads API has no like webhook and does
// not expose WHO liked, so `new_like` events are detected as count deltas.
export interface IThreadsPostState extends Document {
  accountId: string; // threadsUserId
  postId: string;
  likes: number;
  postText: string; // cached snippet for hashtag scoping + log display
  lastCheckedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ThreadsPostStateSchema = new Schema<IThreadsPostState>(
  {
    accountId: { type: String, required: true },
    postId: { type: String, required: true },
    likes: { type: Number, default: 0 },
    postText: { type: String, default: "" },
    lastCheckedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ThreadsPostStateSchema.index({ accountId: 1, postId: 1 }, { unique: true });

const ThreadsPostState: Model<IThreadsPostState> =
  mongoose.models.ThreadsPostState ||
  mongoose.model<IThreadsPostState>("ThreadsPostState", ThreadsPostStateSchema);

export default ThreadsPostState;
