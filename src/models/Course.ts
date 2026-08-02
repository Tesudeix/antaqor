import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICourse extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  thumbnail: string;
  coverImage: string;
  order: number;
  lessonsCount: number;
  category: string;
  requiredLevel: number;
  // ─── Conversion-funnel roadmap fields ───
  track: "foundation" | "builder" | "operator";
  requiredPlan: "free" | "starter" | "builder" | "operator";
  outcome: string; // concrete output, e.g. "Reusable prompt система бүтээнэ"
  durationMin: number; // total estimated minutes
  comingSoon: boolean; // listed on the roadmap but lessons not yet published
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    thumbnail: {
      type: String,
      default: "",
    },
    coverImage: {
      type: String,
      default: "",
    },
    order: {
      type: Number,
      default: 0,
    },
    lessonsCount: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
      index: true,
    },
    requiredLevel: {
      type: Number,
      default: 0,
    },
    track: {
      type: String,
      enum: ["foundation", "builder", "operator"],
      default: "foundation",
      index: true,
    },
    requiredPlan: {
      type: String,
      enum: ["free", "starter", "builder", "operator"],
      default: "free",
      index: true,
    },
    outcome: {
      type: String,
      default: "",
      maxlength: 300,
    },
    durationMin: {
      type: Number,
      default: 0,
    },
    comingSoon: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

CourseSchema.index({ order: 1 });

const Course: Model<ICourse> =
  mongoose.models.Course || mongoose.model<ICourse>("Course", CourseSchema);

export default Course;
