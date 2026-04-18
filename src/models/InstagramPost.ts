import mongoose, { Schema, Document, Model } from "mongoose";

export interface IInstagramPost extends Document {
  igId: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL";
  mediaUrl: string;
  thumbnailUrl?: string;
  permalink: string;
  caption?: string;
  timestamp: Date;
  fetchedAt: Date;
}

const InstagramPostSchema = new Schema<IInstagramPost>(
  {
    igId: { type: String, required: true, unique: true },
    mediaType: { type: String, required: true },
    mediaUrl: { type: String, required: true },
    thumbnailUrl: { type: String },
    permalink: { type: String, required: true },
    caption: { type: String },
    timestamp: { type: Date, required: true },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

InstagramPostSchema.index({ timestamp: -1 });

const InstagramPost: Model<IInstagramPost> =
  mongoose.models.InstagramPost ||
  mongoose.model<IInstagramPost>("InstagramPost", InstagramPostSchema);

export default InstagramPost;
