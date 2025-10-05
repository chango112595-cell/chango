// lib/voice/dupGuard.ts
let lastHash = '';
let lastAt = 0;

export function isDuplicate(s: string, ms=3000) {
  const h = s.trim().toLowerCase();
  const now = Date.now();
  if (h && h === lastHash && (now - lastAt) < ms) return true;
  lastHash = h; lastAt = now;
  return false;
}