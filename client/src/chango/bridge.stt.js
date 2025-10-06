/* Bridge STT → wake word → TTS, with owner gate check, no UI changes. */
import { device } from "./core/device.js";
import { bus } from "./core/eventBus.js";
import { voiceGate } from "./security/voicegate.js";

class WebSpeechSTT {
  constructor(){ 
    this.rec = null; 
    this.active = false; 
    this._last = ""; 
  }
  
  start(){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { 
      bus.emit("stt:unavailable"); 
      return; 
    }
    this.rec = new SR(); 
    this.rec.continuous = true; 
    this.rec.interimResults = true; 
    this.rec.lang = "en-US";
    
    this.rec.onresult = async (e) => {
      const r = e.results[e.resultIndex]; 
      const text = (r[0]?.transcript || "").trim();
      if (!text) return;
      
      if (r.isFinal) {
        if (text === this._last) return; 
        this._last = text;
        const trigger = /^(\s*(lolo|chango)[\s,.:;-]*)/i;
        if (!trigger.test(text)) return;
        const cleaned = text.replace(trigger, "").trim();
        if (!cleaned) return;

        // optional owner gate: capture 1.2s mic and compare
        let pass = true;
        try {
          const sr = device.sampleRateHint;
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true }, 
            video: false 
          });
          const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: sr });
          const src = ctx.createMediaStreamSource(stream);
          const rec = ctx.createScriptProcessor(2048, 1, 1);
          const chunks = []; 
          rec.onaudioprocess = ev => chunks.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
          src.connect(rec); 
          rec.connect(ctx.destination);
          await new Promise(r => setTimeout(r, 1200));
          try { rec.disconnect(); src.disconnect(); } catch {}
          stream.getTracks().forEach(t => t.stop());
          const total = chunks.reduce((s, a) => s + a.length, 0);
          const x = new Float32Array(total); 
          let o = 0; 
          for(const a of chunks){ 
            x.set(a, o); 
            o += a.length; 
          }
          pass = voiceGate.check(x, sr);
        } catch { /* permissive fallback */ }

        if (!pass) { 
          bus.emit("diag:warn", { where: "gate", msg: "Blocked non-owner" }); 
          return; 
        }
        bus.emit("cmd", cleaned);
      } else {
        bus.emit("stt:result", { text, final: false });
      }
    };
    
    this.rec.onend = () => { 
      if (this.active) { 
        try { this.rec.start(); } catch {} 
      } 
    };
    
    try { 
      this.rec.start(); 
      this.active = true; 
    } catch {}
  }
  
  stop(){ 
    try{ 
      this.rec && this.rec.stop(); 
    } catch {} 
    this.active = false; 
  }
}

const stt = new WebSpeechSTT();
stt.start();

// route recognized command to your existing speak() without UI changes
bus.on("cmd", (text) => {
  try {
    if (typeof window.speak === "function") {
      window.speak(text);
    } else if (window.Chango && typeof window.Chango.speak === "function") {
      window.Chango.speak(text);
    } else { 
      const u = new SpeechSynthesisUtterance(text); 
      speechSynthesis.speak(u); 
    }
  } catch {}
});