import { bus } from "../core/eventBus.js";
export class WebSpeechSTT {
  constructor() { this.rec = null; this.active = false; }
  start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { bus.emit("stt:unavailable"); return; }
    this.rec = new SR(); this.rec.continuous = true; this.rec.interimResults = true; this.rec.onresult = (e) => {
      const i = e.resultIndex, r = e.results[i];
      bus.emit("stt:result", { text: r[0].transcript, final: r.isFinal });
    };
    this.rec.onend = () => { if (this.active) this.rec.start(); };
    this.rec.start(); this.active = true;
  }
  stop() { try { this.rec && this.rec.stop(); } catch {} this.active = false; }
}