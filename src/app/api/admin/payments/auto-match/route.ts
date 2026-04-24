import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { pushToUser } from "@/lib/push";
import { maybeAwardReferralPayment } from "@/lib/credits";

// ─── Parse bank-statement paste ───
// Bank apps (Хаан, Голомт, Хас, SocialPay) all format transfers slightly differently.
// We look for two signals per line: our 6-char reference code + a plausible amount.
// Lenient on surrounding noise — works for copy/paste from SMS, statement screenshots,
// CSV exports, email receipts, or manually-typed lines.

interface ParsedTx {
  rawLine: string;
  refCode: string;
  amount: number;
}

// Our refCodes are 6 chars drawn from ABCDEFGHJKMNPQRSTUVWXYZ23456789 (no 0/1/I/L/O).
// First char must be a letter (common prefix in random; avoids matching trailing numbers).
const REF_CODE_RX = /(?<![A-Z0-9])([A-HJ-NP-Z][A-HJ-NP-Z2-9]{5,6})(?![A-Z0-9])/;
const AMOUNT_RX = /([\d]{1,3}(?:[,.\s][\d]{3})+|[\d]{4,7})(?:[.,]\d{1,2})?/g;

function parseAmountToken(token: string): number {
  // Remove thousands separators (comma, dot, space) and decimal part (after last . or ,)
  const cleaned = token.replace(/[\s,.]/g, "");
  const n = parseInt(cleaned);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function parseStatement(text: string): ParsedTx[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: ParsedTx[] = [];

  for (const line of lines) {
    const refMatch = line.match(REF_CODE_RX);
    if (!refMatch) continue;

    // Harvest all numeric tokens → pick the one that's plausibly MNT (1000–2,000,000)
    const amountTokens = line.match(AMOUNT_RX) || [];
    const amounts = amountTokens
      .map(parseAmountToken)
      .filter((n) => n >= 1000 && n <= 2_000_000);

    if (amounts.length === 0) continue;

    // Pick the amount closest to the expected MNT range — if multiple, pick the largest
    // (balance totals won't match refCode lines typically)
    const amount = Math.max(...amounts);

    out.push({
      rawLine: line,
      refCode: refMatch[1].toUpperCase(),
      amount,
    });
  }

  return out;
}

// ─── Endpoint ───
type OutcomeStatus = "match" | "no-match" | "amount-mismatch" | "already-paid" | "failed" | "approved";

interface Outcome {
  rawLine: string;
  parsedRefCode: string;
  parsedAmount: number;
  status: OutcomeStatus;
  payment?: {
    _id: string;
    expectedAmount: number;
    status: string;
    user: { _id: string; name: string; email: string; avatar?: string } | null;
  };
  error?: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { statementText, execute, days: daysRaw } = await req.json();
    if (typeof statementText !== "string" || !statementText.trim()) {
      return NextResponse.json({ error: "statementText required" }, { status: 400 });
    }

    const days = Math.max(1, Math.min(365, Number(daysRaw) || 30));

    await dbConnect();

    const parsed = parseStatement(statementText);
    const seenCodes = new Set<string>();
    const outcomes: Outcome[] = [];

    for (const tx of parsed) {
      // De-dupe — same refCode twice in one statement means the second one is a balance/echo
      if (seenCodes.has(tx.refCode)) continue;
      seenCodes.add(tx.refCode);

      const payment = await Payment.findOne({ referenceCode: tx.refCode }).populate("user", "name email avatar");
      if (!payment) {
        outcomes.push({ rawLine: tx.rawLine, parsedRefCode: tx.refCode, parsedAmount: tx.amount, status: "no-match" });
        continue;
      }

      const pu = payment.user as unknown as { _id: { toString(): string }; name: string; email: string; avatar?: string } | null;
      const paymentSummary = {
        _id: payment._id.toString(),
        expectedAmount: payment.amount,
        status: payment.status,
        user: pu ? { _id: pu._id.toString(), name: pu.name, email: pu.email, avatar: pu.avatar } : null,
      };

      if (payment.status === "paid") {
        outcomes.push({ rawLine: tx.rawLine, parsedRefCode: tx.refCode, parsedAmount: tx.amount, status: "already-paid", payment: paymentSummary });
        continue;
      }

      // Tolerate small difference (user might pay amount + bank fee, or 49,000.00 vs 49000)
      const matches = Math.abs(tx.amount - payment.amount) < 1;
      if (!matches) {
        outcomes.push({ rawLine: tx.rawLine, parsedRefCode: tx.refCode, parsedAmount: tx.amount, status: "amount-mismatch", payment: paymentSummary });
        continue;
      }

      if (!execute) {
        outcomes.push({ rawLine: tx.rawLine, parsedRefCode: tx.refCode, parsedAmount: tx.amount, status: "match", payment: paymentSummary });
        continue;
      }

      // EXECUTE — mark paid, extend subscription, fire referral + push
      try {
        payment.status = "paid";
        payment.paidAt = new Date();
        await payment.save();

        const user = await User.findById(payment.user);
        if (user) {
          const now = new Date();
          const base =
            user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now
              ? new Date(user.subscriptionExpiresAt)
              : now;
          const expiresAt = new Date(base);
          expiresAt.setDate(expiresAt.getDate() + days);
          user.subscriptionExpiresAt = expiresAt;
          if (!user.clan) user.clan = "antaqor";
          if (!user.clanJoinedAt) user.clanJoinedAt = now;
          await user.save();

          maybeAwardReferralPayment(String(user._id)).catch(() => {});
          pushToUser(String(user._id), {
            title: "Cyber Empire идэвхжлээ 🚀",
            body: `${days} хоногийн гишүүнчлэл амжилттай. Тавтай морил!`,
            url: "/",
            tag: "membership-activated",
          }).catch(() => {});
        }

        outcomes.push({ rawLine: tx.rawLine, parsedRefCode: tx.refCode, parsedAmount: tx.amount, status: "approved", payment: { ...paymentSummary, status: "paid" } });
      } catch (err) {
        outcomes.push({
          rawLine: tx.rawLine,
          parsedRefCode: tx.refCode,
          parsedAmount: tx.amount,
          status: "failed",
          error: err instanceof Error ? err.message : "update failed",
          payment: paymentSummary,
        });
      }
    }

    const summary = {
      parsedLines: parsed.length,
      matches: outcomes.filter((o) => o.status === "match").length,
      approved: outcomes.filter((o) => o.status === "approved").length,
      amountMismatches: outcomes.filter((o) => o.status === "amount-mismatch").length,
      noMatches: outcomes.filter((o) => o.status === "no-match").length,
      alreadyPaid: outcomes.filter((o) => o.status === "already-paid").length,
      failed: outcomes.filter((o) => o.status === "failed").length,
    };

    return NextResponse.json({ summary, outcomes, executed: !!execute });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
