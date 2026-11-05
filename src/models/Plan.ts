import mongoose, { Schema, Model } from "mongoose";

/* ─── Тарифын ЗАСВАР ──────────────────────────────────────────────────────
   Энэ коллекц нь тарифыг ОРЛОХГҮЙ, харин кодон дахь `src/lib/plans.ts`-ийн
   дээр тавигдах засвар л хадгална.

   Яагаад ингэсэн бэ (шинэ тариф үүсгэдэг CRUD БИШ):
   · `planId` нь эрхийн шалгалт бүрийн түлхүүр. `PLAN_RANK`, `hasPlanAccess`,
     курсын `requiredPlan`, төлсөн хэрэглэгчийн `user.plan` — бүгд эдгээр
     мөрийг заана. Админ шинэ id зохиовол `PLAN_RANK[newId]` нь undefined
     болж, тухайн багц авсан хүн бүх хаалганаас гадуур үлдэнэ.
   · Тиймээс админ ХАРАГДАХ ТАЛЫГ (нэр, үнэ, тайлбар, эрхийн жагсаалт,
     товчны бичиг, онцлох эсэх, дараалал, зарагдах эсэх) засна. Ямар id
     байх нь код дээр тогтоно.

   Үнэ нь ХАРАГДАХ утга биш — `/api/clan/join` мөн ЭНДЭЭС уншина. Хоёр
   тийш нь салгавал хүн нэг дүн хараад өөр дүн шилжүүлнэ. */

export interface IPlanOverride {
  planId: string;
  name?: string;
  price?: number;
  tagline?: string;
  benefits?: string[];
  cta?: string;
  highlight?: boolean;
  accent?: string;
  order?: number;
  /** Худалдаанаас түр хасах — id нь үлдэнэ, зүгээр л /pricing дээр гарахгүй. */
  active?: boolean;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlanOverride>(
  {
    planId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, trim: true, maxlength: 40 },
    // MNT. Сөрөг үнэ утгагүй; 0 нь үнэгүй гэсэн үг тул зөвшөөрөгдөнө.
    price: { type: Number, min: 0 },
    tagline: { type: String, trim: true, maxlength: 200 },
    benefits: { type: [String], default: undefined },
    cta: { type: String, trim: true, maxlength: 60 },
    highlight: { type: Boolean },
    accent: { type: String, trim: true, maxlength: 20 },
    order: { type: Number },
    active: { type: Boolean },
  },
  { timestamps: true }
);

PlanSchema.index({ order: 1 });

const Plan: Model<IPlanOverride> =
  (mongoose.models.Plan as Model<IPlanOverride>) ||
  mongoose.model<IPlanOverride>("Plan", PlanSchema);

export default Plan;
