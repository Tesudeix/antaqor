import mongoose, { Schema, Document } from "mongoose";

// A connected Meta Page — the SaaS primitive. Added self-service via /admin/pages.
export interface IMetaPage extends Document {
  key: string; // account key used across triggers/welcome/etc (= pageId for dynamic pages)
  pageId: string;
  name: string;
  igBusinessId: string;
  pageType: string;
  pageAccessToken: string;
  enabled: boolean;
  connectedByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const MetaPageSchema = new Schema<IMetaPage>(
  {
    key: { type: String, required: true, unique: true, index: true },
    pageId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "" },
    igBusinessId: { type: String, default: "" },
    pageType: { type: String, default: "other" },
    pageAccessToken: { type: String, default: "" },
    enabled: { type: Boolean, default: true },
    connectedByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

export default (mongoose.models.MetaPage as mongoose.Model<IMetaPage>) ||
  mongoose.model<IMetaPage>("MetaPage", MetaPageSchema);
