// Energy + spectral flux VAD with hysteresis; emits speech_start / speech_end
import { debugBus } from '../dev/debugBus';
import { FEATURES } from '../config/features';
import { beat } from '../dev/health/monitor';

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
    
    // Emit VAD initialization
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('VAD', 'initialization_start', { withStream: !!stream });
    }
    beat('vad', { action: 'init_start' });
    
    this.ctx=new (window.AudioContext || (window as any).webkitAudioContext)();
    const ms = stream ?? await navigator.mediaDevices.getUserMedia({
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true, 
        autoGainControl: true 
      }
    });
    this.source=this.ctx.createMediaStreamSource(ms);
    this.analyser=this.ctx.createAnalyser();
    this.analyser.fftSize=1024;
    this.source.connect(this.analyser);
    
    // Emit VAD start monitoring
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('VAD', 'monitoring_started', { 
        sampleRate: this.ctx.sampleRate,
        fftSize: this.analyser.fftSize 
      });
    }
    beat('vad', { action: 'monitoring_started' });
    
    this.loop();
  }

  stop(){ 
    // Emit VAD stop monitoring
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('VAD', 'monitoring_stopped', { wasSpeaking: this.speaking });
    }
    beat('vad', { action: 'monitoring_stopped' });
    
    this.ctx?.close(); 
    this.ctx=undefined; 
    this.analyser=undefined; 
    this.source=undefined; 
    this.speaking=false; 
  }

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
    // Increased thresholds for better noise rejection
    const thOn  = Math.max(0.003, 3.5*this.avgEnergy); // Increased from 2.5x to 3.5x
    const thOff = Math.max(0.002, 1.8*this.avgEnergy); // Increased from 1.3x to 1.8x

    if(!this.speaking && level > thOn){ 
      this.speaking=true; 
      
      // Emit speech start with energy/flux data
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('VAD', 'speech_start', { 
          level, 
          energy, 
          flux, 
          threshold: thOn 
        });
      }
      beat('vad', { action: 'speech_start', level });
      
      this.emit({type:'speech_start', level}); 
    }
    else if(this.speaking && level < thOff){ 
      this.speaking=false; 
      
      // Emit speech end with energy/flux data
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('VAD', 'speech_end', { 
          level, 
          energy, 
          flux, 
          threshold: thOff 
        });
      }
      beat('vad', { action: 'speech_end', level });
      
      this.emit({type:'speech_end', level}); 
    }

    requestAnimationFrame(()=>this.loop());
  }
}