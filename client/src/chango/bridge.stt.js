/* Bridge STT → wake word → TTS, with 1s recovery and watchdog. */
import { device } from "./core/device.js";
import { bus } from "./core/eventBus.js";
import { voiceGate } from "./security/voicegate.js";

class WebSpeechSTT {
  constructor(){ 
    this.rec = null; 
    this.active = false; 
    this._last = ""; 
    this.lastActivity = Date.now();
    this.watchdog = null;
    this.recoveryCount = 0;
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
    
    // Track activity for watchdog
    this.rec.onaudiostart = () => {
      this.lastActivity = Date.now();
      bus.emit("diag:info", { where: "stt", msg: "audio started" });
    };
    
    this.rec.onresult = async (e) => {
      this.lastActivity = Date.now();
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
    
    // Fast recovery on end - restart after 1 second
    this.rec.onend = () => { 
      if (this.active) { 
        bus.emit("diag:info", { where: "stt", msg: "ended, restarting in 1s" });
        setTimeout(() => {
          if (this.active) {
            try { 
              this.rec.start(); 
              this.recoveryCount++;
              bus.emit("diag:info", { where: "stt", msg: `restarted (recovery #${this.recoveryCount})` });
            } catch (e) {
              bus.emit("diag:error", { where: "stt", msg: `restart failed: ${e.message}` });
            }
          }
        }, 1000); // 1 second recovery instead of default
      } 
    };
    
    // Fast recovery on error - restart after 1 second
    this.rec.onerror = (e) => {
      bus.emit("diag:warn", { where: "stt", msg: `error: ${e.error}` });
      if (this.active && e.error !== 'not-allowed') {
        setTimeout(() => {
          if (this.active) {
            try { 
              this.rec.start(); 
              this.recoveryCount++;
              bus.emit("diag:info", { where: "stt", msg: `recovered from error (recovery #${this.recoveryCount})` });
            } catch {}
          }
        }, 1000); // 1 second recovery
      }
    };
    
    try { 
      this.rec.start(); 
      this.active = true;
      this.startWatchdog();
      bus.emit("diag:info", { where: "stt", msg: "started with watchdog" });
    } catch (e) {
      bus.emit("diag:error", { where: "stt", msg: `start failed: ${e.message}` });
    }
  }
  
  startWatchdog() {
    // Clear existing watchdog
    if (this.watchdog) clearInterval(this.watchdog);
    
    // Check every 2 seconds for stuck STT (8s threshold)
    this.watchdog = setInterval(() => {
      const idleTime = Date.now() - this.lastActivity;
      if (this.active && idleTime > 8000) {
        bus.emit("diag:warn", { where: "stt", msg: `stuck for ${Math.round(idleTime/1000)}s, forcing restart` });
        this.forceRestart();
      }
    }, 2000);
  }
  
  forceRestart() {
    try { 
      this.rec && this.rec.stop(); 
    } catch {}
    
    setTimeout(() => {
      if (this.active) {
        try {
          this.rec.start();
          this.lastActivity = Date.now();
          this.recoveryCount++;
          bus.emit("diag:info", { where: "stt", msg: `force restarted (recovery #${this.recoveryCount})` });
        } catch (e) {
          bus.emit("diag:error", { where: "stt", msg: `force restart failed: ${e.message}` });
        }
      }
    }, 500);
  }
  
  stop(){ 
    try{ 
      this.rec && this.rec.stop(); 
      if (this.watchdog) {
        clearInterval(this.watchdog);
        this.watchdog = null;
      }
    } catch {} 
    this.active = false; 
  }
}

const stt = new WebSpeechSTT();
stt.start();

// VAD integration - ensure STT is running when voice detected
bus.on("vad:start", () => {
  if (stt.active && !stt.rec) {
    bus.emit("diag:info", { where: "stt", msg: "VAD triggered, ensuring STT active" });
    stt.forceRestart();
  }
});

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