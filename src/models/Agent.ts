import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAgent extends Document {
  _id: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  description: string;
  avatar: string;
  cover: string;
  href: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    avatar: { type: String, default: "" },
    cover: { type: String, default: "" },
    href: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AgentSchema.index({ order: 1 });

const Agent: Model<IAgent> =
  mongoose.models.Agent || mongoose.model<IAgent>("Agent", AgentSchema);

export default Agent;
