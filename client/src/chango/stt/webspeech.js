import { eventBus as bus } from "../core/eventBus.js";
import { speechState } from "../core/state.js";

export class WebSpeechSTT {
  constructor() { this.rec = null; this.active = false; this._debounceTimer = null; }
  start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { bus.emit("stt:unavailable"); return; }
    this.rec = new SR(); this.rec.continuous = true; this.rec.interimResults = true; 
    this.rec.onresult = (e) => {
      const i = e.resultIndex, r = e.results[i];
      const text = r[0].transcript;
      
      // Clear existing debounce
      clearTimeout(this._debounceTimer);
      
      if (r.isFinal) {
        // Apply speech state guard for final results
        if (speechState.guardIncoming(text)) {
          bus.emit("stt:result", { text: text, final: true });
        }
      } else {
        // Debounce interim results
        this._debounceTimer = setTimeout(() => {
          if (speechState.guardIncoming(text)) {
            bus.emit("stt:result", { text: text, final: false });
          }
        }, 250);
      }
    };
    this.rec.onend = () => { if (this.active) this.rec.start(); };
    this.rec.start(); this.active = true;
  }
  stop() { 
    clearTimeout(this._debounceTimer);
    try { this.rec && this.rec.stop(); } catch {} 
    this.active = false; 
  }
}