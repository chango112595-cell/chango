/**
 * Intent Router
 * Manages and routes intents for the voice system
 */

import { bus } from "../core/eventBus.js";

// Intent registry
const intents = new Map();

/**
 * Register an intent handler
 * @param {Object} intent - Intent configuration
 * @param {string} intent.name - Intent name
 * @param {Function} intent.match - Function to test if text matches intent
 * @param {Function} intent.handle - Handler function for the intent
 */
export function registerIntent(intent) {
  if (!intent.name || !intent.match || !intent.handle) {
    console.warn("Invalid intent registration", intent);
    return;
  }
  intents.set(intent.name, intent);
}

/**
 * Route text to matching intent
 * @param {string} text - Input text to route
 * @returns {Promise<boolean>} - True if handled, false otherwise
 */
export async function routeIntent(text) {
  if (!text || typeof text !== 'string') return false;
  
  const normalizedText = text.toLowerCase().trim();
  
  // Try to find matching intent
  for (const [name, intent] of intents) {
    try {
      if (intent.match(normalizedText)) {
        // Create context for handler
        const context = {
          text: normalizedText,
          originalText: text,
          speak: (msg) => {
            if (typeof window.speak === "function") {
              window.speak(msg);
            } else if (window.Chango?.speak) {
              window.Chango.speak(msg);
            } else {
              speechSynthesis.speak(new SpeechSynthesisUtterance(msg));
            }
            bus.emit("tts:start", { text: msg });
          },
          emit: (event, data) => bus.emit(event, data)
        };
        
        const result = await intent.handle(context);
        if (result) {
          bus.emit("intent:handled", { name, text });
          return true;
        }
      }
    } catch (err) {
      console.error(`Error handling intent ${name}:`, err);
    }
  }
  
  return false;
}

// Register some built-in intents
registerIntent({
  name: "time.current",
  match: text => /\b(time|clock)\b/i.test(text) && !/set|alarm|timer/i.test(text),
  handle: async ({ speak }) => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    speak(`It's ${displayHours}:${displayMinutes} ${ampm}`);
    return true;
  }
});

registerIntent({
  name: "date.current",
  match: text => /\b(date|today|day)\b/i.test(text) && !/tomorrow|yesterday/i.test(text),
  handle: async ({ speak }) => {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = now.toLocaleDateString('en-US', options);
    speak(`Today is ${dateString}`);
    return true;
  }
});

registerIntent({
  name: "identity",
  match: text => /\b(who are you|your name|what are you)\b/i.test(text),
  handle: async ({ speak }) => {
    speak("I'm Chango, your AI assistant. I'm here to help you with various tasks.");
    return true;
  }
});

// Export for other modules to use
export default { registerIntent, routeIntent };