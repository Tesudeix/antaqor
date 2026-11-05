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
  /** "" = хэлээгүй. Хуучин 613 бүртгэл бүгд ийм байна. */
  gender: "male" | "female" | "";
  aiExperience: string;
  creativeRole: string;
  interests: string[];
  program: string;
  canUploadReels: boolean;
  avatar: string;
  bio: string;
  /** Профайл (2026-10-11): байршил, вэб хаяг, толгойн зураг, дагаж буй хүмүүс. */
  location: string;
  /** Сүүлд идэвхтэй байсан (PresenceBeat, ~60с). "Онлайн" = сүүлийн 5 мин. */
  lastSeenAt?: Date;
  website: string;
  coverImage: string;
  following: mongoose.Types.ObjectId[];
  instagram: string;
  facebook: string;
  threads: string;
  clan: string;
  clanJoinedAt?: Date;
  subscriptionExpiresAt?: Date;
  // Paid plan tier — active only while subscriptionExpiresAt is in the future
  plan: "free" | "starter" | "builder" | "operator";
  /** Аль мэдэгдлийг хүлээж авах. Талбар байхгүй = зөвшөөрсөн. */
  notificationPrefs?: { newPosts?: boolean; newCourses?: boolean };
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
  googleId?: string;
  facebookId?: string;
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
    /* Хоосон утга нь ХҮЧИНТЭЙ төлөв, дутуу бөглөсөн хэрэг биш: энэ талбар
       нэмэгдэхээс өмнө бүртгүүлсэн хүн бүр ийм байна, мөн API нь хүйсийг
       заавал шаарддаггүй (гуравдагч клиент, апп эвдрэхээс сэргийлж). */
    gender: {
      type: String,
      enum: ["male", "female", ""],
      default: "",
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
    /* Бүртгэлд сонгосон ХӨТӨЛБӨР (`Program.slug`, ж: "ai-creator").
       `creativeRole`-той андуурахгүй: тэр нь XP-ийн үүрэг бөгөөд утга нь
       давхцаж болох ч энэ нь ХУВААРЬТАЙ элсэлт — хүн аль бүлэгт
       сууж байгааг заана. Хоосон = сонгоогүй. */
    program: {
      type: String,
      default: "",
      index: true,
    },
    /* /reels рүү видео оруулах эрх. АДМИН БАЙХ ШААРДЛАГАГҮЙ — эзэн
       өөрийн энгийн бүртгэлээсээ ажиллахыг хүссэн. Админ нь энэ тугаас
       үл хамааран үргэлж оруулж чадна. */
    canUploadReels: {
      type: Boolean,
      default: false,
      index: true,
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
    location: { type: String, default: "", maxlength: 60, trim: true },
    lastSeenAt: { type: Date, index: true },
    website: { type: String, default: "", maxlength: 120, trim: true },
    coverImage: { type: String, default: "" },
    following: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [], index: true },
    /* Гурвуулаа ХЭРЭГЛЭГЧИЙН НЭР хадгална, бүтэн URL биш. Шалтгаан:
       хүн "instagram.com/x", "@x", "https://www.instagram.com/x/?hl=mn"
       гэх мэт олон янзаар бичдэг; хадгалахынхаа өмнө нэг хэлбэрт оруулбал
       харуулах тал нь ганц загвараар холбоос угсарна. */
    instagram: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
    },
    facebook: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
    },
    threads: {
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
    /* ─── Аль мэдэгдлийг хүлээж авах вэ ─────────────────────────────────
       Талбар БАЙХГҮЙ = ЗӨВШӨӨРСӨН. 650 хуучин бүртгэлд энэ талбар
       байхгүй тул анхдагчийг `true` болгох ёстой — `default: false`
       тавибал шинэчлэлт нь бүх хүний мэдэгдлийг чимээгүйхэн унтраана.
       `payment` ба `system` энд ОРООГҮЙ бөгөөд ороход ч болохгүй:
       төлбөр, эрхийн мэдэгдэл нь сурталчилгаа биш. */
    notificationPrefs: {
      newPosts: { type: Boolean, default: true },
      newCourses: { type: Boolean, default: true },
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
    /* ─── Гуравдагч этгээдийн нэвтрэлт (Google / Facebook) ──────────────
       Энэ хоёр нь ХЭРЭГЛЭГЧИЙН ХАНДАХ ХАЯГ биш, ПРОВАЙДЕРЫН ТОГТМОЛ ID.
       Имэйлээр холбох нь хангалтгүй: Google дээр имэйлээ сольсон хүн
       буцаад ирэхэд шинэ бүртгэл болж, XP, пост, захиалга нь алга болно.
       `sparse` — нэвтрэлт холбоогүй хүн бүр энэ талбаргүй тул индекст орохгүй.
       `unique` санаатай ТАВИАГҮЙ: амьд цуглуулга дээр индекс барих эрсдэлээс
       зайлсхийж, давхардлыг src/lib/auth.ts дахь хайлтын дараалал хамгаална. */
    googleId: {
      type: String,
      index: true,
      sparse: true,
    },
    facebookId: {
      type: String,
      index: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
