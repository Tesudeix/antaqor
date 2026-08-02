import mongoose, { Schema, Document, Types } from "mongoose";

// Per-(contact × flow) runtime state for the Flow Builder.
//
// The Flow Builder used to be fully stateless — every card button carried the
// next card id in its postback payload, so nothing recorded *where* a contact
// was. That made two things impossible: (1) a mid-flow lock (typed text while
// parked on a card fell through to triggers / Default Reply), and (2) live
// operator counts ("X contacts at Menu, Y at card 3").
//
// One row per contact per flow. A contact holds at most ONE active session per
// flow (unique index). `nodeId` is the card the contact is currently parked on;
// it only ever moves FORWARD via a button tap (advanceFlowSession). Status:
//   active    — parked on nodeId, awaiting a button tap
//   completed — reached a terminal card / explicit branch-end
//   exited    — bailed out (exit keyword) or the parked card was deleted

export type FlowSessionStatus = "active" | "completed" | "exited";

export interface IMetaFlowSession extends Document {
  conversationId: Types.ObjectId;
  account: string;
  flowId: string;
  nodeId: string;
  status: FlowSessionStatus;
  enteredViaEvent: string;
  enteredAt: Date;
  lastAdvancedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MetaFlowSessionSchema = new Schema<IMetaFlowSession>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "MetaConversation", required: true, index: true },
    account: { type: String, default: "antaqor", index: true },
    flowId: { type: String, required: true, index: true },
    nodeId: { type: String, default: "" },
    status: { type: String, enum: ["active", "completed", "exited"], default: "active", index: true },
    enteredViaEvent: { type: String, default: "" },
    enteredAt: { type: Date, default: () => new Date() },
    lastAdvancedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// One row per (contact × flow) — entering a flow the contact already finished
// resets this same row rather than creating a duplicate.
MetaFlowSessionSchema.index({ conversationId: 1, flowId: 1 }, { unique: true });
// Powers the live operator counts: "active at nodeId" grouped per flow.
MetaFlowSessionSchema.index({ flowId: 1, status: 1, nodeId: 1 });

export default (mongoose.models.MetaFlowSession as mongoose.Model<IMetaFlowSession>) ||
  mongoose.model<IMetaFlowSession>("MetaFlowSession", MetaFlowSessionSchema);
