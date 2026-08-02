import mongoose, { Schema, Document, Model } from "mongoose";

// Admin-curated quick prompts that appear under the nano-banano textarea.
// Replaces the hardcoded PROMPT_STARTERS array — admins can change the
// inspiration set without a deploy.
export interface ITrendingPrompt extends Document {
  _id: mongoose.Types.ObjectId;
  label: string;   // short chip label (e.g. "Cyber portrait")
  text: string;    // the actual prompt seeded into the textarea
  order: number;
  active: boolean;
  createdAt: Date;
}

const TrendingPromptSchema = new Schema<ITrendingPrompt>(
  {
    label: { type: String, required: true, trim: true, maxlength: 40 },
    text:  { type: String, required: true, trim: true },
    order: { type: Number, default: 0, index: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const TrendingPrompt: Model<ITrendingPrompt> =
  mongoose.models.TrendingPrompt ||
  mongoose.model<ITrendingPrompt>("TrendingPrompt", TrendingPromptSchema);

export default TrendingPrompt;
