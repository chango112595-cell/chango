import { device } from "./core/device.js";
import { bus } from "./core/eventBus.js";
import { voiceGate } from "./security/voicegate.js";
import { routeIntent } from "./brain/intent.js";
import { kws } from "./stt/kws_local.js";
import { wasmSTT } from "./stt/wasm_fallback.js";
import "./stt/grammar.js";
import { once } from "./core/once.js";
class WebSpeechSTT{
  constructor(){ this.rec=null; this.active=false; this._last=""; this._lastEvent=0; this._wd=null; this._recoveries=0; this._backoff=1000; this._maxBackoff=8000; this._maxRecoveries=12; this._visHandler=null; }
  _tick(){ this._lastEvent=performance.now(); this._backoff=1000; }
  _watch(){ clearInterval(this._wd); this._wd=setInterval(()=>{ const idle=performance.now()-this._lastEvent; if(idle>8000 && this.active) this._recover(); },1000); }
  _recover(){ if(this._recoveries>=this._maxRecoveries) return; this._recoveries++; const delay=Math.min(this._backoff,this._maxBackoff); this._backoff=Math.min(this._backoff*2,this._maxBackoff);
    bus.emit("diag:recovery",{count:this._recoveries,idle_ms:Math.round(performance.now()-this._lastEvent)}); this._restart(delay); }
  _restart(delay=1000){ try{ this.rec && this.rec.stop(); }catch{} clearInterval(this._wd); setTimeout(()=>{ if(!document.hidden) this.start(); },delay); }
  start(){ if(this.active) return; const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR){ bus.emit("stt:unavailable"); this._fallback(); return; }
    this.rec=new SR(); this.rec.continuous=true; this.rec.interimResults=true; this.rec.lang="en-US";
    this.rec.onstart=()=>{ this.active=true; this._tick(); this._watch(); };
    this.rec.onresult=async(e)=>{ this._tick(); const r=e.results[e.resultIndex]; const text=(r[0]?.transcript||"").trim(); if(!text) return;
      if(r.isFinal){ if(text===this._last) return; this._last=text; const trigger=/^(\s*(lolo|chango)[\s,.:;-]*)/i; if(!trigger.test(text)) return;
        const cleaned=text.replace(trigger,"").trim(); if(!cleaned) return;
        let pass=true; try{ const sr=device.sampleRateHint; const stream=await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true }, video:false });
          const ac=new (window.AudioContext||window.webkitAudioContext)({sampleRate:sr}); const src=ac.createMediaStreamSource(stream);
          const rec=ac.createScriptProcessor(2048,1,1); const chunks=[]; rec.onaudioprocess=ev=>chunks.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
          src.connect(rec); rec.connect(ac.createGain()); await new Promise(r=>setTimeout(r,800));
          try{ rec.disconnect(); src.disconnect(); }catch{} stream.getTracks().forEach(t=>t.stop());
          const len=chunks.reduce((s,a)=>s+a.length,0), x=new Float32Array(len); let o=0; for(const a of chunks){ x.set(a,o); o+=a.length; }
          pass=voiceGate.check(x,sr);
        }catch{}
        if(!pass){ bus.emit("diag:warn",{where:"gate",msg:"Blocked non-owner"}); return; }
        bus.emit("cmd",cleaned);
      } else { bus.emit("stt:result",{text,final:false}); } };
    this.rec.onerror=()=>this._recover(); this.rec.onend=()=>{ if(this.active && !document.hidden) this._recover(); };
    try{ this.rec.start(); }catch{} this._visHandler=()=>{ if(document.hidden){ this.stop(); } else { this.start(); } };
    document.addEventListener("visibilitychange",this._visHandler,{passive:true}); }
  async _fallback(){ if(await wasmSTT.available()){ await wasmSTT.start(); this.active=true; } else { await kws.start(); this.active=true; } }
  stop(){ if(!this.active) return; try{ this.rec && this.rec.stop(); }catch{} try{ wasmSTT.stop(); }catch{} try{ kws.stop(); }catch{} clearInterval(this._wd);
    if(this._visHandler){ document.removeEventListener("visibilitychange",this._visHandler); this._visHandler=null; } this.active=false; }
}
export const sttBridge = once("stt_bridge", ()=> new WebSpeechSTT()); sttBridge.start();