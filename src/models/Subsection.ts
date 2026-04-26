import mongoose, { Schema, Document, Model } from "mongoose";

// Дэд бүлэг — Section-ы дотор багтах
export interface ISubsection extends Document {
  _id: mongoose.Types.ObjectId;
  section: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId; // duplicated for fast queries by course
  title: string;
  description: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubsectionSchema = new Schema<ISubsection>(
  {
    section: { type: Schema.Types.ObjectId, ref: "Section", required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 1000 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SubsectionSchema.index({ section: 1, order: 1 });

const Subsection: Model<ISubsection> =
  mongoose.models.Subsection || mongoose.model<ISubsection>("Subsection", SubsectionSchema);

export default Subsection;
