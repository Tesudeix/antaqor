// Safety guardrails for incoming DMs.
// • Distress detection — self-harm / crisis signals → immediate human handoff
//   + Mongol crisis hotline reply. AI is muted on that conversation.
// • This is litigation moat. Character.AI / Replika had multi-million dollar
//   suits over self-harm tragedies. Cost to add: ~30 lines. Cost not to: existential.

const DISTRESS_PATTERNS: RegExp[] = [
  // Mongol — self-harm / suicide ideation
  /амиа\s*хорло/i,
  /өөрийг(өө)?\s*ал/i,
  /өөрийг(өө)?\s*дууст?г/i,
  /(амьдрахаа|амьдрах)\s*болио/i,
  /(амьдрах|амь)\s*хүсэлгүй/i,
  /үхмээр|үхмээр\s*байн/i,
  /(зүрх|сэтгэл)\s*шаналж/i,
  /дэндүү\s*ядарч/i,

  // English
  /\bkill\s+(myself|me)\b/i,
  /\b(commit\s+)?suicide\b/i,
  /\bend\s+(it\s+all|my\s+life)\b/i,
  /\bhurt\s+myself\b/i,
  /\bself\s*[- ]?harm\b/i,
  /\bcan't\s+go\s+on\b/i,
  /\bno\s+reason\s+to\s+live\b/i,

  // Russian (Mongolia has Russian-language users)
  /самоубийств/i,
  /покончить\s+с\s+собой/i,
  /не\s+хочу\s+жить/i,
];

const VIOLENCE_PATTERNS: RegExp[] = [
  /\b(kill|murder|shoot|stab)\s+(him|her|them|you)\b/i,
  /(хороох|алах|устгах)\s+(түүн|тэдн|чамайг)/i,
];

export type SafetyFlag = "distress" | "violence" | null;

export interface SafetyCheck {
  flag: SafetyFlag;
  shouldHaltAI: boolean;
  replyText: string | null;
}

export const CRISIS_REPLY_MN = `🤝 Та одоо хүнд цаг үе байгаа бололтой. Та ганцаараа биш.

📞 Mongolia Crisis Line: 1900-1024 (24/7, үнэгүй)
🆘 Сэтгэцийн эрүүл мэндийн NCMH: 1900-1922

Манай human team тантай 1-2 цагт холбогдоно. AI нь энэ үед тань туслахгүй — жинхэнэ хүнтэй ярих нь хамгийн зөв.

Та хэрхэн байгаагаа админ-д хүргэх үү?`;

const VIOLENCE_REPLY_MN = `⚠️ Бид хүн ам, нийгмийн аюулгүй байдалд хор хүргэх агуулгад хариу өгөхгүй.
Хэрэв та хүнд цаг үе байвал 1900-1024 ярь.
Бусад асуудалд human team тантай удахгүй холбогдоно.`;

export function checkSafety(text: string): SafetyCheck {
  for (const re of DISTRESS_PATTERNS) {
    if (re.test(text)) {
      return { flag: "distress", shouldHaltAI: true, replyText: CRISIS_REPLY_MN };
    }
  }
  for (const re of VIOLENCE_PATTERNS) {
    if (re.test(text)) {
      return { flag: "violence", shouldHaltAI: true, replyText: VIOLENCE_REPLY_MN };
    }
  }
  return { flag: null, shouldHaltAI: false, replyText: null };
}
