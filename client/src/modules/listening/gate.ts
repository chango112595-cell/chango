/**
 * Gate Module - Filters speech input to only allow addressed messages
 * This module implements the "Reply only when directly addressed" feature
 */

import { FEATURES } from '../../config/featureFlags';
import { containsWakeWord, removeWakeWord, WAKE_WORD } from '../../config/wakeword';

interface GateResult {
  allowed: boolean;
  text: string;
  reason: "wake" | "typed" | "ping" | "blocked";
}

/**
 * Check if the text is directly addressed to Chango
 * Uses centralized wake word configuration
 * @param text - The text to check
 * @returns true if the text is addressed to Chango
 */
function isAddressedToChango(text: string): boolean {
  return containsWakeWord(text);
}

/**
 * Strip the wake word from the beginning of the text
 * Uses centralized wake word removal
 * @param text - The text to process
 * @returns The text with the wake word removed
 */
function stripWakeWord(text: string): string {
  return removeWakeWord(text);
}

/**
 * Main gate function that filters input based on whether it's addressed to Chango
 * @param text - The input text to check
 * @param typed - Whether the input was typed (true) or spoken (false)
 * @returns GateResult with allowed status, processed text, and reason
 */
export function passGate(text: string, typed: boolean = false): GateResult {
  // Typed input should always pass through without wake word requirement
  if (typed) {
    console.log('[Gate] Typed input detected - always allowing through:', text);
    return {
      allowed: true,
      text: text,
      reason: "typed"
    };
  }
  
  // If either wake word detection or address requirement is disabled, allow everything through
  if (!FEATURES.WAKE_WORD || !FEATURES.AnswerOnlyWhenAddressed) {
    console.log('[Gate] Wake word or address requirement disabled - allowing through');
    return {
      allowed: true,
      text: text,
      reason: "wake" // Consider feature disabled as wake-allowed
    };
  }
  
  // Check if the speech is addressed to Chango
  if (isAddressedToChango(text)) {
    // Strip the wake word before passing through
    const processedText = stripWakeWord(text);
    
    // Check if it's just the wake word alone (a "ping")
    if (processedText.trim() === '' || processedText.trim().length === 0) {
      console.log('[Gate] Bare wake word detected (ping) - allowing through with acknowledge:', text);
      return {
        allowed: true,
        text: 'acknowledge',
        reason: "ping"
      };
    }
    
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