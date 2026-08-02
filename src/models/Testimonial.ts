import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITestimonial extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  avatar: string;
  role: string;        // "AI freelancer", "Product designer", etc.
  result: string;      // headline — e.g., "AI automation-оор сард ₮2m нэмэгдэв"
  quote: string;       // longer body
  tags: string[];
  link: string;        // optional social link (instagram/site)
  featured: boolean;   // hero slot
  published: boolean;
  order: number;       // lower = earlier
  createdAt: Date;
  updatedAt: Date;
}

const TestimonialSchema = new Schema<ITestimonial>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    avatar: { type: String, default: "" },
    role: { type: String, default: "", trim: true, maxlength: 100 },
    result: { type: String, required: true, trim: true, maxlength: 160 },
    quote: { type: String, default: "", trim: true, maxlength: 1000 },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    link: { type: String, default: "", trim: true, maxlength: 400 },
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

TestimonialSchema.index({ published: 1, featured: -1, order: 1, createdAt: -1 });

const Testimonial: Model<ITestimonial> =
  mongoose.models.Testimonial ||
  mongoose.model<ITestimonial>("Testimonial", TestimonialSchema);

export default Testimonial;
