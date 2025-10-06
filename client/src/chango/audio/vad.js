// Short-time energy + spectral flux VAD with hysteresis; emits vad:start/stop
import { eventBus as bus } from "../core/eventBus.js";
import { audioContextPool as ctxPool } from "./contextPool.js";

export class VAD {
  constructor({ winMs = 20, hopMs = 10, startThresh = 0.015, stopThresh = 0.008, minHoldMs = 150 } = {}) {
    this.win = winMs / 1000; this.hop = hopMs / 1000;
    this.startT = startThresh; this.stopT = stopThresh;
    this.minHold = minHoldMs / 1000;
    this.media = null; this.node = null; this.state = "idle"; this.lastStart = 0;
  }
  async start() {
    await ctxPool.unlock();
    const ctx = ctxPool.getContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    this.media = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(1024, 1, 1);
    const prev = new Float32Array(512); let prevMag = 0;
    proc.onaudioprocess = (e) => {
      const x = e.inputBuffer.getChannelData(0);
      let energy = 0;
      for (let i = 0; i < x.length; i++) energy += x[i] * x[i];
      energy /= x.length;
      // spectral flux (very cheap)
      let mag = 0;
      for (let i = 0; i < prev.length; i++) mag += Math.abs(x[i] - prev[i]);
      prev.set(x.subarray(0, prev.length));
      const flux = Math.abs(mag - prevMag); prevMag = mag;

      const score = 0.85 * energy + 0.15 * (flux / prev.length);
      const t = ctx.currentTime;
      if (this.state === "idle" && score > this.startT) {
        this.state = "speech"; this.lastStart = t; bus.emit("vad:start", { t, energy: score });
      } else if (this.state === "speech" && score < this.stopT && (t - this.lastStart) > this.minHold) {
        this.state = "idle"; bus.emit("vad:stop", { t, energy: score });
      }
    };
    this.media.connect(proc); proc.connect(ctxPool.getMasterGain());
    this.node = proc;
  }
  stop() {
    try { this.node && this.node.disconnect(); } catch {}
    try { this.media && this.media.disconnect(); } catch {}
    this.node = null; this.media = null; this.state = "idle";
  }
}