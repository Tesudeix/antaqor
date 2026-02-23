import mongoose, { Schema, Document, Model } from "mongoose";

export interface IThreadsToken extends Document {
  userId: string;
  threadsUserId: string;
  accessToken: string;
  tokenType: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ThreadsTokenSchema = new Schema<IThreadsToken>(
  {
    userId: { type: String, required: true, unique: true },
    threadsUserId: { type: String, required: true },
    accessToken: { type: String, required: true },
    tokenType: { type: String, default: "bearer" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const ThreadsToken: Model<IThreadsToken> =
  mongoose.models.ThreadsToken ||
  mongoose.model<IThreadsToken>("ThreadsToken", ThreadsTokenSchema);

export default ThreadsToken;
