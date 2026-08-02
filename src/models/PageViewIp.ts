import mongoose, { Schema, Document, Model } from "mongoose";

// One row per (day, ip) — the compound unique index is the dedup mechanism:
// a second visit from the same IP on the same day fails the insert with a
// duplicate-key error, so it never bumps the day counter. `ip` is a SHA-256
// hash, never the raw address — we only need equality, not the value.
export interface IPageViewIp extends Document {
  day: string; // YYYY-MM-DD (Asia/Ulaanbaatar)
  ip: string; // sha256(ip + salt)
}

const PageViewIpSchema = new Schema<IPageViewIp>(
  {
    day: { type: String, required: true },
    ip: { type: String, required: true },
  },
  { timestamps: true }
);

PageViewIpSchema.index({ day: 1, ip: 1 }, { unique: true });

const PageViewIp: Model<IPageViewIp> =
  mongoose.models.PageViewIp ||
  mongoose.model<IPageViewIp>("PageViewIp", PageViewIpSchema);

export default PageViewIp;
