import mongoose, { Schema, Document, Model } from "mongoose";

// One composer submission → one record, with a per-network result.
// Partial success is the norm (a dead FB token must not hide a good Threads
// post), so results are stored per platform and each can be retried alone.
export interface ISocialResult {
  platform: "facebook" | "instagram" | "threads";
  status: "ok" | "error" | "unknown";
  externalId: string;
  permalink: string;
  error: string;
  ms: number;
  at: Date;
}

export interface ISocialPost extends Document {
  text: string;
  imageUrl: string;
  videoUrl: string;
  brief: string;
  requestKey?: string;
  platforms: string[];
  overrides: Record<string, string>;
  metaAccount: string;
  threadsUserId: string;
  // Threads-only container options. Stored on the row because a scheduled
  // post is published minutes or days later, by a cron that has nothing but
  // this document to work from.
  threads: { linkUrl?: string; replyControl?: string; topicTag?: string };
  results: ISocialResult[];
  // Scheduling. Existing rows have no state and are historical publishes, so
  // the default has to be "published" — anything else would make every past
  // post look like a pending job to the scheduler.
  state: "draft" | "published" | "scheduled" | "publishing" | "failed";
  scheduledAt: Date | null;
  attempts: number;
  lastError: string;
  createdByEmail: string;
  /** Antaqor Agent workspace ("" = эзэн) — түрээслэгчийн постыг эзний жагсаалтаас тусгаарлана */
  ws?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ResultSchema = new Schema<ISocialResult>(
  {
    platform: { type: String, required: true },
    status: { type: String, enum: ["ok", "error", "unknown"], required: true },
    externalId: { type: String, default: "" },
    permalink: { type: String, default: "" },
    error: { type: String, default: "" },
    ms: { type: Number, default: 0 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SocialPostSchema = new Schema<ISocialPost>(
  {
    text: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    videoUrl: { type: String, default: "" },
    brief: { type: String, default: "" },
    requestKey: { type: String },
    platforms: { type: [String], default: [] },
    overrides: { type: Schema.Types.Mixed, default: {} },
    metaAccount: { type: String, default: "" },
    threadsUserId: { type: String, default: "" },
    threads: {
      linkUrl: { type: String, default: "" },
      replyControl: { type: String, default: "" },
      topicTag: { type: String, default: "" },
    },
    results: { type: [ResultSchema], default: [] },
    state: {
      type: String,
      enum: ["draft", "published", "scheduled", "publishing", "failed"],
      default: "published",
      index: true,
    },
    scheduledAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: "" },
    createdByEmail: { type: String, default: "" },
    ws: { type: String, default: "", index: true },
  },
  { timestamps: true }
);

SocialPostSchema.index({ createdAt: -1 });
SocialPostSchema.index({ requestKey: 1 }, { unique: true, sparse: true });
// The scheduler's hot query: due jobs, oldest first.
SocialPostSchema.index({ state: 1, scheduledAt: 1 });

const SocialPost: Model<ISocialPost> =
  (mongoose.models.SocialPost as Model<ISocialPost>) ||
  mongoose.model<ISocialPost>("SocialPost", SocialPostSchema);

export default SocialPost;
