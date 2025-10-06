// Speech state machine to prevent STT/TTS handover loops.
import { bus } from "./eventBus.js";
export class SpeechState {
  constructor(){ this.state="idle"; this.lastUtter=""; this.ts=0; }
  set(ns, why){ this.state=ns; this.ts=performance.now(); bus.emit("diag:state",{state:ns,why}); }
  guardIncoming(text){
    const t = (text||"").trim();
    if(!t) return false;
    if(this.state==="speaking") return false;            // ignore STT while TTS
    if(t===this.lastUtter) return false;                 // dedupe
    this.lastUtter=t; return true;
  }
}
export const speechState = new SpeechState();