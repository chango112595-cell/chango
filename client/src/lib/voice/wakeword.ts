// lib/voice/wakeword.ts
export const WAKE_WORD = /^(?:lolo|hey\s+lolo)\b/i; // ensure your chosen words

export function shouldWake(text: string, enabled: boolean) {
  if (!enabled) return true; // if wake-word mode off, always pass
  return WAKE_WORD.test(text.trim());
}