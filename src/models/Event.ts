import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEvent extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  image: string;
  type: "event" | "live" | "class" | "deadline" | "workshop";
  date: Date;
  endDate: Date;
  liveLink: string;
  location: string;
  status: "upcoming" | "live" | "ended";
  color: string;
  recurring: "none" | "daily" | "weekly" | "monthly";
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
    type: {
      type: String,
      enum: ["event", "live", "class", "deadline", "workshop"],
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
