"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";

export default function PasskeySignIn() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const supported =
    typeof window !== "undefined" && "PublicKeyCredential" in window;
  if (!supported) return null;

  const signInWithPasskey = async () => {
    setBusy(true);
    setErr("");
    try {
      const optsRes = await fetch("/api/webauthn/authenticate/options", { method: "POST" });
      if (!optsRes.ok) throw new Error("Сервер алдаа");
      const options = await optsRes.json();

      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      if (!verifyRes.ok) {
        const d = await verifyRes.json().catch(() => ({}));
        throw new Error(d.error || "Баталгаажуулалт амжилтгүй");
      }
      const { token } = await verifyRes.json();

      const res = await signIn("credentials", {
        passkeyToken: token,
        redirect: false,
      });
      if (res?.error) throw new Error(res.error);

      router.push("/");
      router.refresh();
    } catch (e) {
      const m = e instanceof Error ? e.message : "Алдаа";
      if (/cancelled|aborted|NotAllowedError/i.test(m)) {
        setErr(""); // user cancelled — quiet
      } else {
        setErr(m);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={signInWithPasskey}
        disabled={busy}
        className="flex w-full items-center justify-center rounded-[4px] border border-[#E6E6E6] bg-white px-4 py-2.5 text-[13px] font-bold text-[#171717] transition hover:border-[rgba(46,41,255,0.4)] active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "Шалгаж байна..." : "Face ID-аар нэвтрэх"}
      </button>
      {err && <p className="mt-2 text-[11px] text-[#2E29FF]">{err}</p>}
    </div>
  );
}
