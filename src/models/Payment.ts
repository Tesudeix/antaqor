import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPayment extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  invoiceId: string;
  senderCode: string;
  amount: number;
  description: string;
  status: "pending" | "paid" | "failed";
  qrImage: string;
  qrText: string;
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
    amount: {
      type: Number,
      required: true,
    },
    description: {
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
