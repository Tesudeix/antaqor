// ─── 7 хоногийн хөтөлбөр — нэг эх сурвалж ───
// Агуулга энд серверт тодорхойлогдоно; нээгдэх дүрэм зөвхөн серверээс тооцно.
// Release хуваарь: гишүүн болсон өдрийн УБ 18:00-аас Day 1, дараа нь өдөр бүр.

export type DayStatus = "available" | "in_progress" | "completed" | "locked" | "preordered" | "coming_soon";
export type AssignmentStatus = "not_started" | "draft" | "submitted" | "needs_revision" | "approved";

export interface ProgramDayDef {
  day: number;
  title: string;
  description: string;
  durationMin: number;
  xpReward: number;
  image?: string; // сонголтоор — картын cover
  assignment: {
    objective: string;
    instructions: string[];
    deliverable: string;
    checklist: string[];
    example: string;
  };
}

export const PROGRAM_DAYS: ProgramDayDef[] = [
  {
    day: 1,
    title: "ChatGPT",
    description: "Давуу тал, сул тал, ашиглах нөхцөл. Цаг хэмнэх нарийн тохиргоо.",
    durationMin: 25,
    xpReward: 50,
    assignment: {
      objective: "ChatGPT-г өөрийн бодит ажилд туршиж, юунд сайн/муу болохыг өөрөө мэдрэх.",
      instructions: [
        "Өдөр тутмын ажлаасаа 3 даалгавар сонго (имэйл, төлөвлөгөө, судалгаа г.м).",
        "Гурвууланг нь ChatGPT-ээр хийлгэж үз.",
        "Хэр зөв, хэр хурдан байсныг тэмдэглэ.",
      ],
      deliverable: "3 даалгаврын үр дүн + 5 өгүүлбэрт дүгнэлт (текст эсвэл линк).",
      checklist: ["3 даалгавар туршсан", "Үр дүнг хадгалсан", "Дүгнэлт бичсэн"],
      example: "«Имэйл бичихэд 10 мин → 1 мин болов. Судалгаанд эх сурвалж зохиож байсан тул шалгах хэрэгтэй…»",
    },
  },
  {
    day: 2,
    title: "Prompt аргачлал",
    description: "Промт дараалал, агуулга — бүтцийг хэрхэн оновчлох.",
    durationMin: 30,
    xpReward: 60,
    assignment: {
      objective: "Бүтэцтэй prompt бичиж, үр дүнгийн ялгааг харах.",
      instructions: [
        "Өчигдрийн нэг даалгаврын prompt-оо ав.",
        "Үүрэг + Нөхцөл + Хүлээгдэх үр дүн гэсэн 3 хэсэгтэй болгож дахин бич.",
        "Хоёр хувилбарын үр дүнг харьцуул.",
      ],
      deliverable: "Хуучин ба шинэ prompt + үр дүнгийн харьцуулалт.",
      checklist: ["3 хэсэгтэй prompt бичсэн", "Хоёр үр дүнг харьцуулсан"],
      example: "«Чи маркетингийн зөвлөх. Миний бүтээгдэхүүн X. 3 хувилбар гарчиг бич — тус бүр 8 үгэнд багтаа.»",
    },
  },
  {
    day: 3,
    title: "Tools",
    description: "ChatGPT-ийн бүтэц, tools-уудыг хэрхэн ашиглах.",
    durationMin: 25,
    xpReward: 60,
    assignment: {
      objective: "Хэрэгслүүдийг (файл, зураг, хайлт) ажилдаа холбож үзэх.",
      instructions: [
        "Нэг бодит файлаа (Excel, PDF) оруулж дүн шинжилгээ хийлгэ.",
        "Нэг зураг оруулж тайлбарлуулж үз.",
        "Аль хэрэгсэл чиний ажилд хамгийн хэрэгтэйг тэмдэглэ.",
      ],
      deliverable: "Туршилтын скриншот/линк + аль tool яагаад хэрэгтэй тухай 3 өгүүлбэр.",
      checklist: ["Файл шинжилгээ туршсан", "Зураг туршсан", "Дүгнэлт бичсэн"],
      example: "«Борлуулалтын Excel-ээ оруулахад сарын трендийг 30 секундэд гаргалаа…»",
    },
  },
  {
    day: 4,
    title: "Практик — Монгол зах зээл",
    description: "Монгол зах зээлд ашиглаж орлого өсгөх дэс дараалалтай шахсан мэдлэг.",
    durationMin: 35,
    xpReward: 80,
    assignment: {
      objective: "AI-г өөрийн бизнес/ажлын нэг бодит процесст бүрэн нэвтрүүлэх.",
      instructions: [
        "Орлого эсвэл цаг хэмнэх нэг процессоо сонго.",
        "Хичээлд заасан дарааллаар AI-workflow болго.",
        "Долоо хоногийн турш хэрэглэх төлөвлөгөө гарга.",
      ],
      deliverable: "Workflow-ийн тайлбар + хэмнэсэн цаг/өссөн үр дүнгийн тооцоо.",
      checklist: ["Процесс сонгосон", "Workflow бүтээсэн", "Тооцоо хийсэн"],
      example: "«Facebook пост бичих: судалгаа → prompt → 5 хувилбар → засвар. Өдөрт 1 цаг хэмнэнэ.»",
    },
  },
  {
    day: 5,
    title: "Claude — гүнзгий",
    description: "Claude-ийн давуу тал: урт бичвэр, код, дүн шинжилгээ.",
    durationMin: 30,
    xpReward: 70,
    assignment: {
      objective: "Claude-оор урт агуулга/дүн шинжилгээний ажил хийлгэж сурах.",
      instructions: [
        "Нэг урт баримт (гэрээ, тайлан, нийтлэл) өгч дүгнүүл.",
        "ChatGPT-ийн үр дүнтэй харьцуул.",
        "Аль ажилд алийг нь ашиглахаа шийд.",
      ],
      deliverable: "Харьцуулалтын тэмдэглэл — аль tool аль ажилд.",
      checklist: ["Урт баримт туршсан", "Хоёр AI-г харьцуулсан"],
      example: "«30 хуудас тайланг Claude 1 дуудлагад дүгнэв — ChatGPT хэсэгчлэх шаардлагатай байв…»",
    },
  },
  {
    day: 6,
    title: "Grok ба бусад AI",
    description: "Grok, зураг/дуу хоолойн AI — хэрэглээний түвшинд.",
    durationMin: 25,
    xpReward: 60,
    assignment: {
      objective: "Өөрийн AI-хэрэгслийн багцаа эцэслэн тогтоох.",
      instructions: [
        "Grok-оор бодит цагийн мэдээлэлтэй нэг даалгавар хийлгэ.",
        "Нэг зургийн AI-аар ажилдаа хэрэгтэй зураг гаргаж үз.",
        "Өөрийн «AI stack»-аа жагсаа: аль ажилд аль хэрэгсэл.",
      ],
      deliverable: "AI stack жагсаалт (хэрэгсэл → хэрэглээ → давтамж).",
      checklist: ["Grok туршсан", "Зургийн AI туршсан", "Stack жагсаасан"],
      example: "«Мэдээ судлах: Grok · Контент: ChatGPT · Урт баримт: Claude · Зураг: …»",
    },
  },
  {
    day: 7,
    title: "Final Mission — Ship",
    description: "Сурснаа нэгтгэж өөрийн бодит төслөө хийж дуусгана.",
    durationMin: 60,
    xpReward: 150,
    assignment: {
      objective: "7 хоногт сурсан бүхнээ нэг бодит, үзүүлж болох үр дүн болгох.",
      instructions: [
        "Day 4-ийн workflow-оо ашиглаад нэг ДУУССАН зүйл гарга (контент цуврал, автоматжуулалт, бүтээгдэхүүн).",
        "Үр дүнгээ Feed-д нийтэлж community-тэй хуваалц.",
        "Дараагийн 30 хоногийн AI төлөвлөгөөгөө бич.",
      ],
      deliverable: "Ship хийсэн зүйлийн линк/зураг + 30 хоногийн төлөвлөгөө.",
      checklist: ["Бодит үр дүн гаргасан", "Feed-д хуваалцсан", "Төлөвлөгөө бичсэн"],
      example: "«7 хоногт: 12 пост автоматжуулав, 3 цаг/өдөр хэмнэв — дараагийн сар агент угсарна.»",
    },
  },
];

