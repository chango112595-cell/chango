import { bus } from "../core/eventBus.js";
import { ctxPool } from "../audio/contextPool.js";
import { once } from "../core/once.js";
class WasmSTT{
  constructor(){ this.active=false; this.ready=false; this.engine=null; this.src=null; this.proc=null; this.stream=null; this._probing=false; this._avail=false; }
  async available(){ if(this._probing) return this._avail; this._probing=true;
    try{ const res=await fetch("/models/wasm_stt/manifest.json",{cache:"no-store"}); this._avail=res.ok; }catch{ this._avail=false; }
    this._probing=false; return this._avail; }
  async _load(){ if(this.ready) return true; try{ const mod=await import(/* @vite-ignore */"/models/wasm_stt/engine.js"); this.engine=await mod.createEngine(); this.ready=true; }catch{ this.ready=false; } return this.ready; }
  async start(){ if(this.active) return; if(!(await this.available())) return; if(!(await this._load())) return;
    await ctxPool.ensure(); const ctx=ctxPool.ctx;
    this.stream=await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true }, video:false });
    this.src=ctx.createMediaStreamSource(this.stream); this.proc=ctx.createScriptProcessor(4096,1,1);
    this.proc.onaudioprocess=(e)=>{ const pcm=new Float32Array(e.inputBuffer.getChannelData(0)); const out=this.engine.feed(pcm);
      if(Array.isArray(out)) out.forEach(o=>o?.text && bus.emit("stt:result",{final:!!o.final,text:o.text})); };
    this.src.connect(this.proc); this.proc.connect(ctx.createGain()); this.active=true; bus.emit("diag:info",{where:"wasm_stt",msg:"started"}); }
  stop(){ if(!this.active) return;
    try{ this.proc && this.proc.disconnect(); }catch{} try{ this.src && this.src.disconnect(); }catch{}
    try{ this.stream && this.stream.getTracks().forEach(t=>t.stop()); }catch{}
    this.proc=this.src=this.stream=null; this.active=false; }
}
export const wasmSTT = once("wasm_stt", ()=> new WasmSTT());