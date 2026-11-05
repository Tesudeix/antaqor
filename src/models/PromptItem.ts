import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── НЭГ ЗУРАГ = НЭГ ПРОМПТ ─────────────────────────────────────────────

   `PromptPost` (слайдтай багц) -аас ЯЛГААТАЙ бөгөөд түүнийг ОРЛОХГҮЙ.
   Тэр нь "10 промптын багц" гэсэн сургалтын бүтээгдэхүүн; энэ нь
   гишүүдийн бодитоор ажилласан НЭГ промпт, түүний ГАРГАСАН ҮР ДҮНТЭЙ.

   ЗУРАГ ЗААВАЛ. Шалтгаан нь гоо сайхан биш, ҮНЭН: промптын чанарыг
   зөвхөн үр дүн нь нотолно. Зураггүй промпт бол "энэ сайн ажилладаг"
   гэсэн шалгаагүй мэдэгдэл; зурагтай промпт бол баримт. Тиймээс
   зураггүйг схем түвшинд ЗӨВШӨӨРӨХГҮЙ — UI дээр л шалгавал хэзээ
   нэгэн цагт өөр зам олдоно.

   Ангилал нь ХЭРЭГСЭЛ рүү заана: зураг → Nano Banana, видео → Seedance.
   Тиймээс промпт нь уншиж болох текст биш, ДАРЖ АЖИЛЛУУЛАХ товч болно. */

export type PromptCategory = "зураг" | "видео" | "автоматжуулалт" | "өдөр тутам";

export const PROMPT_CATEGORIES: { id: PromptCategory; label: string; tool: string | null }[] = [
  { id: "зураг", label: "Зураг", tool: "/tools/nano-banano" },
  { id: "видео", label: "Видео", tool: "/tools/video" },
  { id: "автоматжуулалт", label: "Автоматжуулалт", tool: null },
  { id: "өдөр тутам", label: "Өдөр тутам", tool: null },
];

export interface IPromptItem extends Document {
  _id: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  title: string;
  prompt: string;
  image: string;          // ЗААВАЛ — /uploads/*
  category: PromptCategory;
  /* ─── ЗАХ ЗЭЭЛ ────────────────────────────────────────────────────
     `free`  — гишүүн бүр уншина.
     `premium` — кредитээр АВЧ ЭЗЭМШИНЭ. Гишүүнчлэл дуусахад ч эрх үлдэнэ.

     `editions` нь ХОВОРДЛЫН хөшүүрэг: 0 = хязгааргүй, N = зөвхөн N хувь.
     Хязгаарлагдмал цуврал нь промптыг хуулбарлагдах текстээс ЭЗЭМШИГДЭХ
     зүйл болгодог — үнэ цэн нь агуулгаас гадна ХОМСДОЛООС үүснэ. */
  access: "free" | "premium";
  price: number;          // кредит (зөвхөн premium)
  editions: number;       // 0 = хязгааргүй
  sold: number;           // зарагдсан хувь
  earnings: number;       // зохиогчийн хуримтлуулсан кредит
  copies: number;         // хэдэн удаа хуулсан — жинхэнэ эрэлт
  likes: mongoose.Types.ObjectId[];
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PromptItemSchema = new Schema<IPromptItem>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "", trim: true, maxlength: 120 },
    prompt: { type: String, required: true, trim: true, maxlength: 4000 },
    image: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v: string) => typeof v === "string" && v.trim().length > 0,
        message: "Зураг заавал шаардлагатай",
      },
    },
    category: {
      type: String,
      enum: ["зураг", "видео", "автоматжуулалт", "өдөр тутам"],
      default: "зураг",
      index: true,
    },
    access: { type: String, enum: ["free", "premium"], default: "free", index: true },
    price: { type: Number, default: 0, min: 0, max: 100000 },
    editions: { type: Number, default: 0, min: 0, max: 100000 },
    sold: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
    copies: { type: Number, default: 0 },
    likes: { type: [Schema.Types.ObjectId], default: [] },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

PromptItemSchema.index({ createdAt: -1 });
PromptItemSchema.index({ category: 1, createdAt: -1 });

const PromptItem: Model<IPromptItem> =
  mongoose.models.PromptItem || mongoose.model<IPromptItem>("PromptItem", PromptItemSchema);

export default PromptItem;
