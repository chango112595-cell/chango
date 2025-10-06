// Advanced local TTS: LF-glottal-ish source + 3 formants + nasal/aspiration; coarticulation smoothing
import { audioContextPool as ctxPool } from "../audio/contextPool.js";

const VOWELS = {
  iy: [270, 2290, 3010], 
  ih: [390, 1990, 2550], 
  eh: [530, 1840, 2480], 
  ae: [660, 1720, 2410],
  aa: [730, 1090, 2440], 
  ah: [570, 1580, 2410], 
  ao: [570, 840, 2410], 
  uh: [440, 1020, 2240],
  uw: [300, 870, 2240], 
  ow: [360, 940, 2280], 
  ey: [530, 1830, 2480], 
  ay: [660, 1720, 2410], 
  oy: [500, 1400, 2400], 
  er: [490, 1350, 1690]
};

const CONS_CENTERS = { 
  f: 8000, s: 6000, sh: 3500, th: 4000, v: 7000, z: 5000, zh: 3000, 
  ch: 3000, jh: 2300, h: 2000, k: 1800, g: 1500, t: 2500, d: 2000, 
  p: 2800, b: 2400, m: 700, n: 700, l: 1000, r: 500, w: 600, y: 1000, ng: 500 
};

export class FormantSynth {
  constructor() { 
    this.ctx = null; 
    this.master = null; 
    this.voices = { baseHz: 120 }; 
  }
  
  async ensure() { 
    await ctxPool.unlock(); 
    this.ctx = ctxPool.getContext(); 
    this.master = ctxPool.getMasterGain(); 
  }
  
  async speak(timeline, { rate = 1, pitch = 1, volume = 1 } = {}) {
    await this.ensure(); 
    this.master && (this.master.gain.value = volume);
    const start = this.ctx.currentTime + 0.02;
    let t = start;
    for (const item of timeline) {
      const d = (item.dur || 0.08) / rate;
      if (item.ph === "pau") { 
        t += d; 
        continue; 
      }
      await this.renderPhone(item, t, d, pitch);
      t += d * 0.92;
    }
    return new Promise(res => setTimeout(res, (t - this.ctx.currentTime) * 1000));
  }
  
  async renderPhone(item, t, d, pitch) {
    if (isVowel(item.ph)) {
      this.renderVowel(item.ph, t, d, pitch, item.gain || 0.22);
    } else {
      this.renderConsonant(item.ph, t, d, pitch, item.gain || 0.12);
    }
  }
  
  renderVowel(v, t, d, pitch, gain = 0.22) {
    const ctx = this.ctx; 
    const src = ctx.createOscillator();
    src.type = "sawtooth"; 
    src.frequency.setValueAtTime((this.voices.baseHz || 120) * pitch, t);

    // LF-ish glottal jitter/lfo
    const lfo = ctx.createOscillator(); 
    lfo.type = "triangle"; 
    lfo.frequency.value = 5 + Math.random() * 2;
    const lfoG = ctx.createGain(); 
    lfoG.gain.value = 0.006; 
    lfo.connect(lfoG); 
    lfoG.connect(src.frequency);

    const pre = ctx.createGain(); 
    pre.gain.value = gain;
    const [f1, f2, f3] = VOWELS[v] || VOWELS.ah;
    const b1 = bandpass(ctx, f1 * pitch, 20);
    const b2 = bandpass(ctx, f2 * pitch, 40);
    const b3 = bandpass(ctx, f3 * pitch, 60);
    const nasal = bandpass(ctx, 250, 8); // nasal resonance
    
    src.connect(pre); 
    pre.connect(b1); 
    pre.connect(b2); 
    pre.connect(b3); 
    pre.connect(nasal);
    
    const sum = ctx.createGain(); 
    b1.connect(sum); 
    b2.connect(sum); 
    b3.connect(sum); 
    nasal.connect(sum);
    
    // aspiration
    const asp = noise(ctx); 
    const hp = ctx.createBiquadFilter(); 
    hp.type = "highpass"; 
    hp.frequency.value = 6000; 
    asp.connect(hp); 
    hp.connect(sum); 

    const env = ctx.createGain(); 
    env.gain.value = 0.0001; 
    sum.connect(env); 
    env.connect(this.master);
    
    // coarticulation-friendly ADSR
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1.0, t + Math.min(0.015, d * 0.2));
    env.gain.setValueAtTime(1.0, t + Math.max(0.01, d * 0.7));
    env.gain.exponentialRampToValueAtTime(0.0001, t + d);

    src.start(t); 
    lfo.start(t);
    src.stop(t + d); 
    lfo.stop(t + d);
  }
  
  renderConsonant(ph, t, d, pitch, gain = 0.12) {
    const ctx = this.ctx; 
    const n = noise(ctx);
    const bp = bandpass(ctx, CONS_CENTERS[ph] || 2000, 100);
    const g = ctx.createGain(); 
    g.gain.value = gain; 
    n.connect(bp); 
    bp.connect(g); 
    g.connect(this.master);

    const atk = Math.min(0.006, d * 0.3);
    const rel = Math.min(0.03, d * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d - rel);

    if (["m", "n", "l", "r", "v", "z", "w", "y", "jh", "zh", "ng"].includes(ph)) {
      const osc = ctx.createOscillator(); 
      osc.type = "triangle"; 
      osc.frequency.value = 100 * pitch;
      const vg = ctx.createGain(); 
      vg.gain.value = 0.06; 
      osc.connect(vg); 
      vg.connect(this.master);
      osc.start(t); 
      osc.stop(t + d);
    }
    n.start(t); 
    n.stop(t + d);
  }
}

function bandpass(ctx, freq, Q) { 
  const f = ctx.createBiquadFilter(); 
  f.type = "bandpass"; 
  f.frequency.value = freq; 
  f.Q.value = Q; 
  return f; 
}

function noise(ctx) { 
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); 
  const d = b.getChannelData(0); 
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * 0.6; 
  }
  const s = ctx.createBufferSource(); 
  s.buffer = b; 
  s.loop = true; 
  return s; 
}

function isVowel(ph) { 
  return Object.prototype.hasOwnProperty.call(VOWELS, ph); 
}