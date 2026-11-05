// Seed the conversion-funnel roadmap: course tracks + missions.
// Idempotent — matches by title/slug, updates in place, never duplicates.
// Run on the droplet: node scripts/seed-funnel.mjs
import mongoose from "mongoose";

const MONGO = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/antaqor";

const courseSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const missionSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const Course = mongoose.models.Course || mongoose.model("Course", courseSchema, "courses");
const Mission = mongoose.models.Mission || mongoose.model("Mission", missionSchema, "missions");

// ─── Course roadmap (spec section 6) ───
const COURSES = [
  // FOUNDATION
  { title: "AI-ийн суурь ойлголт", track: "foundation", requiredPlan: "free", order: 0,
    description: "AI гэж юу вэ, яаж ажилладаг, өдөр тутамдаа хэрхэн ашиглах — эхлэх цэг.",
    outcome: "Өөрийн эхний AI workflow-г тохируулна", durationMin: 45 },
  { title: "ChatGPT анхан шат", track: "foundation", requiredPlan: "starter", order: 1,
    description: "ChatGPT-г ажил, суралцалт, контентод бодитоор ашиглах суурь.",
    outcome: "Өдөр тутмын 5 ажлаа ChatGPT-ээр хийдэг болно", durationMin: 60, comingSoon: true },
  { title: "Claude анхан шат", track: "foundation", requiredPlan: "starter", order: 2,
    description: "Claude-ийн давуу тал: урт документ, код, бүтэцтэй сэтгэлгээ.",
    outcome: "Claude дээр ажлын туслах системээ тохируулна", durationMin: 60, comingSoon: true },
  { title: "Prompt engineering", track: "foundation", requiredPlan: "starter", order: 3,
    description: "Дахин ашиглагдах prompt систем бүтээх арга зүй.",
    outcome: "Reusable prompt система бүтээнэ", durationMin: 90, comingSoon: true },
  // BUILDER
  { title: "AI контент систем", track: "builder", requiredPlan: "builder", order: 10,
    description: "Нэг хүнтэй контент үйлдвэр: төлөвлөлт → үйлдвэрлэл → тараалт.",
    outcome: "Долоо хоногийн контент engine бүтээнэ", durationMin: 120, comingSoon: true },
  { title: "AI coding", track: "builder", requiredPlan: "builder", order: 11,
    description: "Код бичиж үзээгүй ч AI-аар ажиллах бүтээгдэхүүн гаргах нь.",
    outcome: "Ажилладаг web app deploy хийнэ", durationMin: 150, comingSoon: true },
  { title: "Website building with AI", track: "builder", requiredPlan: "builder", order: 12,
    description: "Landing page-ээс бүрэн сайт хүртэл — AI-тай хамт.",
    outcome: "Landing page бүтээж нийтэлнэ", durationMin: 90, comingSoon: true },
  { title: "Social automation", track: "builder", requiredPlan: "builder", order: 13,
    description: "Сошиал хариулт, lead цуглуулалтыг автоматжуулах.",
    outcome: "Lead цуглуулалтыг автоматжуулна", durationMin: 90, comingSoon: true },
  { title: "Workflow automation", track: "builder", requiredPlan: "builder", order: 14,
    description: "Давтагдах ажлуудаа автомат урсгал болгох.",
    outcome: "3 давтагдах ажлаа автоматжуулна", durationMin: 90, comingSoon: true },
  // OPERATOR
  { title: "Agentic AI", track: "operator", requiredPlan: "operator", order: 20,
    description: "Бие даан ажилладаг AI agent-ууд бүтээх.",
    outcome: "Ажилладаг AI assistant бүтээнэ", durationMin: 180, comingSoon: true },
  { title: "AI business systems", track: "operator", requiredPlan: "operator", order: 21,
    description: "Бизнесийн үйл ажиллагааг AI системээр зохион байгуулах.",
    outcome: "Бизнесийн 1 үйл явцыг бүрэн систем болгоно", durationMin: 180, comingSoon: true },
  { title: "AI product development", track: "operator", requiredPlan: "operator", order: 22,
    description: "AI бүтээгдэхүүн санаанаас зах зээл хүртэл.",
    outcome: "MVP бүтээж хэрэглэгчид хүргэнэ", durationMin: 240, comingSoon: true },
  { title: "AI revenue systems", track: "operator", requiredPlan: "operator", order: 23,
    description: "AI ур чадвараа орлого болгох системүүд.",
    outcome: "Эхний орлогын urshgal-аа зохион байгуулна", durationMin: 180, comingSoon: true },
  { title: "Advanced automation architecture", track: "operator", requiredPlan: "operator", order: 24,
    description: "Олон систем холбосон automation архитектур.",
    outcome: "Multi-step automation систем бүтээнэ", durationMin: 240, comingSoon: true },
];

