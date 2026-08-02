import mongoose, { Schema, Document, Model } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────
// SocialFlow — a visual, ManyChat-style social automation graph.
//
// First principles: an automation is a directed graph. A *trigger* fires on an
// inbound social event (keyword DM, comment, story reply); *nodes* transform or
// respond; *edges* wire outputs → inputs. The admin builder is a pannable canvas
// that persists exactly this { nodes, edges } shape, so the builder and the
// (future) runtime share one source of truth.
// ─────────────────────────────────────────────────────────────────────────

export type NodeType = "trigger" | "message" | "buttons" | "delay" | "condition" | "action";
export type Platform = "instagram" | "messenger" | "facebook" | "threads";

export interface IFlowNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  // Loosely typed per node kind — validated in the API, rendered by the canvas:
  //  trigger   { keywords: string[]; matchMode: "any"|"contains"|"exact"|"starts_with" }
  //  message   { text: string; imageUrl?: string }
  //  buttons   { text: string; options: { id: string; label: string }[] }
  //  delay     { minutes: number }
  //  condition { field: string; op: string; value: string }
  //  action    { kind: "tag"|"subscribe"|"unsubscribe"|"notify"; value: string }
  data: Record<string, unknown>;
}

export interface IFlowEdge {
  id: string;
  source: string;       // node id
  sourceHandle: string; // "out" | button-option id | "yes" | "no"
  target: string;       // node id
}

export interface ISocialFlow extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  platform: Platform;
  account: string; // аль хуудсанд — antaqor/joymassage/joybilliard
  enabled: boolean;
  nodes: IFlowNode[];
  edges: IFlowEdge[];
  runs: number;          // telemetry: times this flow has fired
  createdByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const NodeSchema = new Schema<IFlowNode>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["trigger", "message", "buttons", "delay", "condition", "action"], required: true },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const EdgeSchema = new Schema<IFlowEdge>(
  {
    id: { type: String, required: true },
    source: { type: String, required: true },
    sourceHandle: { type: String, default: "out" },
    target: { type: String, required: true },
  },
  { _id: false }
);

const SocialFlowSchema = new Schema<ISocialFlow>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", trim: true, maxlength: 400 },
    platform: { type: String, enum: ["instagram", "messenger", "facebook", "threads"], default: "instagram" },
    account: { type: String, default: "antaqor" },
    enabled: { type: Boolean, default: false, index: true },
    nodes: { type: [NodeSchema], default: [] },
    edges: { type: [EdgeSchema], default: [] },
    runs: { type: Number, default: 0 },
    createdByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

SocialFlowSchema.index({ updatedAt: -1 });

const SocialFlow: Model<ISocialFlow> =
  mongoose.models.SocialFlow || mongoose.model<ISocialFlow>("SocialFlow", SocialFlowSchema);

export default SocialFlow;
