// Entry: keeps UI intact; only behavior added. Requires user gesture to unlock audio.
import { eventBus as bus } from "./core/eventBus.js";
import { audioContextPool as ctxPool } from "./audio/contextPool.js";
import { VAD } from "./audio/vad.js";
import { MFCC } from "./audio/mfcc.js";
import { prosodyPlan } from "./tts/prosody.js";
import { accentize } from "./accent/engine.js";
import { FormantSynth } from "./tts/formantSynth.js";
import { WakeWordDetector } from "./wakeword/detector.js";
import { WebSpeechSTT } from "./stt/webspeech.js";
import { UIAdapter } from "./ui/adapter.js";
import { speechState } from "./core/state.js";
import { monitor } from "./diag/monitor.js";
import { telemetry } from "./diag/telemetry.js";
import { voiceGate } from "./security/voicegate.js";
// Import bridge.stt for STT-to-TTS integration with wake word
import "./bridge.stt.js";

const ui = new UIAdapter();
const vad = new VAD();
const mfcc = new MFCC();
const tts = new FormantSynth();
const stt = new WebSpeechSTT();
const wake = new WakeWordDetector({ name: "lolo" });

// minimal wake template (fake example): 12 frames of 13-d MFCC zeros → user should enroll real template later
wake.enroll(Array.from({ length: 12 }, () => new Float32Array(13)));

function unlock() {
  ctxPool.unlock().then(() => bus.emit("status", "ready")).catch(() => bus.emit("status", "error: audio"));
}

async function speak(text) {
  if (!text || !text.trim()) { bus.emit("status", "nothing to say"); return; }
  
  // Set speech state to speaking
  speechState.set("speaking", "TTS started");
  
  // Prosody → phonemes (very light map here)
  const plan = prosodyPlan(text);
  const phonemes = wordsToPhones(plan);
  const acc = accentize(phonemes, "neutral");
  const tl = timeline(acc);
  bus.emit("tts:timeline", { items: tl });
  
  try {
    bus.emit("tts:begin");
    await tts.speak(tl, { rate: 1, pitch: 1, volume: 1 });
    bus.emit("tts:end");
  } catch (e) {
    bus.emit("tts:fail");
    bus.emit("diag:error", { where: "tts", e: e?.message });
  }
  
  // Set speech state back to idle
  speechState.set("idle", "TTS finished");
  bus.emit("status", "idle");
}

function stop() {
  // AudioContextPool doesn't have a stop method - just emit status
  bus.emit("status", "stopped");
}

function wordsToPhones(plan) {
  // minimal G2P fallback
  const dict = { 
    hello:["h","eh","l","ow"], 
    world:["w","er","l","d"], 
    chango:["ch","aa","ng","ow"], 
    jarvis:["jh","aa","r","v","ih","s"],
    test:["t","eh","s","t"],
    voice:["v","oy","s"],
    system:["s","ih","s","t","ax","m"]
  };
  const out = [];
  for (const unit of plan) {
    const w = unit.word.toLowerCase().replace(/\*|_/g, "");
    const phs = dict[w] || fallbackGrapheme(w);
    for (const ph of phs) {
      out.push({ 
        ph, 
        emphasis: unit.emphasis || false,
        boundary: unit.boundary || "none"
      });
    }
    // Add pause after punctuation boundaries
    if (unit.boundary && unit.boundary !== "none") {
      out.push({ ph: "pau", emphasis: false, boundary: unit.boundary });
    }
  }
  return out;
}

