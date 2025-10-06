import { device } from "./core/device.js";
import { bus } from "./core/eventBus.js";
import { voiceGate } from "./security/voicegate.js";
import { routeIntent } from "./brain/intent.js";
import { kws } from "./stt/kws_local.js";
import { wasmSTT } from "./stt/wasm_fallback.js";
import "./stt/grammar.js"; // <-- ensure offline grammar loaded

class WebSpeechSTT {
  constructor(){ 
    this.rec=null; this.active=false; this._last=""; 
    this._lastEvent=0; this._wd=null; 
    this._recoveries=0; this._backoff=1000; // 1s→2s→4s→8s (cap)
    this._lastRecoveryAt=0;
  }
  _tick(){ this._lastEvent = performance.now(); this._backoff = 1000; } // reset backoff on any activity
  _watchdog(){
    clearInterval(this._wd);
    this._wd = setInterval(()=>{
      const idle = performance.now() - this._lastEvent;
      if (idle > 8000 && this.active) { // stuck
        this._recoveries++; this._lastRecoveryAt = Date.now();
        bus.emit("diag:recovery", { count: this._recoveries, idle_ms: Math.round(idle) });
        this.restart(); // uses current backoff
      }
    }, 1000);
  }
  start(){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { bus.emit("stt:unavailable"); this._fallbackStart(); return; }
    this.rec = new SR(); this.rec.continuous = true; this.rec.interimResults = true; this.rec.lang = "en-US";
    this.rec.onstart = () => { this._tick(); this._watchdog(); };
    this.rec.onresult = async (e) => {
      this._tick();
      const r = e.results[e.resultIndex]; const text = (r[0]?.transcript||"").trim();
      if (!text) return;
      if (r.isFinal) {
        if (text === this._last) return; this._last = text;
        const trigger = /^(\s*(lolo|chango)[\s,.:;-]*)/i;
        if (!trigger.test(text)) return;
        const cleaned = text.replace(trigger, "").trim();
        if (!cleaned) return;

        // Optional owner gate: quick 0.8s snapshot
        let pass = true;
        try {
          const sr = device.sampleRateHint;
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
          const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: sr });
          const src = ctx.createMediaStreamSource(stream);
          const rec = ctx.createScriptProcessor(2048, 1, 1);
          const chunks=[]; rec.onaudioprocess = ev => chunks.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
          src.connect(rec); rec.connect(ctx.destination);
          await new Promise(r=>setTimeout(r, 800));
          try { rec.disconnect(); src.disconnect(); } catch {}
          stream.getTracks().forEach(t=>t.stop());
          const total = chunks.reduce((s,a)=>s+a.length,0), x=new Float32Array(total); let o=0; for(const a of chunks){ x.set(a,o); o+=a.length; }
          pass = voiceGate.check(x, sr);
        } catch {}
        if (!pass) { bus.emit("diag:warn", { where: "gate", msg: "Blocked non-owner" }); return; }

        bus.emit("cmd", cleaned);
      } else {
        bus.emit("stt:result", { text, final: false });
      }
    };
    this.rec.onerror = () => { this.restart(); };
    this.rec.onend   = () => { if (this.active) this.restart(); };
    try { this.rec.start(); this.active = true; this._tick(); this._watchdog(); } catch {}
  }
  async _fallbackStart(){
    try { if (await wasmSTT.available()) { await wasmSTT.start(); this.active = true; return; } } catch {}
    try { await kws.start(); } catch {}
    this.active = true;
  }
  restart(){
    try { this.rec && this.rec.stop(); } catch {}
    clearInterval(this._wd);
    const delay = Math.min(this._backoff, 8000);
    this._backoff = Math.min(this._backoff * 2, 8000);
    setTimeout(()=>{ try { this.start(); } catch {} }, delay);
  }
  stop(){
    try { this.rec && this.rec.stop(); } catch {}
    try { wasmSTT.stop(); } catch {}
    try { kws.stop(); } catch {}
    clearInterval(this._wd);
    this.active=false;
  }
}
const stt = new WebSpeechSTT();
stt.start();

// Keep STT alive when VAD hears voice
bus.on("vad:start", () => { if (!stt.active) stt.start(); });

// Intent routing
bus.on("cmd", async (text) => {
  const handled = await routeIntent(text);
  if (handled) return;
  try{
    if (typeof window.speak === "function") window.speak(text);
    else if (window.Chango?.speak) window.Chango.speak(text);
    else speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }catch{}
});