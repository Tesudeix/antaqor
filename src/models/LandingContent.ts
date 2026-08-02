import mongoose, { Schema } from "mongoose";
import {
  LANDING_DEFAULTS,
  type CommunityFeature,
  type CourseDayContent,
  type CourseLesson,
  type LandingContentFields,
} from "@/lib/landingContent";

// ─── Нүүр + Курс хуудасны засварлагдах контент — нэг singleton баримт ───
// Талбарын жагсаалт ба default-ууд lib/landingContent.ts дээр (client талд ч
// хэрэглэгддэг тул mongoose-гүй); энд зөвхөн хадгалалтын схем.

export interface ILandingContent extends LandingContentFields {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LessonSchema = new Schema<CourseLesson>(
  { t: { type: String, default: "", maxlength: 120 }, m: { type: Number, default: 10 } },
  { _id: false }
);

const CourseDaySchema = new Schema<CourseDayContent>(
  {
    day: { type: Number, required: true },
    title: { type: String, default: "", maxlength: 120 },
    mission: { type: String, default: "", maxlength: 400 },
    lessons: { type: [LessonSchema], default: [] },
  },
  { _id: false }
);

const FeatureSchema = new Schema<CommunityFeature>(
  {
    title: { type: String, default: "", maxlength: 80 },
    desc: { type: String, default: "", maxlength: 240 },
    chip: { type: String, default: "LIVE", maxlength: 24 },
    live: { type: Boolean, default: true },
  },
  { _id: false }
);

const LandingContentSchema = new Schema<ILandingContent>(
  {
    homeEyebrow: { type: String, default: LANDING_DEFAULTS.homeEyebrow, maxlength: 120 },
    homeTitle: { type: String, default: LANDING_DEFAULTS.homeTitle, maxlength: 120 },
    homeSub: { type: String, default: LANDING_DEFAULTS.homeSub, maxlength: 400 },
    homeCtaLabel: { type: String, default: LANDING_DEFAULTS.homeCtaLabel, maxlength: 40 },
    homeCtaHref: { type: String, default: LANDING_DEFAULTS.homeCtaHref, maxlength: 200 },
    homeCta2Label: { type: String, default: LANDING_DEFAULTS.homeCta2Label, maxlength: 40 },
    homeCta2Href: { type: String, default: LANDING_DEFAULTS.homeCta2Href, maxlength: 200 },
    homeImage: { type: String, default: "", maxlength: 500 },

    programHeading: { type: String, default: LANDING_DEFAULTS.programHeading, maxlength: 120 },
    programMeta: { type: String, default: LANDING_DEFAULTS.programMeta, maxlength: 120 },

    communityHeading: { type: String, default: LANDING_DEFAULTS.communityHeading, maxlength: 120 },
    communityMeta: { type: String, default: LANDING_DEFAULTS.communityMeta, maxlength: 120 },
    features: { type: [FeatureSchema], default: LANDING_DEFAULTS.features },

    planHeading: { type: String, default: LANDING_DEFAULTS.planHeading, maxlength: 120 },
    planMeta: { type: String, default: LANDING_DEFAULTS.planMeta, maxlength: 120 },

    payoffTitle: { type: String, default: LANDING_DEFAULTS.payoffTitle, maxlength: 120 },
    payoffSub: { type: String, default: LANDING_DEFAULTS.payoffSub, maxlength: 400 },
    payoffCtaLabel: { type: String, default: LANDING_DEFAULTS.payoffCtaLabel, maxlength: 40 },
    payoffCtaHref: { type: String, default: LANDING_DEFAULTS.payoffCtaHref, maxlength: 200 },

    courseCode: { type: String, default: LANDING_DEFAULTS.courseCode, maxlength: 40 },
    courseTitle: { type: String, default: LANDING_DEFAULTS.courseTitle, maxlength: 120 },
    courseSub: { type: String, default: LANDING_DEFAULTS.courseSub, maxlength: 400 },
    courseLevel: { type: String, default: LANDING_DEFAULTS.courseLevel, maxlength: 40 },
    curriculumHeading: { type: String, default: LANDING_DEFAULTS.curriculumHeading, maxlength: 120 },
    enrollBullets: { type: [String], default: LANDING_DEFAULTS.enrollBullets },
    outcomes: { type: [String], default: LANDING_DEFAULTS.outcomes },
    courseDays: { type: [CourseDaySchema], default: LANDING_DEFAULTS.courseDays },

    operatorName: { type: String, default: LANDING_DEFAULTS.operatorName, maxlength: 80 },
    operatorBio: { type: String, default: LANDING_DEFAULTS.operatorBio, maxlength: 600 },
    operatorPhoto: { type: String, default: "", maxlength: 500 },
    operatorLocation: { type: String, default: LANDING_DEFAULTS.operatorLocation, maxlength: 80 },

    courseCtaTitle: { type: String, default: LANDING_DEFAULTS.courseCtaTitle, maxlength: 120 },

    coords: { type: String, default: LANDING_DEFAULTS.coords, maxlength: 60 },
  },
  { timestamps: true }
);

export default (mongoose.models.LandingContent as mongoose.Model<ILandingContent>) ||
  mongoose.model<ILandingContent>("LandingContent", LandingContentSchema);
