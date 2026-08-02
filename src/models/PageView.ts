import mongoose, { Schema, Document, Model } from "mongoose";

// One document per calendar day (Asia/Ulaanbaatar, UTC+8). `count` is the
// number of homepage visits recorded that day. Kept deliberately tiny — this
// is a vanity "pulse" metric for the landing stats bar, not analytics.
export interface IPageView extends Document {
  day: string; // YYYY-MM-DD
  count: number;
}

const PageViewSchema = new Schema<IPageView>(
  {
    day: { type: String, required: true, unique: true, index: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const PageView: Model<IPageView> =
  mongoose.models.PageView ||
  mongoose.model<IPageView>("PageView", PageViewSchema);

export default PageView;
