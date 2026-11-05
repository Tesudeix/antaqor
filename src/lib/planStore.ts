import dbConnect from "@/lib/mongodb";
import PlanModel from "@/models/Plan";
import { PLANS, PAID_PLANS, type PlanDef, type PlanId } from "@/lib/plans";

/* ─── Тариф уншигч — код + админы засвар ──────────────────────────────────
   Сайт дээр тарифыг ХААНААС ч шууд `PLANS`-аас уншиж болохгүй боллоо:
   /pricing юу харуулж байгаа, /api/clan/join хэдийг нэхэж байгаа хоёр
   ЗААВАЛ ижил байх ёстой тул хоёулаа энэ функцээр орно.

   Мөрийг олохгүй бол кодын өгөгдмөл нь хүчинтэй — админ юу ч оруулаагүй
   байхад сайт хэвийн ажиллана (сайтын бусад CMS-тэй ижил зан). */

export interface EditablePlan extends PlanDef {
  order: number;
  active: boolean;
}

/** Кодын дараалал — админ `order` оруулаагүй үед үүнийг барина. */
const CODE_ORDER: PlanId[] = PAID_PLANS.map((p) => p.id);

export async function getEditablePlans(): Promise<EditablePlan[]> {
  const base: EditablePlan[] = CODE_ORDER.map((id, i) => ({
    ...PLANS[id],
    order: i,
    active: true,
  }));

  try {
    await dbConnect();
    const rows = await PlanModel.find({ planId: { $in: CODE_ORDER } }).lean();
    const byId = new Map(rows.map((r) => [r.planId, r]));

    for (const plan of base) {
      const o = byId.get(plan.id);
      if (!o) continue;
      // `undefined`-ийг алгасна: админ талбарыг хоосон үлдээсэн бол кодынх
      // хүчинтэй хэвээр. Хоосон мөр бол "устга" гэсэн үг биш.
      if (typeof o.name === "string" && o.name) plan.name = o.name;
      if (typeof o.price === "number") plan.price = o.price;
      if (typeof o.tagline === "string" && o.tagline) plan.tagline = o.tagline;
      if (Array.isArray(o.benefits) && o.benefits.length > 0) plan.benefits = o.benefits;
      if (typeof o.cta === "string" && o.cta) plan.cta = o.cta;
      if (typeof o.highlight === "boolean") plan.highlight = o.highlight;
      if (typeof o.accent === "string" && o.accent) plan.accent = o.accent;
      if (typeof o.order === "number") plan.order = o.order;
      if (typeof o.active === "boolean") plan.active = o.active;
    }
  } catch {
    /* DB унасан ч үнийн хуудас ажиллах ёстой — кодын өгөгдмөлөөр явна. */
  }

  return base.sort((a, b) => a.order - b.order);
}

/** Зарагдаж буй тарифууд — /pricing болон худалдан авалт хоёрын нийтлэг эх. */
export async function getSalePlans(): Promise<EditablePlan[]> {
  return (await getEditablePlans()).filter((p) => p.active && !p.comingSoon);
}

/** Ганц тариф — төлбөр үүсгэхэд. Байхгүй бол null. */
export async function getPlanById(id: PlanId): Promise<EditablePlan | null> {
  const all = await getEditablePlans();
  return all.find((p) => p.id === id) ?? null;
}
