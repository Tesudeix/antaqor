import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import dbConnect from "@/lib/mongodb";
import WebAuthnCredential from "@/models/WebAuthnCredential";
import User from "@/models/User";
import { getRPID, getRPName, setChallenge } from "@/lib/webauthn-server";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;

    await dbConnect();
    const user = await User.findById(userId).select("name email").lean<{ name?: string; email?: string }>();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = await WebAuthnCredential.find({ userId }).select("credentialID transports").lean();

    const options = await generateRegistrationOptions({
      rpName: getRPName(),
      rpID: getRPID(),
      // userID must be a stable, opaque, unique buffer. We use the Mongo _id.
      userID: new TextEncoder().encode(userId),
      userName: user.email || userId,
      userDisplayName: user.name || user.email || "Antaqor",
      attestationType: "none",
      excludeCredentials: existing.map((c) => ({
        id: c.credentialID,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transports: c.transports as any,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform",
      },
    });

    await setChallenge(options.challenge);
    return NextResponse.json(options);
  } catch (err) {
    console.error("[webauthn] register options:", err);
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
