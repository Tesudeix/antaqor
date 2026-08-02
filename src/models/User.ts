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
  creativeRole: string;
  interests: string[];
  avatar: string;
  bio: string;
  instagram: string;
  clan: string;
  clanJoinedAt?: Date;
  subscriptionExpiresAt?: Date;
  // Paid plan tier — active only while subscriptionExpiresAt is in the future
  plan: "free" | "starter" | "builder" | "operator";
  onboarding?: {
    goal: string; // learn | build | automate
    experience: string; // beginner | intermediate | advanced
    completedAt?: Date;
  };
  resetToken?: string;
  resetTokenExpiry?: Date;
  role: "user" | "admin";
  xp: number;
  level: number;
  xpHistory: IXPHistoryEntry[];
  credits: number;
  creditsLifetime: number;
  referralCode?: string;
  referredBy?: mongoose.Types.ObjectId;
  referralCount: number;
  banned: boolean;
  bannedReason?: string;
  bannedAt?: Date;
  uploadBytesMonth: number;
  uploadMonthResetAt?: Date;
  streakDays: number;
  streakBestDays: number;
  streakLastDate?: Date;
  intro?: {
    name: string;
    age: string;
    status: string;
    why: string;
    nowWorkingOn: string;
    longTermGoal: string;
    giveTake: string;
    media: string;
    refined: string;
    postId?: mongoose.Types.ObjectId;
  };
  introCompletedAt?: Date;
  metaInstagramId?: string;
  metaMessengerPsid?: string;
  metaLinkCode?: string;
  metaLinkCodeExpiresAt?: Date;
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
    creativeRole: {
      type: String,
      enum: ["ai_edgerunner", "ai_engineer", "ai_creator", "ai_entrepreneur", "ai_emperor", ""],
      default: "ai_edgerunner",
      index: true,
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
    instagram: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
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
    plan: {
      type: String,
      enum: ["free", "starter", "builder", "operator"],
      default: "free",
      index: true,
    },
    onboarding: {
      goal: { type: String, default: "" },
      experience: { type: String, default: "" },
      completedAt: { type: Date },
    },
    resetToken: {
      type: String,
    },
    resetTokenExpiry: {
      type: Date,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
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
    credits: {
      type: Number,
      default: 0,
      index: true,
    },
    creditsLifetime: {
      type: Number,
      default: 0,
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    referralCount: {
      type: Number,
      default: 0,
    },
    banned: {
      type: Boolean,
      default: false,
      index: true,
    },
    bannedReason: {
      type: String,
      default: "",
      maxlength: 500,
    },
    bannedAt: {
      type: Date,
    },
    uploadBytesMonth: {
      type: Number,
      default: 0,
    },
    uploadMonthResetAt: {
      type: Date,
    },
    streakDays: {
      type: Number,
      default: 0,
      index: true,
    },
    streakBestDays: {
      type: Number,
      default: 0,
    },
    streakLastDate: {
      type: Date,
    },
    intro: {
      type: new Schema(
        {
          name: { type: String, default: "" },
          age: { type: String, default: "" },
          status: { type: String, default: "" },
          why: { type: String, default: "" },
          nowWorkingOn: { type: String, default: "" },
          longTermGoal: { type: String, default: "" },
          giveTake: { type: String, default: "" },
          media: { type: String, default: "" },
          refined: { type: String, default: "" },
          postId: { type: Schema.Types.ObjectId, ref: "Post" },
        },
        { _id: false }
      ),
      default: undefined,
    },
    introCompletedAt: {
      type: Date,
    },
    metaInstagramId: {
      type: String,
      index: { unique: true, sparse: true },
    },
    metaMessengerPsid: {
      type: String,
      index: { unique: true, sparse: true },
    },
    metaLinkCode: {
      type: String,
      index: { sparse: true },
    },
    metaLinkCodeExpiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
