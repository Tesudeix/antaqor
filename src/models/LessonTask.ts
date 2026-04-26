import mongoose, { Schema, Document, Model } from "mongoose";

// Даалгавар — хичээл бүрийн доор (нэг lesson-д нэг task)
export interface ILessonTask extends Document {
  _id: mongoose.Types.ObjectId;
  lesson?: mongoose.Types.ObjectId;      // active — task per lesson
  section?: mongoose.Types.ObjectId;     // legacy — section-level
  subsection?: mongoose.Types.ObjectId;  // legacy — subsection-level
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
    lesson: { type: Schema.Types.ObjectId, ref: "Lesson", index: true },
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
