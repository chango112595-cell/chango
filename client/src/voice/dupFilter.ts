/**
 * DupFilter Module
 * Detects duplicate text to prevent repeat outputs
 * Uses normalized text hashing with time-based expiration
 */

let lastHash = '';

export function isDuplicate(text: string): boolean {
  const h = text.trim().toLowerCase().replace(/\s+/g, ' ');
  
  if (!h) return false;
  
  if (h === lastHash) {
    console.log('[DupFilter] Duplicate detected:', h.slice(0, 50));
    return true;
  }
  
  lastHash = h;
  setTimeout(() => { 
    if (lastHash === h) {
      lastHash = '';
    }
  }, 15_000); // Clear after 15 seconds
  
  return false;
}