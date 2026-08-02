// ─── OpenAI moderation helper ──────────────────────────────────────────────
//
// Uses omni-moderation-latest — free of charge.
// Returns { ok: true } if the text is safe, { ok: false, reason } if flagged
// with high enough confidence to block. We only block on explicit
// sexual-minors / illicit-violence / self-harm-instructions categories. The
// rest of the categories (hate, violence, sexual, etc.) get logged but pass
// through — too many false positives to autoblock community speech.

const HARD_BLOCK_CATEGORIES = [
  "sexual/minors",
  "illicit/violent",
  "self-harm/instructions",
] as const;

const SOFT_FLAG_THRESHOLD = 0.85;

interface ModerationResult {
  ok: boolean;
  reason?: string;
  flaggedCategories?: string[];
}

export async function moderateText(text: string): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !text || text.trim().length === 0) {
    return { ok: true };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: text.slice(0, 8000),
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      // Don't block on transient API failure — log and pass.
      console.error("[moderation] upstream", res.status);
      return { ok: true };
    }

    const data = (await res.json()) as {
      results?: Array<{
        flagged: boolean;
        categories: Record<string, boolean>;
        category_scores: Record<string, number>;
      }>;
    };

    const r = data.results?.[0];
    if (!r) return { ok: true };

    const flaggedList: string[] = [];
    for (const [cat, isFlagged] of Object.entries(r.categories)) {
      if (isFlagged) flaggedList.push(cat);
    }

    // Hard block: explicit kid-sexual / violence-with-instructions /
    // self-harm-instructions. These are policy lines.
    for (const blockCat of HARD_BLOCK_CATEGORIES) {
      const score = r.category_scores[blockCat];
      if ((r.categories[blockCat] || (typeof score === "number" && score >= SOFT_FLAG_THRESHOLD))) {
        return {
          ok: false,
          reason: "Контент бичих дүрэм зөрчиж байна",
          flaggedCategories: flaggedList,
        };
      }
    }

    return { ok: true, flaggedCategories: flaggedList };
  } catch (e) {
    console.error("[moderation] error", e);
    // Fail open — never block users when the moderator API is down.
    return { ok: true };
  }
}