// ─── Хуваарь: UB (UTC+8) цагаар нэгдсэн өдрийн 18:00-аас Day 1 ───
const UB_OFFSET_MS = 8 * 3600 * 1000;

export function day1ReleaseAt(anchor: Date, releaseHour = 18): Date {
  const ub = new Date(anchor.getTime() + UB_OFFSET_MS);
  const atHourUtc =
    Date.UTC(ub.getUTCFullYear(), ub.getUTCMonth(), ub.getUTCDate(), releaseHour, 0, 0) - UB_OFFSET_MS;
  // Тухайн цагаас хойш нэгдсэн бол Day 1 шууд нээлттэй.
  return atHourUtc <= anchor.getTime() ? anchor : new Date(atHourUtc);
}

export function releaseAtFor(anchor: Date, day: number, releaseHour = 18): Date {
  return new Date(day1ReleaseAt(anchor, releaseHour).getTime() + (day - 1) * 86400000);
}

export interface DayProgressLean {
  day: number;
  lessonDoneAt?: Date | string | null;
  assignmentStatus?: AssignmentStatus;
  draftText?: string;
  submittedText?: string;
  submittedUrl?: string;
  submittedAt?: Date | string | null;
  feedback?: string;
}

export interface JourneyDay {
  day: number;
  title: string;
  description: string;
  durationMin: number;
  xpReward: number;
  releaseAt: string;
  status: DayStatus;
  lessonDone: boolean;
  assignmentStatus: AssignmentStatus;
  draftText: string;
  submittedText: string;
  submittedUrl: string;
  feedback: string;
  assignment: ProgramDayDef["assignment"];
}

