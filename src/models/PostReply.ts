import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Per-post answer for a comment funnel.
 *
 * The keyword lives on the MetaTrigger; this only decides WHAT comes back for
 * one specific post. A page runs a single "prompt" trigger, and each post
 * carries its own guide/link — which is the whole point of the pattern: the
 * person commenting on the travel post wants the travel prompt, not a generic
 * landing page.
 *
 * Missing row = fall back to the trigger's own dmTemplate, so adding this never
 * breaks a page that has not filled anything in.
 */
export interface IPostReply extends Document {
  account: string;
  /** FB `post_id` or IG `media.id` — whichever the webhook delivered. */
  postId: string;
  /** Free-text note for the admin list (usually the caption's first line). */
  label: string;
  dmText: string;
  imageUrl: string;
  buttons: { label: string; url: string }[];
  /** Public reply under the comment; blank = use the trigger's. */
  commentReply: string;
  /** PromptPost slug this post hands out. Kept alongside the button URL so
   *  attribution can ask "which magnet did this post actually deliver?"
   *  without parsing links. */
  promptSlug: string;
  enabled: boolean;
  hitCount: number;
  lastFiredAt?: Date;
  createdByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const PostReplySchema = new Schema<IPostReply>(
  {
    account: { type: String, required: true, index: true },
    postId: { type: String, required: true, index: true },
    label: { type: String, default: "" },
    dmText: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    buttons: {
      type: [
        new Schema(
          { label: { type: String, required: true }, url: { type: String, default: "" } },
          { _id: false }
        ),
      ],
      default: [],
    },
    commentReply: { type: String, default: "" },
    promptSlug: { type: String, default: "", index: true },
    enabled: { type: Boolean, default: true },
    hitCount: { type: Number, default: 0 },
    lastFiredAt: { type: Date },
    createdByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

// One answer per post per account — the lookup key on every incoming comment.
PostReplySchema.index({ account: 1, postId: 1 }, { unique: true });

const PostReply: Model<IPostReply> =
  (mongoose.models.PostReply as Model<IPostReply>) ||
  mongoose.model<IPostReply>("PostReply", PostReplySchema);

export default PostReply;
