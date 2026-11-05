import mongoose, { Schema } from "mongoose";
const schema = new Schema({
  course: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: "", maxlength: 2000 },
}, { timestamps: true });
schema.index({ course: 1, user: 1 }, { unique: true });
export default mongoose.models.CourseReview || mongoose.model("CourseReview", schema);
