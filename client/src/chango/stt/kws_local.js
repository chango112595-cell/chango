/* Local keyword spotter (offline, no UI change).
 * Detects "lolo" / "chango" via MFCC + DTW. Emits bus events: wake:hit, cmd (optional).
 */
import { bus } from "../core/eventBus.js";
import { audioContextPool as ctxPool } from "../audio/contextPool.js";
import { MFCC } from "../audio/mfcc.js";

function dtw(a, b) {
  const n = a.length, m = b.length; 
  const D = Array.from({length:n+1},()=>new Float32Array(m+1).fill(Infinity));
  D[0][0]=0;
  const dist = (x,y)=>{ 
    let s=0; 
    for(let i=0;i<x.length;i++){ 
      const d=x[i]-y[i]; 
      s+=d*d; 
    } 
    return Math.sqrt(s); 
  };
  for(let i=1;i<=n;i++){
    for(let j=1;j<=m;j++){
      const cost = dist(a[i-1], b[j-1]);
      D[i][j] = cost + Math.min(D[i-1][j], D[i][j-1], D[i-1][j-1]);
    }
  }
  const norm = D[n][m]/(n+m);
  return norm;
}

export class LocalKWS {
  constructor({ win = 0.025, hop = 0.010, scoreThresh = 0.65 } = {}) {
    this.mfcc = new MFCC({ fftSize: 1024, sampleRate: 48000, melBands: 24, coeffs: 13 });
    this.stream = null; 
    this.src = null; 
    this.proc = null;
    this.buf = new Float32Array(0);
    this.win = win; 
    this.hop = hop; 
    this.th = scoreThresh;
    this.templates = { lolo: null, chango: null };
    // built-in minimal templates (rough shapes; recommend enrollKWS to replace)
    this.templates.lolo   = Array.from({length:14},(_,i)=> new Float32Array(this.mfcc.coeffs).fill(Math.sin(i)));
    this.templates.chango = Array.from({length:18},(_,i)=> new Float32Array(this.mfcc.coeffs).fill(Math.cos(i)));
  }

  async start() {
    await ctxPool.ensure(); 
    const ctx = ctxPool.ctx;
    this.stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: true, noiseSuppression: true }, 
      video: false 
    });
    this.src = ctx.createMediaStreamSource(this.stream);
    this.proc = ctx.createScriptProcessor(2048, 1, 1);
    this.proc.onaudioprocess = (e) => this._onAudio(e.inputBuffer.getChannelData(0));
    this.src.connect(this.proc); 
    this.proc.connect(ctx.createGain());
  }

  stop() {
    try { this.proc && this.proc.disconnect(); } catch {}
    try { this.src && this.src.disconnect(); } catch {}
    try { this.stream && this.stream.getTracks().forEach(t=>t.stop()); } catch {}
    this.proc = null; 
    this.src = null; 
    this.stream = null; 
    this.buf = new Float32Array(0);
  }

  async enrollKWS(keyword = "lolo", seconds = 1.2) {
    await ctxPool.ensure(); 
    const ctx = ctxPool.ctx;
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: true, noiseSuppression: true }, 
      video: false 
    });
    const src = ctx.createMediaStreamSource(stream);
    const rec = ctx.createScriptProcessor(2048, 1, 1);
    const chunks = [];
    rec.onaudioprocess = e => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(rec); 
    rec.connect(ctx.createGain());
    await new Promise(r => setTimeout(r, seconds * 1000));
    try { rec.disconnect(); src.disconnect(); } catch {}
    stream.getTracks().forEach(t => t.stop());
    const len = chunks.reduce((s,a)=>s+a.length,0);
    const x=new Float32Array(len); 
    let o=0; 
    for(const a of chunks){ 
      x.set(a,o); 
      o+=a.length; 
    }
    const frames = this._frames(x, this.mfcc.fftSize, this.mfcc.fftSize>>1).map(f=>this.mfcc.extract(f));
    this.templates[keyword] = frames;
    return { ok: true, keyword, frames: frames.length };
  }

  _onAudio(x) {
    const concat = new Float32Array(this.buf.length + x.length);
    concat.set(this.buf,0); 
    concat.set(x,this.buf.length);
    this.buf = concat;

    const hop = this.mfcc.fftSize >> 1;
    const frames = this._frames(this.buf, this.mfcc.fftSize, hop);
    if (frames.length < 10) return;

    const mfccSeq = frames.map(f => this.mfcc.extract(f));
    const hits = [];
    for (const [kw, tmpl] of Object.entries(this.templates)) {
      if (!tmpl) continue;
      const d = dtw(mfccSeq, tmpl);
      const score = 1 / (1 + d); // smaller distance → higher score
      if (score >= this.th) hits.push({ kw, score });
    }
    if (hits.length) {
      const best = hits.sort((a,b)=>b.score-a.score)[0];
      bus.emit("wake:hit", { phrase: best.kw, score: best.score, source: "kws" });
      // After wake, we don't guess command here; STT will take over immediately.
      this._shrinkBuffer(); // keep latency small
    }

    // keep last ~1s
    const keep = Math.min(this.buf.length, this.mfcc.sampleRate * 1.0);
    if (this.buf.length > keep) this.buf = this.buf.slice(this.buf.length - keep);
  }

  _frames(sig, size, hop) {
    const out = [];
    for (let i=0;i+size<=sig.length;i+=hop) {
      const slice = sig.subarray(i, i+size);
      out.push(slice);
    }
    return out;
  }

  _shrinkBuffer(){ 
    this.buf = new Float32Array(0); 
  }
}

export const kws = new LocalKWS();

// Console helpers for enrollment
window.ChangoKWS = {
  enroll: (keyword = "lolo", seconds = 1.2) => kws.enrollKWS(keyword, seconds),
  start: () => kws.start(),
  stop: () => kws.stop()
};