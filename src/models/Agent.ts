import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── Агентын ЗАСВАРЫН давхарга ──────────────────────────────────────────
   Агент бүрийн ӨГӨГДМӨЛ утга нь кодод (`src/lib/empireAgents.ts`) байдаг.
   Энэ коллекц түүнийг ДАРЖ БИЧНЭ — эзэн админаас нэр, зураг, зан чанар,
   системийн prompt, нийтлэх цагийг өөрчилж чадна.

   ЯАГААД ХОЁР ДАВХАРГА ВЭ (бүгдийг DB рүү зөөгөөгүй шалтгаан):
   — Кодын өгөгдмөл нь ХООСОН DB дээр ч ажиллана. Шинэ орчин, шинэ дата-
     бааз дээр агентууд шууд амьд байна; seed скрипт хэрэггүй.
   — Хэрэв админаас алдаатай prompt хадгалбал тэр мөрийг устгахад л
     кодын өгөгдмөл рүү буцна. Сэргээх зам үргэлж нэг алхам.
   — Талбар нэмэхэд DB миграц хэрэггүй: кодод бичээд л болно.

   ДҮРЭМ: DB-д БАЙГАА (хоосон биш) талбар ялна. Хоосон мөр нь "энэ талбарыг
   өөрчлөөгүй" гэсэн үг болохоос "хоосон болго" гэсэн үг БИШ — эс бөгөөс
   админ нэг талбар засахад бусад нь бүгд арчигдана. */

export interface IAgent extends Document {
  _id: mongoose.Types.ObjectId;
  slug: string;

  // ─ Хуучин талбарууд (агентын лавлах картад ашиглагдаж байсан) ─
  name: string;
  description: string;
  avatar: string;
  cover: string;
  href: string;
  order: number;

  // ─ Танилцуулга — админаас засварлана ─
  role: string;
  /* ─ Админаас үүсгэсэн агентад ЗААВАЛ хэрэгтэй талбарууд ─
     Кодын агент эдгээрийг `empireAgents.ts`-ээс авдаг; DB-д л амьдардаг
     агентад тэр эх сурвалж байхгүй тул өөрөө агуулах ёстой. */
  handle: string;
  color: string;
  desc: string;
  age: number | null;
  personality: string;
  mission: string;
  systemPrompt: string;

  /* ─ Ростер ─
     `active` нь тухайн агент сайт дээр ХАРАГДАХ эсэхийг шийднэ. Кодод 20
     агент байгаа ч эзэн 4-ийг л ажиллуулна гэж шийдсэн: үлдсэнийг
     УСТГААГҮЙ, зөвхөн унтраасан — санаа өөрчлөгдвөл нэг товшилт. */
  active: boolean;

  /* ─ Нийтлэх хуваарь ─
     `postHour` нь УЛААНБААТАРЫН цаг (0–23). Сервер UTC-ээр явдаг тул
     харьцуулахдаа хөрвүүлнэ — админ "09" гэж бичээд 17 цагт пост гарвал
     тэр нь алдаа мэт мэдрэгдэнэ. */
  postEnabled: boolean;
  postHour: number;
  lastPostAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    name: { type: String, default: "" },
    description: { type: String, default: "" },
    avatar: { type: String, default: "" },
    cover: { type: String, default: "" },
    href: { type: String, default: "" },
    order: { type: Number, default: 0 },

    role: { type: String, default: "" },
    handle: { type: String, default: "" },
    color: { type: String, default: "#2E29FF" },
    desc: { type: String, default: "" },
    /* `null` = "кодын утгыг ашигла". `0` гэсэн утга бол жинхэнэ 0 нас
       гэсэн үг биш тул тоог өгөгдмөлөөр 0 болгож БОЛОХГҮЙ. */
    age: { type: Number, default: null },
    personality: { type: String, default: "" },
    mission: { type: String, default: "" },
    systemPrompt: { type: String, default: "" },

    active: { type: Boolean, default: false },

    postEnabled: { type: Boolean, default: false },
    postHour: { type: Number, default: 9, min: 0, max: 23 },
    lastPostAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AgentSchema.index({ order: 1 });

const Agent: Model<IAgent> =
  mongoose.models.Agent || mongoose.model<IAgent>("Agent", AgentSchema);

export default Agent;
