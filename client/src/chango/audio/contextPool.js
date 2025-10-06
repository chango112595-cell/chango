import { device } from "../core/device.js";

export class AudioContextPool {
  constructor({ sampleRate = device.sampleRateHint } = {}) { 
    this.sampleRate = sampleRate; 
    this.ctx = null; 
    this.master = null; 
    this.unlocked = false; 
    this._suspendTimer = null; 
  }
  async ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx({ sampleRate: this.sampleRate });
      this.master = this.ctx.createGain(); 
      this.master.gain.value = 1; 
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }
  async unlock() { 
    await this.ensure(); 
    if (this.ctx.state === "suspended") { 
      await this.ctx.resume(); 
    } 
    this.unlocked = true; 
    this._autoSuspend(); 
  }
  getContext() { return this.ctx; }
  getMasterGain() { return this.master; }
  node() { return this.master; }
  _autoSuspend() { 
    clearTimeout(this._suspendTimer); 
    this._suspendTimer = setTimeout(async () => { 
      try { 
        if (this.ctx && this.unlocked && this.ctx.state === "running") { 
          await this.ctx.suspend(); 
        } 
      } catch {} 
    }, 30000); 
  }
  async stop() { 
    clearTimeout(this._suspendTimer); 
    if (this.ctx) { 
      try { await this.ctx.close(); } catch {} 
    } 
    this.ctx = null; 
    this.master = null; 
    this.unlocked = false; 
  }
}
export const audioContextPool = new AudioContextPool();
export const ctxPool = audioContextPool; // for compatibility