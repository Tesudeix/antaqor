/** App input limit, shared by the editor, enhancement API and image ledger. */
export const IMAGE_PROMPT_LIMIT = 16_000;
export const IMAGE_FULL_PROMPT_LIMIT = 18_000;

/** Keep legacy providers' existing limits explicit; never silently truncate. */
export function imagePromptLimit(provider: string): number {
  return provider === "kling" ? 2500 : provider === "openai" ? 4000 : IMAGE_PROMPT_LIMIT;
}

export function imagePromptError(prompt: string, limit = IMAGE_PROMPT_LIMIT): string | null {
  if (!prompt.trim()) return "Промпт оруулна уу";
  if (prompt.length > limit) return `Промпт ${limit.toLocaleString("en-US")} тэмдэгтээс ихгүй байх ёстой. Текстээ богиносгох эсвэл Nano Banana сонгоно уу.`;
  return null;
}
