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
  // "agent" → Antaqor Agent бизнес багц (lib/agentBilling.ts гүйцээнэ).
  kind: "membership" | "credits" | "product" | "agent";
  creditAmount: number; // populated when kind === "credits"
  plan: string; // membership payments: plan tier ("starter" | "builder" | "operator")
  wireIntentId: string; // Wire PaymentIntent id when paid via hosted checkout
  periodDays: number; // subscription length granted on approval (30 or 365)
  packageId: string;    // optional id of the credit package, e.g. "popular"
  status: "pending" | "paid" | "failed";
  qrImage: string;
  qrText: string;
  receiptImage: string;
  receiptUploadedAt?: Date;
  claimedAt?: Date;
  adminNote: string;
  paidAt?: Date;
  /** Хэдэн сэргээх сануулга илгээгдсэн (0–3). cron/payment-recovery. */
  remindersSent: number;
  lastReminderAt?: Date;
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
      enum: ["membership", "credits", "product", "agent"],
      default: "membership",
      index: true,
    },
    creditAmount: {
      type: Number,
      default: 0,
    },
    plan: {
      type: String,
      enum: ["", "starter", "builder", "operator"],
      default: "",
      index: true,
    },
    packageId: {
      type: String,
      default: "",
    },
    wireIntentId: {
      type: String,
      default: "",
    },
    periodDays: {
      type: Number,
      default: 30,
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
    /* ─── Сэргээх шат ───────────────────────────────────────────────────
       Хаягдсан нэхэмжлэх рүү илгээсэн сануулгын тоо. Payment дээр байх нь
       санамсаргүй биш: сануулга нь ХЭРЭГЛЭГЧИД биш, тухайн НЭХЭМЖЛЭХЭД
       харьяалагдана — нэг хүн шинэ нэхэмжлэх нээвэл шат нь дахин 0-ээс
       эхлэх ёстой, эс бөгөөс хоёр дахь удаагаа оролдож буй хүн ямар ч
       сануулга авахгүй өнгөрнө. */
    remindersSent: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastReminderAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

PaymentSchema.index({ user: 1, createdAt: -1 });
/* cron/payment-recovery-ийн хайлт: pending + төрөл + нас + шат. */
PaymentSchema.index({ status: 1, kind: 1, remindersSent: 1, createdAt: -1 });
PaymentSchema.index({ invoiceId: 1 });

const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;
