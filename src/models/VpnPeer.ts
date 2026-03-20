import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVpnPeer extends Document {
  userId: mongoose.Types.ObjectId;
  clientIp: string;
  publicKey: string;
  privateKey: string;
  presharedKey: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VpnPeerSchema = new Schema<IVpnPeer>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientIp: {
      type: String,
      required: true,
      unique: true,
    },
    publicKey: {
      type: String,
      required: true,
    },
    privateKey: {
      type: String,
      required: true,
    },
    presharedKey: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: "",
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const VpnPeer: Model<IVpnPeer> =
  mongoose.models.VpnPeer || mongoose.model<IVpnPeer>("VpnPeer", VpnPeerSchema);

export default VpnPeer;
