import mongoose, { Schema, Document, Model } from "mongoose";

// Нэг холбогдсон TikTok акаунт. `ThreadsToken`-ийн бүтцийг зориуд дагасан
// (userId + платформын id + кэшлэсэн нэр + status), ГЭХДЭЭ хоёр ялгаатай:
//
//  1. Токенууд ШИФРЛЭГДСЭН (`src/lib/tokenCrypto.ts`). TikTok-ийн токен нь
//     хэрэглэгчийн нэрээр видео нийтлэх эрхтэй — Threads/Meta-гийн цэвэр
//     текстийн жишгийг энд дагах нь буруу байв.
//  2. `refreshToken` БАЙНА. access 24 цаг, refresh 365 хоног амьдарна.
//
// `status` нь Threads-ийнхтэй ижил гэрээ: refresh бүтэлгүйтвэл
// "reconnect_needed" болж, UI дахин холбогдохыг шаардана.

export type TikTokConnectionStatus = "active" | "reconnect_needed";

export interface ITikTokConnection extends Document {
  userId: string; // next-auth хэрэглэгчийн id — холбосон админ
  openId: string; // TikTok-ийн хэрэглэгчийн тогтмол id
  username: string; // кэш: @handle, зөвхөн шошгонд
  nickname: string; // кэш: дэлгэцийн нэр
  avatarUrl: string; // кэш: TTL 2 цаг тул зөвхөн түр харуулахад
  accessTokenEnc: string;
  refreshTokenEnc: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt?: Date;
  scopes: string[];
  status: TikTokConnectionStatus;
  lastError: string;
  connectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TikTokConnectionSchema = new Schema<ITikTokConnection>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    openId: { type: String, required: true, index: true },
    username: { type: String, default: "" },
    nickname: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    accessTokenEnc: { type: String, required: true },
    refreshTokenEnc: { type: String, default: "" },
    accessTokenExpiresAt: { type: Date, required: true },
    refreshTokenExpiresAt: { type: Date },
    scopes: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["active", "reconnect_needed"],
      default: "active",
      index: true,
    },
    lastError: { type: String, default: "", maxlength: 300 },
    connectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const TikTokConnection: Model<ITikTokConnection> =
  (mongoose.models.TikTokConnection as Model<ITikTokConnection>) ||
  mongoose.model<ITikTokConnection>("TikTokConnection", TikTokConnectionSchema);

export default TikTokConnection;
