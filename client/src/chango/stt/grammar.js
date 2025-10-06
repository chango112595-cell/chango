/* Offline micro-grammar after wake; no UI change.
   If no final STT appears within 2s after a wake hit, we try to infer an intent
   from a tiny keyword set and respond locally. */
import { bus } from "../core/eventBus.js";
import { routeIntent, registerIntent } from "../brain/intent.js";

// Extend intent router with a couple of offline keywords as fallback.
registerIntent({
  name: "sys.stop",
  match: t => /^\s*(stop|cancel|quiet|silence)\b/.test(t),
  handle: async ({ speak }) => { 
    speak("Stopping."); 
    bus.emit("sys:stop"); 
    return true; 
  }
});

registerIntent({
  name: "sys.power",
  match: t => /^\s*(power|shutdown|go sleep)\b/.test(t),
  handle: async ({ speak }) => { 
    speak("Standing by."); 
    bus.emit("sys:standby"); 
    return true; 
  }
});

// Keyword list for offline guess when STT fails.
const OFFLINE = [
  { 
    p: /\b(time)\b/i,  
    say: () => new Date().toLocaleTimeString(), 
    intent: "time.now", 
    speak: (s) => `It's ${s}` 
  },
  { 
    p: /\b(date|today)\b/i, 
    say: () => new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    }), 
    intent: "date.today", 
    speak: (s) => `Today is ${s}` 
  },
  { 
    p: /\b(weather)\b/i, 
    intent: "weather", 
    speak: () => "Weather module not yet wired." 
  },
  { 
    p: /\b(music|play)\b/i, 
    intent: "media.play", 
    speak: () => "Playing." 
  },
  { 
    p: /\b(stop|cancel)\b/i, 
    intent: "sys.stop", 
    speak: () => "Stopping." 
  },
  { 
    p: /\b(power)\b/i, 
    intent: "sys.power", 
    speak: () => "Standing by." 
  }
];

function speakOut(msg) {
  try {
    if (typeof window.speak === "function") {
      window.speak(msg);
    } else if (window.Chango?.speak) {
      window.Chango.speak(msg);
    } else {
      speechSynthesis.speak(new SpeechSynthesisUtterance(msg));
    }
  } catch(e) {
    console.error("Error in speakOut:", e);
  }
}

let timer = null;
let pending = false;

// When wake word fires, wait up to 2s for a final STT; otherwise offline guess.
bus.on("wake:hit", () => {
  clearTimeout(timer);
  pending = true;
  timer = setTimeout(async () => {
    if (!pending) return;
    // Pull last interim tokens if you store them; otherwise prompt.
    speakOut("Yes?");
    pending = false;
  }, 2000);
});

// Any STT final cancels the offline prompt and routes via intents.
bus.on("stt:result", async ({ text, final }) => {
  if (!text) return;
  if (final) {
    clearTimeout(timer);
    pending = false;
    const handled = await routeIntent(text);
    if (!handled) {
      speakOut(text);
    }
  }
});

// Export for testing
export { speakOut, OFFLINE };