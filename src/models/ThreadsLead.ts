import mongoose, { Schema, Document, Model } from "mongoose";

// Internal CRM: engagers captured by "log_lead" actions. Exportable as CSV
// from the admin — external sheet sync would need extra credentials (TODO).
export interface IThreadsLead extends Document {
  _id: mongoose.Types.ObjectId;
  accountId: string; // threadsUserId
  username: string;
  label: string; // tag from the automation (e.g. "lead", "vip")
  sourcePostId: string;
  commentText: string;
  triggerId?: mongoose.Types.ObjectId;
  triggerName: string;
  createdAt: Date;
  updatedAt: Date;
}

const ThreadsLeadSchema = new Schema<IThreadsLead>(
  {
    accountId: { type: String, default: "" },
    username: { type: String, required: true },
    label: { type: String, default: "lead" },
    sourcePostId: { type: String, default: "" },
    commentText: { type: String, default: "" },
    triggerId: { type: Schema.Types.ObjectId, ref: "ThreadsTrigger" },
    triggerName: { type: String, default: "" },
  },
  { timestamps: true }
);

ThreadsLeadSchema.index({ createdAt: -1 });
ThreadsLeadSchema.index({ username: 1, label: 1 });

const ThreadsLead: Model<IThreadsLead> =
  mongoose.models.ThreadsLead ||
  mongoose.model<IThreadsLead>("ThreadsLead", ThreadsLeadSchema);

export default ThreadsLead;
