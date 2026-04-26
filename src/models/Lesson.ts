import mongoose, { Schema, Document, Model } from "mongoose";

// PDF/slide хавсралт — Lesson-ы доор олон pdf хадгална
export interface ILessonAttachment {
  url: string;        // /uploads/foo.pdf эсвэл external URL
  name: string;       // user-facing нэр (lecture_notes.pdf)
  size?: number;      // bytes
}

export interface ILesson extends Document {
  _id: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  section?: mongoose.Types.ObjectId;     // active 2-level hierarchy
  subsection?: mongoose.Types.ObjectId;  // legacy — kept for backward compat
  title: string;
  description: string;
  content: string;
  videoUrl: string;
  videoType: "link" | "upload";
  thumbnail: string;
  order: number;
  requiredLevel: number;
  attachments: ILessonAttachment[];
  completedBy: mongoose.Types.ObjectId[];
  likes: mongoose.Types.ObjectId[];
  reactions: Map<string, mongoose.Types.ObjectId[]>;
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const LessonSchema = new Schema<ILesson>(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    section: {
      type: Schema.Types.ObjectId,
      ref: "Section",
      index: true,
    },
    subsection: {
      type: Schema.Types.ObjectId,
      ref: "Subsection",
      index: true,
    },
    attachments: [
      {
        url: { type: String, required: true },
        name: { type: String, required: true },
        size: { type: Number },
        _id: false,
      },
    ],
    title: {
      type: String,
      required: [true, "Lesson title is required"],
      trim: true,
      maxlength: 300,
    },
    description: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    content: {
      type: String,
      default: "",
    },
    videoUrl: {
      type: String,
      default: "",
    },
    videoType: {
      type: String,
      enum: ["link", "upload"],
      default: "link",
    },
    thumbnail: {
      type: String,
      default: "",
    },
    order: {
      type: Number,
      default: 0,
    },
    requiredLevel: {
      type: Number,
      default: 0,
    },
    completedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    commentsCount: {
      type: Number,
      default: 0,
    },
    reactions: {
      type: Map,
      of: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: () => new Map(),
    },
  },
  { timestamps: true }
);

LessonSchema.index({ course: 1, order: 1 });

const Lesson: Model<ILesson> =
  mongoose.models.Lesson || mongoose.model<ILesson>("Lesson", LessonSchema);

export default Lesson;
