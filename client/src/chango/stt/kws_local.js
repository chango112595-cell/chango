import { bus } from "../core/eventBus.js";
import { ctxPool } from "../audio/contextPool.js";
import { MFCC } from "../audio/mfcc.js";
import { once } from "../core/once.js";
function dtw(a,b){ const n=a.length,m=b.length; const D=Array.from({length:n+1},()=>new Float32Array(m+1).fill(Infinity)); D[0][0]=0;
  const dist=(x,y)=>{ let s=0; for(let i=0;i<x.length;i++){ const d=x[i]-y[i]; s+=d*d; } return Math.sqrt(s); };
  for(let i=1;i<=n;i++) for(let j=1;j<=m;j++){ const cost=dist(a[i-1],b[j-1]); D[i][j]=cost+Math.min(D[i-1][j],D[i][j-1],D[i-1][j-1]); }
  return D[n][m]/(n+m);
}
class LocalKWS{
  constructor(){ this.active=false; this.stream=null; this.src=null; this.proc=null;
    this.mfcc=new MFCC({ fftSize:1024, sampleRate:48000, melBands:24, coeffs:13 });
    this.buf=new Float32Array(0);
    this.templates={ lolo:Array.from({length:14},(_,i)=> new Float32Array(this.mfcc.coeffs).fill(Math.sin(i))),
                     chango:Array.from({length:18},(_,i)=> new Float32Array(this.mfcc.coeffs).fill(Math.cos(i))) };
  }
  async start(){ if(this.active) return; await ctxPool.ensure(); const ctx=ctxPool.ctx;
    this.stream=await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true }, video:false });
    this.src=ctx.createMediaStreamSource(this.stream); this.proc=ctx.createScriptProcessor(2048,1,1);
    this.proc.onaudioprocess=(e)=>this._onAudio(e.inputBuffer.getChannelData(0));
    this.src.connect(this.proc); this.proc.connect(ctx.createGain()); this.active=true; }
  stop(){ if(!this.active) return;
    try{ this.proc && this.proc.disconnect(); }catch{} try{ this.src && this.src.disconnect(); }catch{}
    try{ this.stream && this.stream.getTracks().forEach(t=>t.stop()); }catch{}
    this.proc=this.src=this.stream=null; this.buf=new Float32Array(0); this.active=false; }
  async enrollKWS(keyword="lolo",seconds=1.2){ await ctxPool.ensure(); const ctx=ctxPool.ctx;
    const stream=await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true }, video:false });
    const src=ctx.createMediaStreamSource(stream); const rec=ctx.createScriptProcessor(2048,1,1); const chunks=[];
    rec.onaudioprocess=e=>chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(rec); rec.connect(ctx.createGain()); await new Promise(r=>setTimeout(r,seconds*1000));
    try{ rec.disconnect(); src.disconnect(); }catch{} stream.getTracks().forEach(t=>t.stop());
    const len=chunks.reduce((s,a)=>s+a.length,0), x=new Float32Array(len); let o=0; for(const a of chunks){ x.set(a,o); o+=a.length; }
    const frames=this._frames(x,this.mfcc.fftSize,this.mfcc.fftSize>>1).map(f=>this.mfcc.extract(f));
    this.templates[keyword]=frames; return{ok:true,keyword,frames:frames.length}; }
  _onAudio(x){ const keep=this.mfcc.sampleRate; const concat=new Float32Array(Math.min(keep,this.buf.length+x.length));
    const overlap=Math.max(0,concat.length-x.length); if(overlap) concat.set(this.buf.subarray(this.buf.length-overlap)); concat.set(x,overlap); this.buf=concat;
    const frames=this._frames(this.buf,this.mfcc.fftSize,this.mfcc.fftSize>>1); if(frames.length<10) return;
    const mf=frames.map(f=>this.mfcc.extract(f)); let best=null;
    for(const [kw,t] of Object.entries(this.templates)){ if(!t) continue; const d=dtw(mf,t); const score=1/(1+d); if(!best||score>best.score) best={kw,score}; }
    if(best && best.score>=0.65) bus.emit("wake:hit",{phrase:best.kw,score:best.score,source:"kws"}); }
  _frames(sig,size,hop){ const out=[]; for(let i=0;i+size<=sig.length;i+=hop) out.push(sig.subarray(i,i+size)); return out; }
}
export const kws = once("kws", ()=> new LocalKWS());