import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import dbConnect from "@/lib/mongodb";
import WebAuthnCredential from "@/models/WebAuthnCredential";
import { getRPID, getExpectedOrigins, readChallenge, clearChallenge } from "@/lib/webauthn-server";

// Short-lived signed token the credentials provider will accept in lieu of
// a password. 60-second TTL, HMAC over (userId.exp).
function signPasskeyToken(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET not set");
  const exp = Date.now() + 60_000;
  const payload = `${userId}.${exp}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export async function POST(req: NextRequest) {
  try {
    const challenge = await readChallenge();
    if (!challenge) {
      return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
    }

    const body = await req.json();
    const response = body.response;
    if (!response) {
      return NextResponse.json({ error: "Missing response" }, { status: 400 });
    }

    await dbConnect();

    // Look up the credential the browser used to sign.
    const credId = response.id;
    if (!credId) {
      return NextResponse.json({ error: "Missing credential id" }, { status: 400 });
    }
    const cred = await WebAuthnCredential.findOne({ credentialID: credId });
    if (!cred) {
      await clearChallenge();
      return NextResponse.json({ error: "Credential not registered" }, { status: 401 });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: getExpectedOrigins(),
      expectedRPID: getRPID(),
      credential: {
        id: cred.credentialID,
        publicKey: Buffer.from(cred.publicKey, "base64url"),
        counter: cred.counter,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transports: cred.transports as any,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      await clearChallenge();
      return NextResponse.json({ error: "Verification failed" }, { status: 401 });
    }

    // Update counter + lastUsedAt for clone detection / hygiene.
    cred.counter = verification.authenticationInfo.newCounter;
    cred.lastUsedAt = new Date();
    await cred.save();
    await clearChallenge();

    const token = signPasskeyToken(String(cred.userId));
    return NextResponse.json({ ok: true, token });
  } catch (err) {
    console.error("[webauthn] auth verify:", err);
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