const MISSIONS = [
  {
    slug: "starter-prompt-system",
    title: "Анхны AI prompt системээ бүтээ",
    brief: "Өөрийн ажлын нэг даалгаварт зориулж дахин ашиглагдах prompt бүтээж, үр дүнг нь community-д хуваалц.",
    instructions: [
      "1. Долоо хоногт дор хаяж 2 удаа хийдэг нэг ажлаа сонго (имэйл бичих, контент төлөвлөх, судалгаа...).",
      "2. AI-ийн суурь ойлголт курсын 1-р хичээлийг үз.",
      "3. Тухайн ажлыг AI-аар хийлгэх prompt бичээд 3 удаа сайжруул.",
      "4. Эцсийн prompt + гарсан үр дүнгээ хуулж илгээ.",
    ].join("\n"),
    deliverable: "Ажилладаг, дахин ашиглагдах 1 prompt + бодит үр дүн",
    skills: ["Prompting"],
    requiredPlan: "free",
    xpReward: 300,
    status: "active",
    order: 0,
  },
  {
    slug: "ai-landing-page",
    title: "Өөрийн AI Landing Page бүтээ",
    brief: "AI ашиглан өөрийн санаа/бизнесдээ зориулсан responsive landing page бүтээж нийтэл.",
    instructions: [
      "1. Нэг санаа сонго: өөрийн үйлчилгээ, бүтээгдэхүүн эсвэл хувийн брэнд.",
      "2. Offer-оо нэг өгүүлбэрээр тодорхойл (хэнд, юу, ямар үр дүн).",
      "3. AI coding хэрэглэн landing page-ээ бүтээ (headline, CTA, 3 benefit).",
      "4. Хостлоод (Vercel/Netlify) ажиллаж буй линкээ илгээ.",
    ].join("\n"),
    deliverable: "Working responsive landing page (live URL)",
    skills: ["Prompting", "AI coding", "Offer design"],
    requiredPlan: "builder",
    xpReward: 800,
    weekOf: new Date(),
    status: "active",
    order: 1,
  },
];

async function main() {
  await mongoose.connect(MONGO);

  for (const c of COURSES) {
    const res = await Course.updateOne(
      { title: c.title },
      { $set: c },
      { upsert: true }
    );
    console.log("course:", c.title, res.upsertedCount ? "created" : "updated");
  }

  // The pre-existing "AI анхан шат" course (has the 2 real lessons) becomes
  // part of the free foundation track so free users land on real content.
  const legacy = await Course.updateOne(
    { title: "AI анхан шат" },
    { $set: { track: "foundation", requiredPlan: "free", order: 0,
      outcome: "AI-тай ажиллах эхний алхмуудаа хийнэ", durationMin: 30, comingSoon: false } }
  );
  console.log("legacy course:", legacy.matchedCount ? "updated" : "not found");

  // "AI-ийн суурь ойлголт" upsert above may duplicate the legacy course's role;
  // if the legacy course exists, mark the seeded free course comingSoon=false only
  // when it has lessons of its own (it won't at first) — keep it hidden instead.
  const legacyDoc = await Course.findOne({ title: "AI анхан шат" }).lean();
  if (legacyDoc) {
    await Course.updateOne(
      { title: "AI-ийн суурь ойлголт" },
      { $set: { comingSoon: true, order: 1 } }
    );
    console.log("free starter course = AI анхан шат (legacy, has lessons)");
  }

  for (const m of MISSIONS) {
    const res = await Mission.updateOne(
      { slug: m.slug },
      { $set: m },
      { upsert: true }
    );
    console.log("mission:", m.slug, res.upsertedCount ? "created" : "updated");
  }

  await mongoose.disconnect();
  console.log("seed done");
}

main().catch((e) => { console.error(e); process.exit(1); });
