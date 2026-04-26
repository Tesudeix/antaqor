import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPayment extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  invoiceId: string;
  senderCode: string;
  referenceCode: string;
  amount: number;
  description: string;
  // What this payment is for. Defaults to "membership" so legacy rows keep
  // working (clan join). "credits" → award creditAmount on approval.
  kind: "membership" | "credits";
  creditAmount: number; // populated when kind === "credits"
  packageId: string;    // optional id of the credit package, e.g. "popular"
  status: "pending" | "paid" | "failed";
  qrImage: string;
  qrText: string;
  receiptImage: string;
  receiptUploadedAt?: Date;
  claimedAt?: Date;
  adminNote: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    invoiceId: {
      type: String,
      required: true,
      unique: true,
    },
    senderCode: {
      type: String,
      required: true,
    },
    referenceCode: {
      type: String,
      default: "",
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    kind: {
      type: String,
      enum: ["membership", "credits"],
      default: "membership",
      index: true,
    },
    creditAmount: {
      type: Number,
      default: 0,
    },
    packageId: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    qrImage: {
      type: String,
      default: "",
    },
    qrText: {
      type: String,
      default: "",
    },
    receiptImage: {
      type: String,
      default: "",
    },
    receiptUploadedAt: {
      type: Date,
    },
    claimedAt: {
      type: Date,
    },
    adminNote: {
      type: String,
      default: "",
      maxlength: 500,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

PaymentSchema.index({ user: 1, createdAt: -1 });
PaymentSchema.index({ invoiceId: 1 });

const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;
