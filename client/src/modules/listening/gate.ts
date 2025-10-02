/**
 * Gate Module - Filters speech input to only allow addressed messages
 * This module implements the "Reply only when directly addressed" feature
 */

import { FEATURES } from '../../config/featureFlags';

interface GateResult {
  allowed: boolean;
  text: string;
  reason: "wake" | "typed" | "blocked";
}

// More flexible wake word pattern
// Matches: "hey chango", "ok chango", "yo chango", or just "chango"
// Followed by various punctuation marks
const WAKE_WORD_PATTERN = /^(?:\s*(hey|ok|yo)\s+)?chango[\s,.:;-]*/i;

/**
 * Check if the text is directly addressed to Chango
 * @param text - The text to check
 * @returns true if the text is addressed to Chango
 */
function isAddressedToChango(text: string): boolean {
  const trimmedText = text.trim();
  return WAKE_WORD_PATTERN.test(trimmedText);
}

/**
 * Strip the wake word from the beginning of the text
 * @param text - The text to process
 * @returns The text with the wake word removed
 */
function stripWakeWord(text: string): string {
  const trimmedText = text.trim();
  
  // Match and remove wake word pattern
  const match = trimmedText.match(WAKE_WORD_PATTERN);
  if (match) {
    // Remove the matched wake word part
    return trimmedText.substring(match[0].length).trim();
  }
  
  return trimmedText;
}

/**
 * Main gate function that filters input based on whether it's addressed to Chango
 * @param text - The input text to check
 * @param typed - Whether the input was typed (true) or spoken (false)
 * @returns GateResult with allowed status, processed text, and reason
 */
export function passGate(text: string, typed: boolean = false): GateResult {
  // If feature is disabled, allow everything through
  if (!FEATURES.AnswerOnlyWhenAddressed) {
    return {
      allowed: true,
      text: text,
      reason: "wake" // Consider feature disabled as wake-allowed
    };
  }
  
  // Always allow typed input (from Ask bar)
  if (typed) {
    console.log('[Gate] Typed input detected - allowing through');
    return {
      allowed: true,
      text: text,
      reason: "typed"
    };
  }
  
  // Check if the speech is addressed to Chango
  if (isAddressedToChango(text)) {
    // Strip the wake word before passing through
    const processedText = stripWakeWord(text);
    console.log('[Gate] Wake word detected - allowing through:', text, '->', processedText);
    return {
      allowed: true,
      text: processedText,
      reason: "wake"
    };
  }
  
  // Block unaddressed speech
  console.log('[Gate] Speech not addressed to Chango - blocking:', text);
  return {
    allowed: false,
    text: text,
    reason: "blocked"
  };
}

// Export for testing
export { isAddressedToChango, stripWakeWord };

// Expose to window in dev mode for testing
if (import.meta.env.DEV) {
  (window as any).listeningGate = {
    passGate,
    isAddressedToChango,
    stripWakeWord,
    testPatterns: (text: string) => {
      console.log('Testing:', text);
      console.log('Is addressed:', isAddressedToChango(text));
      console.log('Stripped text:', stripWakeWord(text));
      console.log('Gate result:', passGate(text, false));
    }
  };
  console.log('[Gate] Test functions exposed to window.listeningGate');
}