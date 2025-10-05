/**
 * SpeakOnce Module
 * Prevents duplicate speech outputs within a time window
 * Uses a TTL cache to track recently spoken text
 */

const spoken = new Set<string>();
const TTL_MS = 60_000; // 60 seconds TTL for duplicate detection

export function speakOnce(id: string, text: string, speakFn: (t: string) => void) {
  if (spoken.has(id)) {
    console.log('[SpeakOnce] Duplicate speech prevented:', id);
    return;
  }
  
  spoken.add(id);
  setTimeout(() => spoken.delete(id), TTL_MS);
  speakFn(text);
}