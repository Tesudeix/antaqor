import mongoose, { Schema, Document, Model } from "mongoose";

// ─── 7 хоногийн хөтөлбөрийн хэрэглэгч бүрийн явц + даалгаврын илгээлт ───
export interface IProgramDayProgress {
  day: number;
  lessonDoneAt?: Date | null;
  assignmentStatus: "not_started" | "draft" | "submitted" | "needs_revision" | "approved";
  draftText: string;
  submittedText: string;
  submittedUrl: string;
  submittedAt?: Date | null;
  feedback: string;
  lessonXpAwarded: boolean;
  assignXpAwarded: boolean;
}

export interface IProgramProgress extends Document {
  userId: mongoose.Types.ObjectId;
  days: IProgramDayProgress[];
  createdAt: Date;
  updatedAt: Date;
}

const DaySchema = new Schema<IProgramDayProgress>(
  {
    day: { type: Number, required: true, min: 1, max: 7 },
    lessonDoneAt: { type: Date, default: null },
    assignmentStatus: {
      type: String,
      enum: ["not_started", "draft", "submitted", "needs_revision", "approved"],
      default: "not_started",
    },
    draftText: { type: String, default: "", maxlength: 5000 },
    submittedText: { type: String, default: "", maxlength: 5000 },
    submittedUrl: { type: String, default: "", maxlength: 600 },
    submittedAt: { type: Date, default: null },
    feedback: { type: String, default: "", maxlength: 2000 },
    lessonXpAwarded: { type: Boolean, default: false },
    assignXpAwarded: { type: Boolean, default: false },
  },
  { _id: false }
);

const ProgramProgressSchema = new Schema<IProgramProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    days: { type: [DaySchema], default: [] },
  },
  { timestamps: true }
);

const ProgramProgress: Model<IProgramProgress> =
  mongoose.models.ProgramProgress ||
  mongoose.model<IProgramProgress>("ProgramProgress", ProgramProgressSchema);

export default ProgramProgress;
