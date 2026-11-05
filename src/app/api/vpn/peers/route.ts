import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import { addPeer, listPeers, removePeer } from "@/lib/wireguard";

export const dynamic = "force-dynamic";

/* /vpn хуудасны API. БҮХ үйлдэл админаар хаалттай: энэ маршрут нь серверийн
   сүлжээнд төхөөрөмж нэмдэг тул нээлттэй байвал хэн ч VPN-д холбогдож,
   MongoDB болон долоон сайт байрлаж буй машин руу орох боломжтой болно. */

export async function GET() {
  if (!(await getAdminSession())) return unauthorized();
  try {
    return NextResponse.json({ peers: await listPeers() });
  } catch (e) {
    console.error("[vpn/peers] list", e);
    return NextResponse.json({ error: "wg_unavailable" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  try {
    const body = await req.json().catch(() => ({}));
    const peer = await addPeer(body?.label);

    /* QR-г ЭНД, сервер дээр зурна. Гуравдагч талын QR үйлчилгээ рүү
       илгээвэл нууц түлхүүр тэдний лог дээр үлдэнэ — тэр нь VPN-ээ
       өгсөнтэй адил. */
    const qr = await QRCode.toDataURL(peer.config, { errorCorrectionLevel: "M", margin: 1, width: 512 });

    /* `config` нь нууц түлхүүрээ агуулна. Сервер дээр хадгалагдахгүй,
       зөвхөн ЭНЭ хариунд нэг удаа буцна. */
    return NextResponse.json({ ...peer, qr });
  } catch (e) {
    console.error("[vpn/peers] add", e);
    const msg = e instanceof Error ? e.message : "add_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  try {
    const body = await req.json().catch(() => ({}));
    const publicKey = String(body?.publicKey || "");
    await removePeer(publicKey);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[vpn/peers] remove", e);
    const msg = e instanceof Error ? e.message : "remove_failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
