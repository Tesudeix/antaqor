import mongoose, { Schema, Document, Model } from "mongoose";

// Public-facing client / partner showcase. Renders on the homepage strip and
// is fully admin-editable (logo, name, blurb, link). Admin-only writes via
// /api/clients (POST + per-id PUT/DELETE).
export interface IClient extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  logo: string;          // image URL (uploaded via /api/upload)
  description: string;   // ≤200 chars, optional blurb
  url: string;           // outbound link, optional
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    name:        { type: String, required: true, trim: true, maxlength: 80, index: true },
    logo:        { type: String, default: "", trim: true, maxlength: 500 },
    description: { type: String, default: "", trim: true, maxlength: 200 },
    url:         { type: String, default: "", trim: true, maxlength: 500 },
    order:       { type: Number, default: 0, index: true },
    active:      { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

ClientSchema.index({ active: 1, order: 1 });

const Client: Model<IClient> =
  mongoose.models.Client || mongoose.model<IClient>("Client", ClientSchema);

export default Client;
