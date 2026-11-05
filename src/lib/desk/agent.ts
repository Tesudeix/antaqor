import type { Sym, TF } from "./market";
import { read } from "./truth";

/* ─── Tesla Trader · асуулт (2026-11-06) ───
   Хариулт зөвхөн одоогийн уншилтын бодит тоон дээр, арилжааны мэдлэггүй хүнд ойлгомжтой, богино. Тоо зохиохыг хориглоно. */
const rate = new Map<string, number[]>();
export async function ask(user: string, o: { sym: Sym; tf: TF; q: string; history: { role: string; text: string }[] }) {
  const now = Date.now(), hits = (rate.get(user) || []).filter((t) => now - t < 60e3);
  if (hits.length >= 8) throw new Error("Дэндүү олон асуулт. Нэг минутын дараа дахин асууна уу");
  rate.set(user, [...hits, now]);
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("AI тохируулаагүй байна");
  const r = await read(o.sym, o.tf);
  const facts = { instrument: o.sym, timeframe: o.tf, price: r.px, indicators_up: r.up, indicators_down: r.dn, indicators_neutral: r.flat, independent_votes: r.neff, readings: r.cells.map((c: { label: string; v: number; read: string }) => ({ name: c.label, vote: c.v, value: c.read })), history_check: r.truth, horizon: r.h, expected_range: r.range, support: r.levels.sup, resistance: r.levels.res, strategies: r.plans, verified_plan: r.plan, next_news: r.news?.next ?? null };
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      model: process.env.Z_GEMINI_MODEL || "gemini-3-flash-preview", max_tokens: 2500, reasoning_effort: "low",
      messages: [
        { role: "system", content: `You explain a live market reading to a person who may know nothing about trading. Answer in plain spoken Mongolian (Cyrillic), at most 3 short sentences, and explain any term you use. Use ONLY the numbers in FACTS; never invent or change a price, level, percentage or date. If FACTS does not answer it, say so. Be blunt about uncertainty: history_check.kind "coin" means no better than a coin flip. Never promise profit, never tell the person to buy or sell, and give no personal financial advice.\n\nFACTS:\n${JSON.stringify(facts)}` },
        ...o.history.slice(-6).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text.slice(0, 800) })),
        { role: "user", content: o.q.slice(0, 600) },
      ],
    }),
  });
  const d = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[] }, a = d.choices?.[0]?.message?.content?.trim();
  if (!res.ok || !a) throw new Error("Хариулт ирсэнгүй. Дахин оролдоно уу");
  return a;
}
