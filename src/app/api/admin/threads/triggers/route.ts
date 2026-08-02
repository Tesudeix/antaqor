import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import ThreadsTrigger from "@/models/ThreadsTrigger";

export const dynamic = "force-dynamic";

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

// Parse + validate an automation payload. (Route files may only export HTTP
// handlers — keep this module-local.)
function parseAutomation(body: Record<string, unknown>, email: string) {
  const name = String(body.name || "").trim();
  const triggerType = VALID_TYPES.includes(String(body.triggerType)) ? String(body.triggerType) : "new_comment";
  const scope = VALID_SCOPES.includes(String(body.scope)) ? String(body.scope) : "all";
  const scopeValue = String(body.scopeValue || "").trim();
  const action = VALID_ACTIONS.includes(String(body.action)) ? String(body.action) : "reply";
  const matchMode = VALID_MODES.includes(String(body.matchMode)) ? String(body.matchMode) : "contains";
  const keywords = strList(body.keywords);
  const replyTemplate = String(body.replyTemplate || "").trim();

  if (!name) return { error: "Нэр шаардлагатай." };
  if (scope !== "all" && !scopeValue) return { error: "Пост ID эсвэл hashtag оруулна уу." };
  if ((action === "reply" || action === "reply_and_log") && !replyTemplate)
    return { error: "Хариу текст шаардлагатай." };
  if (triggerType === "new_comment" && matchMode !== "any" && keywords.length === 0)
    return { error: "Түлхүүр үг оруулна уу (эсвэл 'Бүх сэтгэгдэл' горим сонгоно уу)." };

  return {
    doc: {
      name, triggerType, scope, scopeValue,
      threadsUserId: String(body.threadsUserId || ""),
      keywords, matchMode,
      caseSensitive: !!body.caseSensitive,
      excludeKeywords: strList(body.excludeKeywords),
      firstTimeOnly: !!body.firstTimeOnly,
      activeFrom: clampHour(body.activeFrom),
      activeTo: clampHour(body.activeTo),
      action, replyTemplate,
      replyVariations: strList(body.replyVariations).slice(0, 5),
      leadLabel: String(body.leadLabel || "").trim().slice(0, 60),
      enabled: body.enabled !== false,
      createdByEmail: email,
    },
  };
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  await dbConnect();
  const triggers = await ThreadsTrigger.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({ triggers });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const body = await req.json();
  const parsed = parseAutomation(body, session.user?.email || "");
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await dbConnect();
  const trigger = await ThreadsTrigger.create(parsed.doc);
  return NextResponse.json({ trigger }, { status: 201 });
}
