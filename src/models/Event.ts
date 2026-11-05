import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEvent extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  image: string;
  type: "event" | "live" | "class" | "deadline" | "workshop" | "challenge" | "mentor";
  date: Date;
  endDate: Date;
  liveLink: string;
  // Live video provider for /live/[id]. The embed iframe is built from these.
  // `liveStreamUrl` is the public viewing URL (YouTube, Twitch, or HLS .m3u8).
  // `liveProvider` is auto-detected if omitted.
  liveStreamUrl: string;
  liveProvider: "youtube" | "twitch" | "hls" | "";
  viewerCount: number;
  location: string;
  status: "upcoming" | "live" | "ended";
  color: string;
  recurring: "none" | "daily" | "weekly" | "monthly";
  /** Давталт хэзээ дуусах вэ. Хоосон = хязгааргүй. */
  recurringUntil?: Date;
  attendees: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    image: {
      type: String,
      default: "",
    },
    date: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    liveLink: {
      type: String,
      default: "",
      trim: true,
    },
    liveStreamUrl: {
      type: String,
      default: "",
      trim: true,
    },
    liveProvider: {
      type: String,
      enum: ["youtube", "twitch", "hls", ""],
      default: "",
    },
    viewerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    type: {
      type: String,
      enum: ["event", "live", "class", "deadline", "workshop", "challenge", "mentor"],
      default: "event",
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["upcoming", "live", "ended"],
      default: "upcoming",
    },
    color: {
      type: String,
      default: "",
    },
    recurring: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly"],
      default: "none",
    },
    /* Давтагдах цувралын төгсгөл. Хоосон бол цуврал хязгааргүй үргэлжилнэ —
       ихэнх хуваарь ийм байдаг ("Мягмар бүр") тул анхдагч нь хоосон. Улирлын
       хөтөлбөр төгсдөг бол энд огноо тавьж болно; уншихдаа /lib/recurrence.ts
       үүнээс ЦААШХИ тохиолдлыг үүсгэхээ болино. */
    recurringUntil: {
      type: Date,
    },
    attendees: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

EventSchema.index({ date: 1 });
EventSchema.index({ status: 1, date: 1 });

const Event: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);

export default Event;
