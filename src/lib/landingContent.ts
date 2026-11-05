// ─── Нүүр + Курс хуудасны контентын төрөл ба эх хувилбар ───
// Mongoose-гүй тусдаа модуль: client компонентууд default-уудыг импортлохдоо
// сервер талын драйверыг browser bundle руу чирэхгүй.

export interface CourseLesson {
  t: string; // хичээлийн нэр
  m: number; // минут
}

export interface CourseDayContent {
  day: number;
  title: string;
  mission: string;
  lessons: CourseLesson[];
}

export interface CommunityFeature {
  title: string;
  desc: string;
  chip: string;
  live: boolean; // true → signal өнгө, false → static
}

/** Засварлагдах талбарууд — mongoose схем ба API хоёулаа үүнийг барина. */
export interface LandingContentFields {
  // ── Нүүр хуудас ──
  homeEyebrow: string;
  homeTitle: string;
  homeSub: string;
  homeCtaLabel: string;
  homeCtaHref: string;
  homeCta2Label: string;
  homeCta2Href: string;
  homeImage: string;
  /** Админ слайд оруулаагүй үед үндсэн слайдын загвар. */
  homeHeroLayout: string;
  /** Элсэлт хаагдах мөч. Хоосон = тоолуур харагдахгүй. */
  enrollDeadline: string;
  /** Нүүрийн их биед харуулах хэсгүүд, эрэмбэлсэн түлхүүрүүд. */
  homeSections: string[];
  /** Нүүрийн манифест — үүсгэн байгуулагчийн үг. Хоосон бол харагдахгүй. */
  homeManifesto: string;

  programHeading: string;
  programMeta: string;

  communityHeading: string;
  communityMeta: string;
  features: CommunityFeature[];

  planHeading: string;
  planMeta: string;

  payoffTitle: string;
  payoffSub: string;
  payoffCtaLabel: string;
  payoffCtaHref: string;

  // ── Курс хуудас ──
  courseCode: string;
  courseTitle: string;
  courseSub: string;
  courseLevel: string;
  curriculumHeading: string;
  enrollBullets: string[];
  outcomes: string[];
  courseDays: CourseDayContent[];

  operatorName: string;
  operatorBio: string;
  operatorPhoto: string;
  operatorLocation: string;

  courseCtaTitle: string;

  // ── Хуваалцсан HUD дэлгэрэнгүй ──
  coords: string;
}

