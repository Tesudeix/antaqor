import mongoose, { Schema, Document, Model } from "mongoose";

// Бүлэг — курсийн дотор багтах дээд түвшний категори
export interface ISection extends Document {
  _id: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  title: string;
  description: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const SectionSchema = new Schema<ISection>(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 1000 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SectionSchema.index({ course: 1, order: 1 });

const Section: Model<ISection> =
  mongoose.models.Section || mongoose.model<ISection>("Section", SectionSchema);

export default Section;
