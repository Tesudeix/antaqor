import { Resend } from "resend";

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const RESEND_BRANDED_FROM = process.env.EMAIL_FROM || "Antaqor <noreply@antaqor.com>";
const RESEND_FALLBACK_FROM = "Antaqor <onboarding@resend.dev>";

export async function sendEmail(args: SendEmailArgs): Promise<{ ok: true; via: "resend" }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY missing");
  const resend = new Resend(apiKey);
  const t0 = Date.now();

  let result = await resend.emails.send({
    from: RESEND_BRANDED_FROM,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });

  if (result.error) {
    console.warn(`[email] resend branded failed · ${result.error.message ?? "(no msg)"} · retrying via resend.dev`);
    result = await resend.emails.send({
      from: RESEND_FALLBACK_FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
  }

  if (result.error) {
    throw new Error(`Resend failed: ${result.error.message ?? "unknown"}`);
  }

  console.log(`[email] resend ok in ${Date.now() - t0}ms · id=${result.data?.id ?? "?"} · to=${args.to}`);
  return { ok: true, via: "resend" };
}
