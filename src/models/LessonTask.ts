import mongoose, { Schema, Document, Model } from "mongoose";

// Даалгавар — section-ы төгсгөлд (нэг section-д нэг task)
export interface ILessonTask extends Document {
  _id: mongoose.Types.ObjectId;
  section?: mongoose.Types.ObjectId;     // active 2-level hierarchy
  subsection?: mongoose.Types.ObjectId;  // legacy
  course: mongoose.Types.ObjectId;
  title: string;
  description: string;
  attachments: { url: string; name: string; size?: number }[];
  deadline?: Date;
  maxScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const LessonTaskSchema = new Schema<ILessonTask>(
  {
    section: { type: Schema.Types.ObjectId, ref: "Section", index: true },
    subsection: { type: Schema.Types.ObjectId, ref: "Subsection", index: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 5000 },
    attachments: [{ url: String, name: String, size: Number, _id: false }],
    deadline: { type: Date },
    maxScore: { type: Number, default: 10 },
  },
  { timestamps: true }
);

const LessonTask: Model<ILessonTask> =
  mongoose.models.LessonTask || mongoose.model<ILessonTask>("LessonTask", LessonTaskSchema);

export default LessonTask;
