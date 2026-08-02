import mongoose, { Schema, Document } from "mongoose";

export type WelcomeAction = "book" | "human" | "trigger" | "text";

// First-touch behaviour for a brand-new conversation.
//   menu — greeting + tappable buttons (default, original behaviour)
//   flow — auto-start a qualifying funnel (intro / hr / book)
//   off  — stay silent on first touch
export type WelcomeMode = "menu" | "flow" | "off";

// What to do when an incoming DM matches no keyword trigger.
//   smart  — original heuristic (business → menu, antaqor → AI)
//   menu   — re-show the welcome menu
//   ai     — AI auto-reply (subject to global settings)
//   text   — send a fixed defaultText
//   flow   — start the defaultFlow funnel
//   human  — escalate to a human agent
//   intent — score the message and route (hot→flow/menu, warm→AI, support→human, else→menu)
export type DefaultAction = "smart" | "menu" | "ai" | "text" | "flow" | "human" | "intent";

export interface IWelcomeButton {
  label: string;
  action: WelcomeAction;
  value: string;
}

export interface IMetaWelcome extends Document {
  account: string;
  greeting: string;
  buttons: IWelcomeButton[];
  conversationStarters: string[];
  enabled: boolean;
  welcomeMode: WelcomeMode;
  welcomeFlow: string;
  defaultAction: DefaultAction;
  defaultText: string;
  defaultFlow: string;
  // FAQ / business knowledge base (freeform, contact's language). When set, an
  // unmatched natural-language question is ANSWERED from this before any menu
  // fallback — so the welcome menu is never re-shown as a non-answer.
  businessFaq: string;
  // Payment info for the "Дансаар төлөх" (pay) flow action — Mongolia is
  // bank-transfer / QPay, not cards. payQrUrl = QPay QR image (relative /uploads
  // path, absolutised at send time); payText = bank name + account number + name.
  payQrUrl: string;
  payText: string;
  createdAt: Date;
  updatedAt: Date;
}

const MetaWelcomeSchema = new Schema<IMetaWelcome>(
  {
    account: { type: String, required: true, unique: true, index: true },
    greeting: { type: String, default: "" },
    buttons: {
      type: [
        new Schema(
          {
            label: { type: String, required: true },
            action: { type: String, enum: ["book", "human", "trigger", "text"], default: "text" },
            value: { type: String, default: "" },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    // Conversation Starters (Meta ice-breakers) — up to 4 suggested questions
    // shown to help a customer open a conversation.
    conversationStarters: { type: [String], default: [] },
    enabled: { type: Boolean, default: true },
    welcomeMode: { type: String, enum: ["menu", "flow", "off"], default: "menu" },
    welcomeFlow: { type: String, default: "intro" },
    defaultAction: {
      type: String,
      enum: ["smart", "menu", "ai", "text", "flow", "human", "intent"],
      default: "smart",
    },
    defaultText: { type: String, default: "" },
    defaultFlow: { type: String, default: "intro" },
    businessFaq: { type: String, default: "" },
    payQrUrl: { type: String, default: "" },
    payText: { type: String, default: "" },
  },
  { timestamps: true }
);

export default (mongoose.models.MetaWelcome as mongoose.Model<IMetaWelcome>) ||
  mongoose.model<IMetaWelcome>("MetaWelcome", MetaWelcomeSchema);
