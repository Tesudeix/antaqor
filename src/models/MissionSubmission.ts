import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Mission deliverable submission ───
// One per (mission, user); resubmit = update. Feedback comes from admins/experts.

export interface IMissionSubmission extends Document {
  _id: mongoose.Types.ObjectId;
  mission: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  link: string; // URL to the shipped thing
  note: string; // what was built / how
  attachments: { url: string; name: string }[];
  status: "submitted" | "reviewed";
  feedback: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MissionSubmissionSchema = new Schema<IMissionSubmission>(
  {
    mission: { type: Schema.Types.ObjectId, ref: "Mission", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    link: { type: String, default: "", maxlength: 500 },
    note: { type: String, default: "", maxlength: 5000 },
    attachments: [{ url: String, name: String, _id: false }],
    status: { type: String, enum: ["submitted", "reviewed"], default: "submitted" },
    feedback: { type: String, default: "", maxlength: 3000 },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

MissionSubmissionSchema.index({ mission: 1, user: 1 }, { unique: true });

const MissionSubmission: Model<IMissionSubmission> =
  mongoose.models.MissionSubmission ||
  mongoose.model<IMissionSubmission>("MissionSubmission", MissionSubmissionSchema);

export default MissionSubmission;
