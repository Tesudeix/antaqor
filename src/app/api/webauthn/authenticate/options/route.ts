import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import dbConnect from "@/lib/mongodb";
import WebAuthnCredential from "@/models/WebAuthnCredential";
import { getRPID, setChallenge } from "@/lib/webauthn-server";

// No auth required — sign-in flow runs while the user is logged out.
// We don't reveal which credentials exist; the browser narrows by the
// resident-key match, so allowCredentials can be left empty.
export async function POST() {
  try {
    await dbConnect();
    // Optional: include hints for known credentials to speed up UX. We omit
    // this for unauthenticated callers to avoid leaking enumeration info.
    void WebAuthnCredential; // imported for side-effect / future targeted hints

    const options = await generateAuthenticationOptions({
      rpID: getRPID(),
      userVerification: "preferred",
      timeout: 60_000,
    });

    await setChallenge(options.challenge);
    return NextResponse.json(options);
  } catch (err) {
    console.error("[webauthn] auth options:", err);
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
