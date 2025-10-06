export class AudioContextPool {
  constructor({ sampleRate = 48000 } = {}) { this.sampleRate = sampleRate; this.ctx = null; this.master = null; this.unlocked = false; }
  async ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx({ sampleRate: this.sampleRate });
      this.master = this.ctx.createGain(); this.master.gain.value = 1; this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }
  async unlock() { await this.ensure(); if (this.ctx.state === "suspended") await this.ctx.resume(); this.unlocked = true; }
  getContext() { return this.ctx; }
  getMasterGain() { return this.master; }
  node() { return this.master; }
  async stop() { if (this.ctx) { try { await this.ctx.close(); } catch {} } this.ctx = null; this.master = null; this.unlocked = false; }
}
export const audioContextPool = new AudioContextPool();
export const ctxPool = audioContextPool; // for compatibility