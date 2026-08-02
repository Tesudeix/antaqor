// ─── Short payment reference code ───
// 6-char uppercase alphanumeric — short enough to fit in any bank-transfer reference field,
// unambiguous enough to read off a phone screen without mistakes.
// Avoided confusing chars: 0/O, 1/I/L.

import Payment from "@/models/Payment";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Generate a unique reference code that isn't in use on any existing Payment. */
export async function generateUniqueRefCode(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode(6);
    const existing = await Payment.findOne({ referenceCode: code }).select("_id").lean();
    if (!existing) return code;
  }
  // Fallback to 7-char if we somehow keep colliding (astronomically unlikely with 30^6 space)
  return randomCode(7);
}
