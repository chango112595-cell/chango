// Energy + spectral flux VAD with hysteresis; emits speech_start / speech_end
export type VadEvent = { type:'speech_start'|'speech_end'; level:number };
type Listener = (e:VadEvent)=>void;

export class VAD {
  private ctx?: AudioContext;
  private analyser?: AnalyserNode;
  private source?: MediaStreamAudioSourceNode;
  private prevSpec?: Float32Array;
  private listeners = new Set<Listener>();
  private speaking=false;
  private energyAlpha=0.9;
  private avgEnergy=0;

  on(fn:Listener){ this.listeners.add(fn); return ()=>this.listeners.delete(fn); }
  private emit(ev:VadEvent){ this.listeners.forEach(l => l(ev)); }

  async start(stream?:MediaStream){
    if(this.ctx) return;
    this.ctx=new (window.AudioContext || (window as any).webkitAudioContext)();
    const ms = stream ?? await navigator.mediaDevices.getUserMedia({audio:true});
    this.source=this.ctx.createMediaStreamSource(ms);
    this.analyser=this.ctx.createAnalyser();
    this.analyser.fftSize=1024;
    this.source.connect(this.analyser);
    this.loop();
  }

  stop(){ this.ctx?.close(); this.ctx=undefined; this.analyser=undefined; this.source=undefined; this.speaking=false; }

  private async loop(){
    if(!this.analyser) return;
    const spec = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(spec);

    const energy = spec.reduce((s,v)=> s + Math.pow(10, v/20), 0)/spec.length;
    this.avgEnergy = this.energyAlpha*this.avgEnergy + (1-this.energyAlpha)*energy;

    let flux=0;
    if(this.prevSpec){
      for(let i=0;i<spec.length;i++){
        const m = Math.pow(10, spec[i]/20);
        const p = Math.pow(10, this.prevSpec[i]/20);
        flux += Math.max(0, m-p);
      }
      flux/=spec.length;
    }
    this.prevSpec = spec;

    const level = 0.7*energy + 0.3*flux;
    const thOn  = Math.max(0.002, 2.5*this.avgEnergy);
    const thOff = Math.max(0.001, 1.3*this.avgEnergy);

    if(!this.speaking && level > thOn){ this.speaking=true; this.emit({type:'speech_start', level}); }
    else if(this.speaking && level < thOff){ this.speaking=false; this.emit({type:'speech_end', level}); }

    requestAnimationFrame(()=>this.loop());
  }
}