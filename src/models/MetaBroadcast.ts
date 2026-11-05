import mongoose, { Schema, Document, Model, Types } from "mongoose";

// A broadcast = one outbound campaign sent to many conversations at once.
//
// COMPLIANCE (read before changing): Meta only permits us to message a person
// OUTSIDE the 24-hour standard-messaging window with a valid message tag, and
// promotional content is NEVER allowed under any tag. So a broadcast is sent as
// STANDARD (messaging_type RESPONSE) and the engine filters the audience down to
// people whose lastInboundAt is within 24h. People who texted STOP
// (broadcastOptOut) and people messaged in the last 24h (frequency cap) are
// excluded. The "[Реклам]" label is added to promo text (Mongolian Ad Law).

export type BroadcastPlatform = "instagram" | "messenger" | "both";
export type BroadcastContentType = "flow" | "text";
export type BroadcastStatus = "draft" | "sending" | "paused" | "done" | "failed";

export interface IMetaBroadcast extends Document {
  _id: Types.ObjectId;
  name: string;
  account: string;
  platform: BroadcastPlatform;
  contentType: BroadcastContentType;
  flowId?: Types.ObjectId | null; // when contentType==="flow"
  text: string;                   // when contentType==="text"
  imageUrl: string;               // optional image bubble before text
  audience: {
    intentLabels: string[];       // empty = everyone in-window; else filter by intentLabel
  };
  status: BroadcastStatus;
  stats: { targeted: number; accepted: number; failed: number; skipped: number };
  sentTo: string[];               // `${platform}:${partnerId}` dedup keys already delivered
  lastError: string;
  createdByEmail: string;
  /** Heartbeat from the worker. Stale or missing while status is
   *  "sending" means nobody is actually running it — resume it. */
  runningAt?: Date;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MetaBroadcastSchema = new Schema<IMetaBroadcast>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    account: { type: String, default: "antaqor", index: true },
    platform: { type: String, enum: ["instagram", "messenger", "both"], default: "both" },
    contentType: { type: String, enum: ["flow", "text"], default: "text" },
    flowId: { type: Schema.Types.ObjectId, ref: "MetaFlow", default: null },
    text: { type: String, default: "", maxlength: 1000 },
    imageUrl: { type: String, default: "" },
    audience: {
      intentLabels: { type: [String], default: [] },
    },
    status: { type: String, enum: ["draft", "sending", "paused", "done", "failed"], default: "draft", index: true },
    stats: {
      targeted: { type: Number, default: 0 },
      accepted: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
    },
    sentTo: { type: [String], default: [] },
    lastError: { type: String, default: "" },
    createdByEmail: { type: String, default: "" },
    runningAt: { type: Date },
    startedAt: { type: Date },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

const MetaBroadcast: Model<IMetaBroadcast> =
  mongoose.models.MetaBroadcast || mongoose.model<IMetaBroadcast>("MetaBroadcast", MetaBroadcastSchema);

export default MetaBroadcast;
