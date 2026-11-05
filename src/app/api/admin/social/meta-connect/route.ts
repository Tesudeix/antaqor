import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import MetaOAuthToken from "@/models/MetaOAuthToken";
import MetaPage from "@/models/MetaPage";

export const dynamic = "force-dynamic";

const FB = "https://graph.facebook.com/v21.0";
// Same subscription set /admin/pages uses, so connecting here also keeps the
// DM/comment automation working for the page.
const WEBHOOK_FIELDS = "messages,messaging_postbacks,messaging_optins,message_reactions,feed";

type J = Record<string, unknown>;

async function gj(url: string, init?: RequestInit): Promise<J> {
  try {
    const r = await fetch(url, init);
    return (await r.json()) as J;
  } catch (e) {
    return { error: { message: String(e) } };
  }
}

async function storedToken(email: string): Promise<string> {
  await dbConnect();
  const row = await MetaOAuthToken.findOne({ email }).lean<{ userToken: string; expiresAt: Date } | null>();
  if (!row) return "";
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) return "";
  return row.userToken || "";
}

// GET — which Pages can this admin connect? (after the OAuth round-trip)
export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  const email = session.user?.email || "";
  const token = await storedToken(email);
  if (!token) return NextResponse.json({ pages: [], needsAuth: true });

  const acc = await gj(
    `${FB}/me/accounts?fields=id,name,instagram_business_account%7Bid,username%7D&limit=100&access_token=${encodeURIComponent(token)}`
  );
  const data = acc.data as J[] | undefined;
  if (!Array.isArray(data)) {
    return NextResponse.json({ pages: [], needsAuth: true, error: String((acc.error as J)?.message || "") });
  }
  const connected = await MetaPage.find({}).select("pageId").lean<{ pageId: string }[]>();
  const have = new Set(connected.map((c) => c.pageId));
  return NextResponse.json({
    pages: data.map((p) => {
      const ig = p.instagram_business_account as J | undefined;
      return {
        id: String(p.id),
        name: String(p.name || p.id),
        igId: String(ig?.id || ""),
        igUsername: String(ig?.username || ""),
        connected: have.has(String(p.id)),
      };
    }),
  });
}

// POST { pageId } — mint a permanent page token, read the linked IG account,
// subscribe the webhook, and register the page.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  const email = session.user?.email || "";
  const body = (await req.json().catch(() => ({}))) as J;
  const pageId = String(body.pageId || "").trim();
  if (!pageId) return NextResponse.json({ error: "pageId шаардлагатай" }, { status: 400 });

  const userToken = String(body.token || "") || (await storedToken(email));
  if (!userToken) return NextResponse.json({ error: "Эхлээд Facebook-ээр холбоно уу." }, { status: 400 });

  const acc = await gj(`${FB}/me/accounts?fields=id,access_token&limit=100&access_token=${encodeURIComponent(userToken)}`);
  const list = acc.data as J[] | undefined;
  const hit = Array.isArray(list) ? list.find((p) => String(p.id) === pageId) : undefined;
  const pageToken = String(hit?.access_token || "");
  if (!pageToken) {
    return NextResponse.json({ error: "Энэ хуудасны token олдсонгүй. Facebook-ээр дахин холбоно уу." }, { status: 400 });
  }

  const info = await gj(
    `${FB}/${pageId}?fields=name,instagram_business_account%7Bid,username%7D&access_token=${encodeURIComponent(pageToken)}`
  );
  const name = String(info.name || pageId);
  const ig = info.instagram_business_account as J | undefined;
  const igBusinessId = String(ig?.id || "");

  /* 2026-10-18: DM автомат хариулт (webhook) нь СОНГОЛТТОЙ, анхдагч нь унтраалттай.
     Өөр брэндийн хуудсыг холбоход тэр хуудасны үйлчлүүлэгчид Antaqor-ийн
     бот руу орох эрсдэлтэй (REVA-гийн сургамж) — зөвхөн нийтлэхэд хэрэггүй. */
  const wantDm = body.dm === true;
  const sub = wantDm
    ? await gj(`${FB}/${pageId}/subscribed_apps`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ subscribed_fields: WEBHOOK_FIELDS, access_token: pageToken }).toString(),
      })
    : { success: false };

  await dbConnect();
  const doc = await MetaPage.findOneAndUpdate(
    { pageId },
    {
      /* түлхүүрийг ДАРЖ БИЧИХГҮЙ: "antaqor" гэх мэт нэртэй хуудсыг дахин холбоход
         key нь pageId болж MetaTrigger/MetaWelcome-ууд өнчирдөг байсан */
      $setOnInsert: { key: pageId },
      pageId,
      name,
      igBusinessId,
      pageAccessToken: pageToken,
      enabled: true,
      connectedByEmail: email,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json({
    ok: true,
    page: { key: doc.key, pageId, name, igBusinessId, igUsername: String(ig?.username || "") },
    webhook: sub.success === true,
  });
}
