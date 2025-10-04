// Lightweight voiceprint: 13-MFCC mean vector + cosine match (local-only)
export type Voiceprint = {
  sr: number;
  mfccMean: number[];
  frames: number;
  createdAt: number;
  version: 1;
};

const MFCC_BINS = 26;
const MFCC_DIM = 13;

function hzToMel(hz:number){ return 2595 * Math.log10(1+hz/700); }
function melToHz(mel:number){ return 700*(Math.pow(10,mel/2595)-1); }

function buildMelFilters(fftSize:number, sr:number){
  const nfft = fftSize/2;
  const fmin = 20, fmax = sr/2;
  const melMin = hzToMel(fmin), melMax = hzToMel(fmax);
  const mels = Array.from({length: MFCC_BINS+2},(_,i)=> melMin + (i*(melMax-melMin))/(MFCC_BINS+1));
  const hz = mels.map(m=> melToHz(m));
  const bins = hz.map(h=> Math.floor((h/fmax)*nfft));
  const filters:number[][]=[];
  for(let m=1;m<=MFCC_BINS;m++){
    const f:number[] = new Array(nfft).fill(0);
    for(let k=bins[m-1]; k<bins[m]; k++) f[k] = (k - bins[m-1])/(bins[m]-bins[m-1] || 1);
    for(let k=bins[m]; k<bins[m+1]; k++) f[k] = (bins[m+1]-k)/(bins[m+1]-bins[m] || 1);
    filters.push(f);
  }
  return filters;
}

function dct(v:number[], dim=MFCC_DIM){
  const N=v.length, out=new Array(dim).fill(0);
  for(let k=0;k<dim;k++){
    let s=0;
    for(let n=0;n<N;n++) s += v[n]*Math.cos(Math.PI*k*(2*n+1)/(2*N));
    out[k]=s*Math.sqrt(2/N);
  }
  out[0]*=Math.SQRT1_2;
  return out;
}

function cosine(a:number[], b:number[]){
  const N=Math.min(a.length,b.length);
  let dp=0,na=0,nb=0;
  for(let i=0;i<N;i++){ dp+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
  return dp/(Math.sqrt(na)*Math.sqrt(nb)+1e-9);
}

export class VoiceprintEngine {
  private ctx?: AudioContext;
  private analyser?: AnalyserNode;
  private source?: MediaStreamAudioSourceNode;
  private filters?: number[][];
  private buf!: Float32Array;
  private mfccAcc = new Array(MFCC_DIM).fill(0);
  private frames = 0;

  async start(srHint?:number){
    if(this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: srHint});
    const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}});
    this.source = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.buf = new Float32Array(this.analyser.frequencyBinCount);
    this.filters = buildMelFilters(this.analyser.fftSize, this.ctx.sampleRate);
    this.source.connect(this.analyser);
  }

  stop(){
    this.ctx?.close(); this.ctx=undefined; this.analyser=undefined; this.source=undefined;
    this.frames=0; this.mfccAcc.fill(0);
  }

  private frameMFCC(): number[] {
    if(!this.analyser || !this.filters) return new Array(MFCC_DIM).fill(0);
    this.analyser.getFloatFrequencyData(this.buf);
    const mag = Array.from(this.buf, x => Math.pow(10, x/20));
    const mel = this.filters.map(f => {
      let s=0; for(let i=0;i<f.length;i++) s += f[i]*mag[i];
      return Math.log(s+1e-9);
    });
    return dct(mel);
  }

  async enroll(seconds=7): Promise<Voiceprint>{
    if(!this.ctx) await this.start();
    this.frames=0; this.mfccAcc.fill(0);
    const end = performance.now()+seconds*1000;
    while(performance.now()<end){
      const mfcc = this.frameMFCC();
      for(let i=0;i<MFCC_DIM;i++) this.mfccAcc[i]+=mfcc[i];
      this.frames++; await new Promise(r=>setTimeout(r,30));
    }
    const mean = this.mfccAcc.map(x=> x/Math.max(1,this.frames));
    return { sr: this.ctx!.sampleRate, mfccMean: mean, frames: this.frames, createdAt: Date.now(), version: 1 };
  }

  similarity(print: Voiceprint): number {
    const mfcc = this.frameMFCC();
    return cosine(mfcc, print.mfccMean);
  }
}