// Кодон дахь эх хувилбар — "Antaqor Home / Course" макетаас шууд.
// Mongo хоосон эсвэл унтарсан үед хуудсууд яг үүнийг харуулна.
export const LANDING_DEFAULTS: LandingContentFields = {
  // Нүүрний анхны мессеж нь юу хийхийг биш, ХААНА ирснийг хэлнэ.
  // "Бодит зүйл бүтээ" бол уриа — сайт юу болохыг тайлбарлаагүй.
  homeEyebrow: "ANTAQOR · AI ХҮРЭЭЛЭЛ",
  homeTitle: "Claude сурах AI хүрээлэл.",
  homeSub:
    "Хамтдаа Claude болон AI хэрэгслүүдийг сурч, өдөр тутмынхаа ажилд хэрэглэж эхэлдэг монгол хүмүүсийн хүрээлэл. Асуу, хуваалц, бүтээ.",
  homeCtaLabel: "Хүрээлэлд нэгдэх",
  homeCtaHref: "/auth/signup",
  homeCta2Label: "Юу сурах вэ",
  homeCta2Href: "/classroom",
  homeImage: "",
  homeHeroLayout: "split",
  enrollDeadline: "",
  homeSections: [],
  homeManifesto: "",

  programHeading: "7 хоногийн хөтөлбөр",
  programMeta: "7 ХОНОГ · ӨДӨР БҮР НЭГ MISSION",

  communityHeading: "Community систем",
  communityMeta: "ГАНЦААРАА БИШ",
  features: [
    {
      title: "Mission систем",
      desc: "Өдөр бүр нэг даалгавар. Хийсэн бүхэн XP болж хуримтлагдана.",
      chip: "LIVE",
      live: true,
    },
    {
      title: "Prompt сан",
      desc: "Бэлэн prompt багцууд — хуулж, өөрийн ажилдаа шууд ашигла.",
      chip: "LIVE",
      live: true,
    },
    {
      title: "Feedback loop",
      desc: "Төслөө community-д илгээж, операторын шүүмж ав.",
      chip: "SYNC",
      live: false,
    },
  ],

  planHeading: "Нэг plan — Runner",
  planMeta: "НЭГ ҮНЭ · ДАЛД ТӨЛБӨРГҮЙ",

  payoffTitle: "ЭХЛЭХЭД БЭЛЭН ҮҮ?",
  payoffSub:
    "Бүртгүүл. Төлбөр төлөгдмөгц эрх чинь автоматаар идэвхжиж, Day 1 өнөөдөр 18:00-д нээгдэнэ.",
  payoffCtaLabel: "Бүртгүүл",
  payoffCtaHref: "/auth/signup?plan=starter",

  courseCode: "TSD-CRS-047",
  courseTitle: "АНХАН ШАТНЫ AI СУРГАЛТ",
  courseSub:
    "7 хоног. Өдөрт нэг хичээл, нэг mission. ChatGPT, Claude, Grok — суурийг нь эхнээс нь тавьж, сүүлийн өдөр өөрийн бодит төслөө ship хийнэ.",
  courseLevel: "АНХАН ШАТ",
  curriculumHeading: "Хичээлийн хөтөлбөр",
  enrollBullets: [
    "7 хоногийн бүх хичээл, mission",
    "Prompt сангийн бүх багц",
    "Community + feedback эрх",
    "Төгсөлтийн сертификат",
  ],
  outcomes: [
    "ChatGPT, Claude, Grok-ийг зөв газарт нь сонгож ашиглана",
    "Өөрийн ажлын prompt санг бүрдүүлсэн байна",
    "Өдөр тутмын нэг ажлаа AI-аар автоматжуулсан байна",
    "Нэг бодит төслөө эхнээс нь дуустал ship хийсэн байна",
  ],
  courseDays: [
    {
      day: 1,
      title: "ChatGPT",
      mission: "Өөрийн ажилд зориулсан эхний custom instruction бичиж хадгал.",
      lessons: [
        { t: "Тохиргоо, дансны сонголт", m: 8 },
        { t: "Давуу ба сул тал — хаана ашиглах", m: 9 },
        { t: "Цаг хэмнэх custom instruction", m: 8 },
      ],
    },
    {
      day: 2,
      title: "Prompt аргачлал",
      mission: "Нэг ажлын prompt-оо 3 удаа сайжруулж, өмнөх/дараах үр дүнг харьцуул.",
      lessons: [
        { t: "Prompt-ын бүтэц: роль, контекст, формат", m: 10 },
        { t: "Дараалал ба задаргаа", m: 10 },
        { t: "Iterate хийх арга", m: 10 },
      ],
    },
    {
      day: 3,
      title: "Tools",
      mission: "Файл + web хайлт хослуулсан нэг бодит даалгавар гүйцэтгэ.",
      lessons: [
        { t: "Web хайлт, файл боловсруулалт", m: 9 },
        { t: "Vision — зурагтай ажиллах", m: 8 },
        { t: "Voice ба бусад tools", m: 8 },
      ],
    },
    {
      day: 4,
      title: "Практик — Монгол зах зээл",
      mission: "Өөрийн бизнес/ажилд тохирсон нэг орлогын workflow зохио.",
      lessons: [
        { t: "Монгол кейсүүд — юу ажилладаг", m: 12 },
        { t: "Орлого өсгөх workflow", m: 12 },
        { t: "Борлуулалтын текст, контент", m: 11 },
      ],
    },
    {
      day: 5,
      title: "Claude — гүнзгий",
      mission: "Урт баримт бичгээ Claude-оор дүн шинжилгээ хийлгэж дүгнэлт гарга.",
      lessons: [
        { t: "Урт бичвэр, баримттай ажиллах", m: 10 },
        { t: "Код ба автоматжуулалт", m: 10 },
        { t: "ChatGPT vs Claude — хэзээ алийг", m: 10 },
      ],
    },
    {
      day: 6,
      title: "Grok ба бусад AI",
      mission: "Зургийн AI-аар брэндийнхээ нэг постер хийж community-д тавь.",
      lessons: [
        { t: "Grok — бодит цагийн мэдээлэл", m: 8 },
        { t: "Зургийн AI хэрэглээ", m: 9 },
        { t: "Дуу хоолой, видео AI тойм", m: 8 },
      ],
    },
    {
      day: 7,
      title: "Final Mission — Ship",
      mission: "Сурснаа нэгтгэж өөрийн бодит төслөө хийж, community-д ship хий.",
      lessons: [
        { t: "Төслөө сонгох, төлөвлөх", m: 15 },
        { t: "Build — операторын дэмжлэгтэй", m: 30 },
        { t: "Ship + feedback", m: 15 },
      ],
    },
  ],

  operatorName: "Оператор",
  operatorBio:
    "Улаанбаатараас шууд дамжуулна. AI хэрэгслүүдийг өдөр тутмын ажилдаа ашигладаг практик оператор — онол биш, ажилладаг workflow заана.",
  operatorPhoto: "",
  operatorLocation: "ULAANBAATAR",

  courseCtaTitle: "DAY 1 ӨНӨӨДӨР.",

  coords: "47.92°N 106.92°E",
};
