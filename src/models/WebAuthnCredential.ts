import mongoose, { Schema, Document, Model } from "mongoose";

// One row per registered authenticator (Face ID / Touch ID / Windows Hello /
// security key). A user may have many — phone passkey + laptop passkey +
// hardware key + iCloud-synced passkey.
export interface IWebAuthnCredential extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  credentialID: string;     // base64url
  publicKey: string;        // base64url, COSE-encoded
  counter: number;          // signature counter, used for clone detection
  transports: string[];     // ["internal", "hybrid", "usb", ...] — hint for the browser
  deviceLabel: string;      // human-readable, set at enrollment time
  createdAt: Date;
  lastUsedAt: Date;
}

const WebAuthnCredentialSchema = new Schema<IWebAuthnCredential>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    credentialID: { type: String, required: true, unique: true, index: true },
    publicKey: { type: String, required: true },
    counter: { type: Number, default: 0 },
    transports: { type: [String], default: [] },
    deviceLabel: { type: String, default: "Энэ төхөөрөмж" },
    lastUsedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const WebAuthnCredential: Model<IWebAuthnCredential> =
  mongoose.models.WebAuthnCredential ||
  mongoose.model<IWebAuthnCredential>("WebAuthnCredential", WebAuthnCredentialSchema);

export default WebAuthnCredential;
