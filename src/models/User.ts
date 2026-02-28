import mongoose, { Schema, Document, Model } from "mongoose";

export interface IXPHistoryEntry {
  action: string;
  amount: number;
  ref?: string;
  date: Date;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  age: number;
  aiExperience: string;
  interests: string[];
  avatar: string;
  bio: string;
  clan: string;
  clanJoinedAt?: Date;
  subscriptionExpiresAt?: Date;
  resetToken?: string;
  resetTokenExpiry?: Date;
  xp: number;
  level: number;
  xpHistory: IXPHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Нэр шаардлагатай"],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-zA-Z0-9_]+$/, "Хэрэглэгчийн нэр зөвхөн үсэг, тоо, _ агуулна"],
    },
    email: {
      type: String,
      required: [true, "Имэйл шаардлагатай"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Нууц үг шаардлагатай"],
      minlength: 6,
    },
    age: {
      type: Number,
      min: 13,
      max: 120,
    },
    aiExperience: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert", ""],
      default: "",
    },
    interests: {
      type: [String],
      default: [],
    },
    avatar: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
      maxlength: 300,
    },
    clan: {
      type: String,
      default: "",
    },
    clanJoinedAt: {
      type: Date,
    },
    subscriptionExpiresAt: {
      type: Date,
    },
    resetToken: {
      type: String,
    },
    resetTokenExpiry: {
      type: Date,
    },
    xp: {
      type: Number,
      default: 0,
      index: true,
    },
    level: {
      type: Number,
      default: 1,
      index: true,
    },
    xpHistory: [
      {
        action: String,
        amount: Number,
        ref: String,
        date: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
