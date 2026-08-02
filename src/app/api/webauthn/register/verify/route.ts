import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import dbConnect from "@/lib/mongodb";
import WebAuthnCredential from "@/models/WebAuthnCredential";
import { getRPID, getExpectedOrigins, readChallenge, clearChallenge } from "@/lib/webauthn-server";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;

    const challenge = await readChallenge();
    if (!challenge) {
      return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
    }

    const body = await req.json();
    const { response, deviceLabel } = body;
    if (!response) {
      return NextResponse.json({ error: "Missing response" }, { status: 400 });
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: getExpectedOrigins(),
      expectedRPID: getRPID(),
    });

    if (!verification.verified || !verification.registrationInfo) {
      await clearChallenge();
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;

    await dbConnect();
    await WebAuthnCredential.create({
      userId,
      credentialID: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: response.response?.transports || [],
      deviceLabel: typeof deviceLabel === "string" && deviceLabel.trim() ? deviceLabel.trim().slice(0, 60) : "Энэ төхөөрөмж",
    });
    await clearChallenge();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webauthn] register verify:", err);
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
