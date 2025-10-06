/* Owner Voiceprint gate: MFCC enroll/match, status flip via bus. */
import { bus } from "../core/eventBus.js";
import { device } from "../core/device.js";
import { MFCC } from "../audio/mfcc.js";

const KEY = "chango_owner_vp";

export class VoiceGate {
  constructor({ sr = device.sampleRateHint, fftSize = 1024, melBands = 24, coeffs = 13, thresh = 0.82 } = {}) {
    this.sr = sr; 
    this.mfcc = new MFCC({ fftSize, sampleRate: sr, melBands, coeffs });
    this.vp = null; 
    this.enabled = false; 
    this.thresh = thresh;
    this._load();
  }
  
  _load() { 
    try { 
      const arr = JSON.parse(localStorage.getItem(KEY) || "[]"); 
      if (arr.length) this.vp = new Float32Array(arr); 
    } catch {} 
    this._emitStatus(); 
  }
  
  _save() { 
    try { 
      localStorage.setItem(KEY, JSON.stringify(Array.from(this.vp || []))); 
    } catch {} 
  }
  
  _emitStatus() { 
    bus.emit("status", `Owner: ${this.enabled ? (this.vp ? "LOCKED" : "UNENROLLED") : "UNLOCKED"}`); 
  }
  
  enable(on = true) { 
    this.enabled = !!on; 
    this._emitStatus(); 
  }
  
  clear() { 
    this.vp = null; 
    this._save(); 
    this._emitStatus(); 
  }
  
  async enroll(seconds = 3) {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: true, noiseSuppression: true }, 
      video: false 
    });
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: this.sr });
    const src = ctx.createMediaStreamSource(stream);
    const rec = ctx.createScriptProcessor(2048, 1, 1);
    const chunks = [];
    rec.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(rec); 
    rec.connect(ctx.destination);
    await new Promise(r => setTimeout(r, seconds * 1000));
    try { rec.disconnect(); src.disconnect(); } catch {}
    stream.getTracks().forEach(t => t.stop());
    const len = chunks.reduce((s, a) => s + a.length, 0);
    const x = new Float32Array(len); 
    let o = 0; 
    for (const a of chunks) { 
      x.set(a, o); 
      o += a.length; 
    }
    const frames = []; 
    for (let i = 0; i + this.mfcc.fftSize <= x.length; i += (this.mfcc.fftSize >> 1)) {
      frames.push(x.subarray(i, i + this.mfcc.fftSize));
    }
    this.vp = this.mfcc.voiceprint(frames);
    this._save(); 
    this.enable(true);
    return { ok: true, coeffs: this.vp.length };
  }
  
  check(sample, sr = this.sr) {
    if (!this.enabled || !this.vp) return true;
    const mf = (sr === this.mfcc.sampleRate) ? this.mfcc : new MFCC({ 
      fftSize: this.mfcc.fftSize, 
      sampleRate: sr, 
      melBands: this.mfcc.melBands, 
      coeffs: this.mfcc.coeffs 
    });
    const frames = []; 
    for (let i = 0; i + mf.fftSize <= sample.length; i += (mf.fftSize >> 1)) {
      frames.push(sample.subarray(i, i + mf.fftSize));
    }
    const cur = mf.voiceprint(frames);
    const score = mf.cosine(this.vp, cur);
    bus.emit("diag:info", { where: "voicegate", score });
    return score >= this.thresh;
  }
}

export const voiceGate = new VoiceGate();

// Optional console helpers (no UI change)
window.ChangoVoice = {
  enroll: (s = 3) => voiceGate.enroll(s),
  enableGate: (on = true) => voiceGate.enable(on),
  clearGate: () => voiceGate.clear()
};