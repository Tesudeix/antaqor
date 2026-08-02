import mongoose, { Schema, Document, Model } from "mongoose";

export interface IReferral extends Document {
  _id: mongoose.Types.ObjectId;
  referrer: mongoose.Types.ObjectId;
  referee: mongoose.Types.ObjectId;
  code: string;
  signupAt: Date;
  firstPaymentAt?: Date;
  awarded: {
    signup: boolean;
    firstPayment: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    referrer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    referee: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    code: { type: String, required: true, index: true },
    signupAt: { type: Date, default: () => new Date() },
    firstPaymentAt: { type: Date },
    awarded: {
      signup: { type: Boolean, default: false },
      firstPayment: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

ReferralSchema.index({ referrer: 1, createdAt: -1 });

const Referral: Model<IReferral> =
  mongoose.models.Referral || mongoose.model<IReferral>("Referral", ReferralSchema);

export default Referral;
