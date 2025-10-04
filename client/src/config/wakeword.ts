/**
 * Centralized Wake Word Configuration
 * Change the WAKE_WORD constant to update the wake word globally
 */

export const WAKE_WORD = "lolo";

// Variations that are accepted as wake words
export const WAKE_WORD_VARIATIONS = [
  "lolo",
  "hey lolo", 
  "ok lolo",
  "hi lolo",
  "yo lolo"
];

// Check if a transcript contains the wake word
export function containsWakeWord(transcript: string): boolean {
  const lowerTranscript = transcript.toLowerCase().trim();
  return WAKE_WORD_VARIATIONS.some(variation => 
    lowerTranscript.includes(variation)
  );
}

// Remove wake word from transcript for processing
export function removeWakeWord(transcript: string): string {
  let processed = transcript.toLowerCase().trim();
  
  // Remove any wake word variation found
  for (const variation of WAKE_WORD_VARIATIONS) {
    if (processed.includes(variation)) {
      // Remove the wake word and any trailing comma or punctuation
      processed = processed.replace(new RegExp(`${variation}[,.]?\\s*`, 'gi'), '');
      break;
    }
  }
  
  return processed.trim();
}