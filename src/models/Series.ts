import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Богино драмын ЦУВРАЛ — 60 орчим ангитай, анги нь 2 минут.
 *
 * Яагаад `Course`-ыг дахин ашиглаагүй вэ: курс нь ТӨЛБӨРТ ТӨЛӨВӨӨР
 * (`requiredPlan`) хаагддаг бөгөөд сурах зорилготой дараалалтай. Драм нь
 * АНГИ ТУС БҮРЭЭР зоосоор нээгддэг, сурах шатлалгүй, эрэмбэ нь зөвхөн
 * дугаар. Хоёрыг нэг модел дээр суулгавал аль алиных нь дүрэм нөгөөгийнхөө
 * талбарыг утгагүй болгоно.
 */
export interface ISeries extends Document {
  title: string;
  slug: string;
  synopsis: string;
  genres: string[];
  year: number;
  /** Босоо постер — browse тор дээр. */
  poster: string;
  /** Хэвтээ кадр — цувралын толгой, "үргэлжлүүлэх" хэсэг. */
  still: string;
  /** ЭНЭ дугаараас доош анги ҮНЭГҮЙ. Дээшээ нь түгжээтэй.
      Ангид түгжээг тус тусад нь бичихгүй байх шалтгаан: редактор 60 мөр
      тэмдэглэхийн оронд нэг тоо солино, дүрэм нь нэг газарт үлдэнэ. */
  freeEpisodes: number;
  /** Долоо хоногийн эрх — цувралын БҮХ түгжээтэй ангийг нээнэ. */
  passPriceCoins: number;
  passDays: number;
  published: boolean;
  /** "TOP THIS WEEK" эрэмбэ. 0 = эрэмбэлээгүй. */
  featuredRank: number;
  /** Ангийн тоог тоолохгүйгээр харуулахын тулд хадгална. */
  episodeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const SeriesSchema = new Schema<ISeries>(
  {
    title: { type: String, required: [true, "Цувралын нэр шаардлагатай"], trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
    synopsis: { type: String, default: "", trim: true },
    genres: { type: [String], default: [] },
    year: { type: Number, default: () => new Date().getFullYear() },
    poster: { type: String, default: "" },
    still: { type: String, default: "" },
    freeEpisodes: { type: Number, default: 14, min: 0 },
    passPriceCoins: { type: Number, default: 400, min: 0 },
    passDays: { type: Number, default: 7, min: 1 },
    published: { type: Boolean, default: false, index: true },
    featuredRank: { type: Number, default: 0, index: true },
    episodeCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* Browse дээрх "шинэ эхэлсэн" болон "top" хоёр өөр эрэмбэ тул хоёуланг нь
   индекслэв — цуврал олдох тусам шүүлт нь бүтэн коллекц уншихгүй. */
SeriesSchema.index({ published: 1, featuredRank: -1 });
SeriesSchema.index({ published: 1, createdAt: -1 });

const Series: Model<ISeries> =
  (mongoose.models.Series as Model<ISeries>) ||
  mongoose.model<ISeries>("Series", SeriesSchema);

export default Series;
