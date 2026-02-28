import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITask extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  xpReward: number;
  assignedTo?: mongoose.Types.ObjectId;
  status: "open" | "submitted" | "accepted" | "rejected";
  submissionNote: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: {
      type: String,
      required: [true, "Даалгаврын нэр шаардлагатай"],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    xpReward: {
      type: Number,
      required: true,
      min: 200,
      max: 5000,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["open", "submitted", "accepted", "rejected"],
      default: "open",
    },
    submissionNote: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

TaskSchema.index({ status: 1, createdAt: -1 });
TaskSchema.index({ assignedTo: 1 });

const Task: Model<ITask> =
  mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema);

export default Task;
