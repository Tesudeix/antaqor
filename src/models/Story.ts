import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStory extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  image: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StorySchema = new Schema<IStory>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
    image: {
      type: String,
      default: "",
    },
    published: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

StorySchema.index({ createdAt: -1 });
StorySchema.index({ published: 1, createdAt: -1 });

const Story: Model<IStory> =
  mongoose.models.Story || mongoose.model<IStory>("Story", StorySchema);

export default Story;
