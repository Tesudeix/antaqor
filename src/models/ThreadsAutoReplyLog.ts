import mongoose, { Schema, Document, Model } from "mongoose";

// One row per inbound EVENT we've SEEN (comment reply or like-delta).
// `replyId` is the idempotency key — for likes it's `like:<postId>:<count>`.
// `seeded` = event existed before automation/lookback window, marked seen but NOT answered.
export type ThreadsLogStatus = "sent" | "skipped" | "seeded" | "error";
export type ThreadsEventType = "comment" | "like";

export interface IThreadsAutoReplyLog extends Document {
  _id: mongoose.Types.ObjectId;
  replyId: string; // unique — idempotency key
  eventType: ThreadsEventType;
  accountId: string; // threadsUserId the event belongs to
  postId: string; // our thread the event is on
  username: string; // who replied ("" for likes — API does not expose likers)
  replyText: string;
  status: ThreadsLogStatus;
  triggerId?: mongoose.Types.ObjectId;
  triggerName?: string;
  actionTaken?: string; // reply | log_lead | reply_and_log
  sentText?: string;
  /* AI яагаад илгээсэн эсвэл алгассанаа энд бичнэ — алдаа БИШ тул
     `error`-оос тусдаа: эрүүл алгаслыг алдаа мэт харуулах нь буруу. */
  note?: string;
  error?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ThreadsAutoReplyLogSchema = new Schema<IThreadsAutoReplyLog>(
  {
    replyId: { type: String, required: true, unique: true },
    eventType: { type: String, enum: ["comment", "like"], default: "comment" },
    accountId: { type: String, default: "" },
    postId: { type: String, default: "" },
    username: { type: String, default: "" },
    replyText: { type: String, default: "" },
    status: {
      type: String,
      enum: ["sent", "skipped", "seeded", "error"],
      required: true,
    },
    triggerId: { type: Schema.Types.ObjectId, ref: "ThreadsTrigger" },
    triggerName: { type: String, default: "" },
    actionTaken: { type: String, default: "" },
    sentText: { type: String, default: "" },
    /* AI яагаад илгээсэн/алгассанаа энд бичнэ — алдаа биш тул `error`-оос
       тусдаа байх ёстой, эс тэгвээс эрүүл skip нь алдаа мэт харагдана. */
    note: { type: String, default: "" },
    error: { type: String, default: "" },
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ThreadsAutoReplyLogSchema.index({ createdAt: -1 });
ThreadsAutoReplyLogSchema.index({ status: 1, createdAt: -1 });
ThreadsAutoReplyLogSchema.index({ username: 1 }); // first-time-engager lookups

const ThreadsAutoReplyLog: Model<IThreadsAutoReplyLog> =
  mongoose.models.ThreadsAutoReplyLog ||
  mongoose.model<IThreadsAutoReplyLog>("ThreadsAutoReplyLog", ThreadsAutoReplyLogSchema);

export default ThreadsAutoReplyLog;
