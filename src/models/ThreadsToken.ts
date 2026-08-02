import mongoose, { Schema, Document, Model } from "mongoose";

// One connected Threads account. `status` is the failure contract:
// refresh/auth failures mark the account "reconnect_needed" and the engine
// skips it (its automations are effectively paused) until re-auth.
export type ThreadsAccountStatus = "active" | "reconnect_needed";

export interface IThreadsToken extends Document {
  userId: string; // admin (next-auth) user id that connected this account
  threadsUserId: string;
  username: string; // cached Threads handle for pickers/labels
  accessToken: string;
  tokenType: string;
  expiresAt: Date;
  status: ThreadsAccountStatus;
  backoffUntil?: Date; // engine skips this account until then (429/5xx backoff)
  failCount: number; // consecutive send failures → exponential backoff
  createdAt: Date;
  updatedAt: Date;
}

const ThreadsTokenSchema = new Schema<IThreadsToken>(
  {
    userId: { type: String, required: true, unique: true },
    threadsUserId: { type: String, required: true },
    username: { type: String, default: "" },
    accessToken: { type: String, required: true },
    tokenType: { type: String, default: "bearer" },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ["active", "reconnect_needed"], default: "active" },
    backoffUntil: { type: Date },
    failCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const ThreadsToken: Model<IThreadsToken> =
  mongoose.models.ThreadsToken ||
  mongoose.model<IThreadsToken>("ThreadsToken", ThreadsTokenSchema);

export default ThreadsToken;
