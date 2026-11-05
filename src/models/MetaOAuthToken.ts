import mongoose, { Schema, Document, Model } from "mongoose";

// Short-lived holding pen for the long-lived USER token produced by the
// Facebook Login round-trip. The admin then picks which Pages to connect;
// each pick mints a permanent PAGE token into MetaPage and this row becomes
// disposable. Never used on the send path.
export interface IMetaOAuthToken extends Document {
  email: string;
  userToken: string;
  scopes: string[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MetaOAuthTokenSchema = new Schema<IMetaOAuthToken>(
  {
    email: { type: String, required: true, unique: true, index: true },
    userToken: { type: String, required: true },
    scopes: { type: [String], default: [] },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const MetaOAuthToken: Model<IMetaOAuthToken> =
  (mongoose.models.MetaOAuthToken as Model<IMetaOAuthToken>) ||
  mongoose.model<IMetaOAuthToken>("MetaOAuthToken", MetaOAuthTokenSchema);

export default MetaOAuthToken;