// Нэг өдөр "дууссан" гэж тооцогдох нөхцөл — хичээл үзсэн + даалгавар илгээсэн/батлагдсан.
export function dayComplete(p: DayProgressLean | undefined): boolean {
  if (!p) return false;
  const st = p.assignmentStatus || "not_started";
  return Boolean(p.lessonDoneAt) && (st === "submitted" || st === "approved");
}

// Серверийн цоры ганц unlock-дүрэм. Client зөвхөн үр дүнг нь харуулна.
export function computeJourney(
  anchor: Date,
  progress: DayProgressLean[],
  isPaid: boolean,
  now: Date,
  releaseHour = 18
): { days: JourneyDay[]; nextUnlockAt: string | null } {
  const byDay = new Map(progress.map((p) => [p.day, p]));
  const unlockTimes: number[] = [];

  const days: JourneyDay[] = PROGRAM_DAYS.map((def) => {
    const p = byDay.get(def.day);
    const releaseAt = releaseAtFor(anchor, def.day, releaseHour);
    const released = now.getTime() >= releaseAt.getTime();
    const prevDone = def.day === 1 || dayComplete(byDay.get(def.day - 1));
    const st = (p?.assignmentStatus || "not_started") as AssignmentStatus;

    let status: DayStatus;
    if (!isPaid) {
      status = "locked";
    } else if (dayComplete(p)) {
      status = "completed";
    } else if (released && prevDone) {
      status = p?.lessonDoneAt || st !== "not_started" ? "in_progress" : "available";
    } else if (!released && prevDone) {
      // Төлбөр хийгдсэн, зөвхөн цаг хүлээж буй — урьдчилан захиалагдсан төлөв.
      status = "preordered";
      unlockTimes.push(releaseAt.getTime());
    } else {
      status = "locked";
      if (!released) unlockTimes.push(releaseAt.getTime());
    }

    return {
      day: def.day,
      title: def.title,
      description: def.description,
      durationMin: def.durationMin,
      xpReward: def.xpReward,
      releaseAt: releaseAt.toISOString(),
      status,
      lessonDone: Boolean(p?.lessonDoneAt),
      assignmentStatus: st,
      draftText: p?.draftText || "",
      submittedText: p?.submittedText || "",
      submittedUrl: p?.submittedUrl || "",
      feedback: p?.feedback || "",
      assignment: def.assignment,
    };
  });

  return {
    days,
    nextUnlockAt: unlockTimes.length ? new Date(Math.min(...unlockTimes)).toISOString() : null,
  };
}
