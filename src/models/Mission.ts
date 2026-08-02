import mongoose, { Schema, Document, Model } from "mongoose";
import type { PlanId } from "@/lib/plans";

// ─── Weekly build mission ───
// The execution unit of the community: every week members ship a deliverable.
// requiredPlan gates full instructions + submission; everyone can see the brief.

export interface IMission extends Document {
  _id: mongoose.Types.ObjectId;
  slug: string;
  title: string;
  brief: string; // short public description
  instructions: string; // full instructions (plan-gated)
  deliverable: string; // concrete expected output
  skills: string[]; // e.g. ["Prompting", "AI coding"]
  requiredPlan: PlanId; // "free" = starter mission
  xpReward: number;
  weekOf?: Date; // which week this mission belongs to
  status: "active" | "archived" | "draft";
  order: number;
  submissionsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const MissionSchema = new Schema<IMission>(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    brief: { type: String, default: "", maxlength: 1000 },
    instructions: { type: String, default: "", maxlength: 20000 },
    deliverable: { type: String, default: "", maxlength: 500 },
    skills: { type: [String], default: [] },
    requiredPlan: {
      type: String,
      enum: ["free", "starter", "builder", "operator"],
      default: "builder",
      index: true,
    },
    xpReward: { type: Number, default: 300 },
    weekOf: { type: Date },
    status: { type: String, enum: ["active", "archived", "draft"], default: "active", index: true },
    order: { type: Number, default: 0 },
    submissionsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

MissionSchema.index({ status: 1, order: 1, createdAt: -1 });

const Mission: Model<IMission> =
  mongoose.models.Mission || mongoose.model<IMission>("Mission", MissionSchema);

export default Mission;
