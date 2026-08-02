import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import ThreadsTrigger from "@/models/ThreadsTrigger";

const VALID_MODES = ["any", "contains", "exact", "starts_with"];
const VALID_TYPES = ["new_comment", "new_like"];
const VALID_SCOPES = ["all", "post", "hashtag"];
const VALID_ACTIONS = ["reply", "log_lead", "reply_and_log"];

const strList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map((k) => String(k).trim()).filter(Boolean)
    : String(v || "").split(",").map((k) => k.trim()).filter(Boolean);

const clampHour = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(23, Math.max(0, Math.round(n))) : 0;
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.replyTemplate === "string") update.replyTemplate = body.replyTemplate.trim();
  if (body.replyVariations !== undefined) update.replyVariations = strList(body.replyVariations).slice(0, 5);
  if (typeof body.enabled === "boolean") update.enabled = body.enabled;
  if (typeof body.caseSensitive === "boolean") update.caseSensitive = body.caseSensitive;
  if (typeof body.firstTimeOnly === "boolean") update.firstTimeOnly = body.firstTimeOnly;
  if (typeof body.matchMode === "string" && VALID_MODES.includes(body.matchMode)) update.matchMode = body.matchMode;
  if (typeof body.triggerType === "string" && VALID_TYPES.includes(body.triggerType)) update.triggerType = body.triggerType;
  if (typeof body.scope === "string" && VALID_SCOPES.includes(body.scope)) update.scope = body.scope;
  if (typeof body.scopeValue === "string") update.scopeValue = body.scopeValue.trim();
  if (typeof body.action === "string" && VALID_ACTIONS.includes(body.action)) update.action = body.action;
  if (typeof body.threadsUserId === "string") update.threadsUserId = body.threadsUserId;
  if (typeof body.leadLabel === "string") update.leadLabel = body.leadLabel.trim().slice(0, 60);
  if (body.activeFrom !== undefined) update.activeFrom = clampHour(body.activeFrom);
  if (body.activeTo !== undefined) update.activeTo = clampHour(body.activeTo);
  if (body.keywords !== undefined) update.keywords = strList(body.keywords);
  if (body.excludeKeywords !== undefined) update.excludeKeywords = strList(body.excludeKeywords);

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await dbConnect();
  const trigger = await ThreadsTrigger.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!trigger) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ trigger });
}

// POST /triggers/[id] — duplicate the automation (created paused for safety).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  const { id } = await params;
  await dbConnect();
  const src = await ThreadsTrigger.findById(id).lean();
  if (!src) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trigger = await ThreadsTrigger.create({
    name: `${src.name} (хуулбар)`,
    triggerType: src.triggerType || "new_comment",
    scope: src.scope || "all",
    scopeValue: src.scopeValue || "",
    threadsUserId: src.threadsUserId || "",
    keywords: src.keywords || [],
    matchMode: src.matchMode || "contains",
    caseSensitive: !!src.caseSensitive,
    excludeKeywords: src.excludeKeywords || [],
    firstTimeOnly: !!src.firstTimeOnly,
    activeFrom: src.activeFrom || 0,
    activeTo: src.activeTo || 0,
    action: src.action || "reply",
    replyTemplate: src.replyTemplate || "",
    replyVariations: src.replyVariations || [],
    leadLabel: src.leadLabel || "",
    enabled: false, // duplicates start paused for safety
    createdByEmail: session.user?.email || "",
  });
  return NextResponse.json({ trigger }, { status: 201 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  const { id } = await params;
  await dbConnect();
  const deleted = await ThreadsTrigger.findByIdAndDelete(id).lean();
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