function fallbackGrapheme(word) {
  // Basic letter-to-phoneme conversion fallback
  const letterMap = {
    a: "ae", b: "b", c: "k", d: "d", e: "eh", f: "f", g: "g", h: "h",
    i: "ih", j: "jh", k: "k", l: "l", m: "m", n: "n", o: "ao", p: "p",
    q: "k", r: "r", s: "s", t: "t", u: "ah", v: "v", w: "w", x: "k",
    y: "y", z: "z"
  };
  
  const phonemes = [];
  const chars = word.toLowerCase().split("");
  
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const next = chars[i + 1];
    
    // Handle common digraphs
    if (c === "c" && next === "h") { phonemes.push("ch"); i++; }
    else if (c === "s" && next === "h") { phonemes.push("sh"); i++; }
    else if (c === "t" && next === "h") { phonemes.push("th"); i++; }
    else if (c === "p" && next === "h") { phonemes.push("f"); i++; }
    else if (c === "n" && next === "g") { phonemes.push("ng"); i++; }
    else if (c === "z" && next === "h") { phonemes.push("zh"); i++; }
    // Handle vowel combinations
    else if (c === "a" && next === "i") { phonemes.push("ay"); i++; }
    else if (c === "a" && next === "y") { phonemes.push("ey"); i++; }
    else if (c === "e" && next === "e") { phonemes.push("iy"); i++; }
    else if (c === "e" && next === "a") { phonemes.push("iy"); i++; }
    else if (c === "o" && next === "o") { phonemes.push("uw"); i++; }
    else if (c === "o" && next === "u") { phonemes.push("aw"); i++; }
    else if (c === "o" && next === "w") { phonemes.push("ow"); i++; }
    else if (c === "o" && next === "y") { phonemes.push("oy"); i++; }
    else if (c === "a" && next === "r") { phonemes.push("aa", "r"); i++; }
    else if (c === "e" && next === "r") { phonemes.push("er"); i++; }
    else if (c === "i" && next === "r") { phonemes.push("er"); i++; }
    else if (c === "o" && next === "r") { phonemes.push("ao", "r"); i++; }
    else if (c === "u" && next === "r") { phonemes.push("er"); i++; }
    // Default single letter mapping
    else if (letterMap[c]) { phonemes.push(letterMap[c]); }
    // Skip non-alphabetic characters
    else if (!/[a-z]/.test(c)) { continue; }
  }
  
  return phonemes.length > 0 ? phonemes : ["ah"]; // Default to schwa if empty
}

function timeline(phonemes) {
  // Convert phonemes to timed items for synthesis
  const items = [];
  
  for (const ph of phonemes) {
    // Base duration based on phoneme type
    let dur = 0.08; // default
    
    if (ph.ph === "pau") {
      // Pause durations based on boundary type
      if (ph.boundary === "H%" || ph.boundary === "L%") dur = 0.3;
      else if (ph.boundary === "ip") dur = 0.15;
      else dur = 0.1;
    } else if (isVowel(ph.ph)) {
      // Vowels are generally longer
      dur = ph.emphasis ? 0.15 : 0.12;
    } else if (isFricative(ph.ph)) {
      // Fricatives are medium length
      dur = 0.09;
    } else if (isPlosive(ph.ph)) {
      // Plosives are short
      dur = 0.06;
    } else if (isLiquid(ph.ph)) {
      // Liquids and approximants
      dur = 0.10;
    }
    
    // Apply emphasis scaling
    if (ph.emphasis && ph.ph !== "pau") {
      dur *= 1.3;
    }
    
    items.push({
      ph: ph.ph,
      dur: dur,
      gain: ph.emphasis ? 0.28 : 0.22,
      boundary: ph.boundary || "none"
    });
  }
  
  return items;
}

// Phoneme type helpers
function isVowel(ph) {
  return ["iy","ih","eh","ae","aa","ah","ao","uh","uw","ow","ey","ay","oy","er","ax"].includes(ph);
}

function isFricative(ph) {
  return ["f","v","s","z","sh","zh","th","h"].includes(ph);
}

function isPlosive(ph) {
  return ["p","b","t","d","k","g"].includes(ph);
}

function isLiquid(ph) {
  return ["l","r","w","y","m","n","ng"].includes(ph);
}

// Mount UI adapter with control functions
ui.mount({ 
  speakFn: speak, 
  stopFn: stop, 
  unlockFn: unlock 
});

// Export for external access if needed
// Export bus directly (it's the renamed eventBus from import)
export { ui, vad, mfcc, tts, stt, wake, unlock, speak, stop, bus, ctxPool, speechState, monitor, voiceGate, telemetry };
// Also export as eventBus for backward compatibility
const eventBus = bus;
export { eventBus };

// Expose speak function globally for bridge.stt.js compatibility
window.speak = speak;
window.Chango = { speak };