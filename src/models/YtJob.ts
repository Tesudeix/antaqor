import mongoose, { Schema, Document, Model, Types } from "mongoose";

/* ─── ТАТАХ АЖЛЫН ДАРААЛАЛ ──────────────────────────────────────────────
   antaqor.com нь ажлыг бүртгэдэг, НЭГ Ч ТАТАЦ СЕРВЕР ДЭЭР ГҮЙХГҮЙ.
   Шалтгаан: droplet-ийн IP (DigitalOcean) YouTube-ийн bot шалгалтад
   блоклогдсон — бүх player_client, бүр PO-token provider ч нөхсөнгүй.
   Түүнээс гадна медиа хаяг нь `ip=` параметрээр уншсан IP-д хүлэгддэг
   тул "мета нь Mac, татац нь сервер" гэсэн хуваарилалт ч боломжгүй
   (хэмжиж тогтоов: droplet-аас 403).

   Тиймээс гүйцэтгэгч нь гэрийн IP-тэй Mac дээрх agent. Энэ бичлэг нь
   хоёрын хоорондох хэлэлцээр юм.

   `probe` = мета + чанарын жагсаалт унших.  `fetch` = бодитоор татах. */

export interface YtQuality {
  height: number;
  fps: number;
  avc: boolean;
  videoBytes: number;
  progressive: boolean;
}

export interface YtInfo {
  id: string;
  title: string;
  uploader: string;
  duration: number;
  thumbnail: string;
  live: boolean;
  qualities: YtQuality[];
  audioBest: number;
  audioCompat: number;
}

export interface IYtJob extends Document {
  /* ЭЗЭН. Agent нь ЗӨВХӨН өөрийн эзний ажлыг авна — үүнгүй бол
     хэрэглэгч А-ын видео хэрэглэгч Б-ийн машин дээр бууж, нэг нь
     нөгөөгийнхөө контентыг, интернэтийг, дискийг авна. Энэ талбар нь
     олон хэрэглэгчтэй болсны ГОЛ хамгаалалт. */
  user: Types.ObjectId;
  kind: "probe" | "fetch";
  url: string;
  height: number;
  /* "mp3" (2026-10-24) — зөвхөн дууг татаж mp3 болгоно; `abr` = kbps. */
  mode: "compat" | "best" | "mp3";
  abr: number;
  /* "server" (2026-10-24) — Antaqor сервер дээр WARP proxy-гоор гүйнэ; "agent" — хэрэглэгчийн машин. */
  runner: "agent" | "server";
  status: "queued" | "working" | "done" | "error";
  pct: number;
  stage: string;
  info?: YtInfo;
  title: string;
  fileName: string;
  fileSize: number;
  /* Mac дээрх зам — зөвхөн админд харуулах мэдээлэл болгон. */
  macPath: string;
  /* Хэрэглэгч сервер дээр ч хуулахыг хүссэн эсэх, хуулагдсан эсэх. */
  wantUpload: boolean;
  stored: boolean;
  /* Хэдэн кредит хассан, буцаасан эсэх. Админ/house хаягт 0 байна. */
  charged: number;
  refunded: boolean;
  error: string;
  by: string;
  claimedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QualitySchema = new Schema<YtQuality>({
  height: Number, fps: Number, avc: Boolean,
  videoBytes: Number, progressive: Boolean,
}, { _id: false });

const YtJobSchema = new Schema<IYtJob>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  kind: { type: String, enum: ["probe", "fetch"], required: true },
  url: { type: String, required: true },
  height: { type: Number, default: 1080 },
  mode: { type: String, enum: ["compat", "best", "mp3"], default: "compat" },
  abr: { type: Number, default: 0 },
  runner: { type: String, enum: ["agent", "server"], default: "agent" },
  status: { type: String, enum: ["queued", "working", "done", "error"], default: "queued", index: true },
  pct: { type: Number, default: 0 },
  stage: { type: String, default: "" },
  info: {
    type: new Schema<YtInfo>({
      id: String, title: String, uploader: String, duration: Number,
      thumbnail: String, live: Boolean,
      qualities: [QualitySchema],
      audioBest: Number, audioCompat: Number,
    }, { _id: false }),
    required: false,
  },
  title: { type: String, default: "" },
  fileName: { type: String, default: "" },
  fileSize: { type: Number, default: 0 },
  macPath: { type: String, default: "" },
  wantUpload: { type: Boolean, default: false },
  stored: { type: Boolean, default: false },
  charged: { type: Number, default: 0 },
  refunded: { type: Boolean, default: false },
  error: { type: String, default: "" },
  by: { type: String, default: "" },
  claimedAt: { type: Date },
}, { timestamps: true });

/* Agent нь "ӨӨРИЙН эзний хамгийн эртний queued"-ыг авна — хоёулаа нэг
   индекст байх нь тэр хайлтыг хямд болгоно. */
YtJobSchema.index({ user: 1, status: 1, createdAt: 1 });
/* Хэрэглэгчийн жагсаалт — шинээс хуучин. */
YtJobSchema.index({ user: 1, createdAt: -1 });

const YtJob: Model<IYtJob> =
  mongoose.models.YtJob || mongoose.model<IYtJob>("YtJob", YtJobSchema);

export default YtJob;
