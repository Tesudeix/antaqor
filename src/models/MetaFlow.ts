import mongoose, { Schema, Document, Model } from "mongoose";

// A ManyChat-style branching flow: cards (message + quick-reply buttons),
// each button points to the next card (branch) or "" to end.
// Execution (webhook wiring) is Phase 2; this model + builder is Phase 1.

export interface IFlowButton { label: string; kind: "next" | "url" | "action" | "flow"; value: string } // kind: next-card / url link / action / jump-to-flow
export interface IFlowCard { id: string; text: string; imageUrl?: string; subtitle?: string; buttons: IFlowButton[]; carousel?: boolean }

export type FlowMatchMode = "any" | "contains" | "exact" | "starts_with";

export interface IMetaFlow extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  enabled: boolean;
  platform: "instagram" | "messenger" | "both";
  triggerKeywords: string[];
  account: string;
  matchMode: FlowMatchMode;
  entryCardId: string;
  imageUrl: string;       // Card 1 hero image — stored relative (/uploads/x.webp), absolutised at send time
  cards: IFlowCard[];
  isMain: boolean;        // the canonical "main flow" for auto-send (≤1 per platform+account)
  autoSendEnabled: boolean;       // master opt-in for the 24h auto-send (ships OFF — no user is messaged until on)
  autoSendDelayMinutes: number;   // 1440=24h (default) · 360=6h · 60=1h · 0=immediate
  autoSentCount: number;          // telemetry: auto-send deliveries dispatched
  hitCount: number;
  createdByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const ButtonSchema = new Schema<IFlowButton>(
  { label: { type: String, required: true }, kind: { type: String, enum: ["next", "url", "action", "flow"], default: "next" }, value: { type: String, default: "" } },
  { _id: false }
);
const CardSchema = new Schema<IFlowCard>(
  { id: { type: String, required: true }, text: { type: String, default: "" }, imageUrl: { type: String, default: "" }, subtitle: { type: String, default: "" }, buttons: { type: [ButtonSchema], default: [] }, carousel: { type: Boolean, default: false } },
  { _id: false }
);

const MetaFlowSchema = new Schema<IMetaFlow>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    enabled: { type: Boolean, default: false }, // off until Phase 2 execution is wired
    platform: { type: String, enum: ["instagram", "messenger", "both"], default: "both" },
    triggerKeywords: { type: [String], default: [] },
    account: { type: String, default: "all" },
    matchMode: { type: String, enum: ["any", "contains", "exact", "starts_with"], default: "contains" },
    entryCardId: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    cards: { type: [CardSchema], default: [] },
    isMain: { type: Boolean, default: false, index: true },
    autoSendEnabled: { type: Boolean, default: false },
    autoSendDelayMinutes: { type: Number, default: 1440 },
    autoSentCount: { type: Number, default: 0 },
    hitCount: { type: Number, default: 0 },
    createdByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

const MetaFlow: Model<IMetaFlow> =
  mongoose.models.MetaFlow || mongoose.model<IMetaFlow>("MetaFlow", MetaFlowSchema);

export default MetaFlow;
