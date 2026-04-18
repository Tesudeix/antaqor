import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import PushSubscription from "@/models/PushSubscription";

export async function POST(req: NextRequest) {
  try {
    const { subscription, userId } = await req.json();
    if (!subscription?.endpoint || !subscription?.keys || !userId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await dbConnect();

    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        userId,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Push subscribe error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint, userId } = await req.json();
    if (!endpoint || !userId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await dbConnect();
    await PushSubscription.deleteOne({ endpoint, userId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Push unsubscribe error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
