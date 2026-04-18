import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAnnouncement extends Document {
  title: string;
  content: string;
  image?: string;
  tag: "мэдэгдэл" | "шинэчлэл" | "AI" | "эвент" | "бусад";
  pinned: boolean;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    image: { type: String, default: "" },
    tag: {
      type: String,
      enum: ["мэдэгдэл", "шинэчлэл", "AI", "эвент", "бусад"],
      default: "мэдэгдэл",
    },
    pinned: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ published: 1, pinned: -1, createdAt: -1 });

const Announcement: Model<IAnnouncement> =
  mongoose.models.Announcement ||
  mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);

export default Announcement;
