import mongoose, { Schema, Document, Model } from "mongoose";

// Оюутны даалгаврын хариу + дүгнэлт
export interface ITaskSubmission extends Document {
  _id: mongoose.Types.ObjectId;
  task: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  answerText: string;
  attachments: { url: string; name: string }[];
  score?: number;
  feedback: string;
  state: "submitted" | "graded";
  submittedAt: Date;
  gradedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSubmissionSchema = new Schema<ITaskSubmission>(
  {
    task: { type: Schema.Types.ObjectId, ref: "LessonTask", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    answerText: { type: String, default: "", maxlength: 10000 },
    attachments: [{ url: String, name: String, _id: false }],
    score: { type: Number },
    feedback: { type: String, default: "", maxlength: 2000 },
    state: { type: String, enum: ["submitted", "graded"], default: "submitted" },
    submittedAt: { type: Date, default: Date.now },
    gradedAt: { type: Date },
  },
  { timestamps: true }
);

// One submission per (task, student) — students re-submit by updating
TaskSubmissionSchema.index({ task: 1, student: 1 }, { unique: true });

const TaskSubmission: Model<ITaskSubmission> =
  mongoose.models.TaskSubmission || mongoose.model<ITaskSubmission>("TaskSubmission", TaskSubmissionSchema);

export default TaskSubmission;
