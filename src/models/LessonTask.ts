import mongoose, { Schema, Document, Model } from "mongoose";

// Даалгавар — дэд бүлгийн төгсгөлд (нэг subsection-д нэг task)
export interface ILessonTask extends Document {
  _id: mongoose.Types.ObjectId;
  subsection: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId; // duplicated for fast course-level queries
  title: string;
  description: string;
  deadline?: Date;
  maxScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const LessonTaskSchema = new Schema<ILessonTask>(
  {
    subsection: { type: Schema.Types.ObjectId, ref: "Subsection", required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 5000 },
    deadline: { type: Date },
    maxScore: { type: Number, default: 10 },
  },
  { timestamps: true }
);

const LessonTask: Model<ILessonTask> =
  mongoose.models.LessonTask || mongoose.model<ILessonTask>("LessonTask", LessonTaskSchema);

export default LessonTask;
