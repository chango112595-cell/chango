// VAD + permission validator + auto-recovery.
import { eventBus as bus } from "../core/eventBus.js";
import { audioContextPool as ctxPool } from "./contextPool.js";
import { device } from "../core/device.js";

export class VAD {
  constructor({ startThresh = 0.015, stopThresh = 0.008, minHoldMs = 150 } = {}) {
    this.startT = startThresh; this.stopT = stopThresh; this.minHold = minHoldMs / 1000;
    this.media = null; this.node = null; this.state = "idle"; this.lastStart = 0; this.stream = null; this._recoveryTimer = null;
  }
  async _getStream() { 
    try { 
      return await navigator.mediaDevices.getUserMedia({ audio: device.micConstraints, video: false }); 
    } catch (e) {
      bus.emit("diag:error", {where: "getUserMedia", e: e?.name || e?.message || e});
      throw e;
    }
  }
  async start() {
    await ctxPool.ensure(); const ctx = ctxPool.getContext();
    try { this.stream = await this._getStream(); } catch { return; }
    this.media = ctx.createMediaStreamSource(this.stream);
    const proc = ctx.createScriptProcessor(1024, 1, 1);
    const prev = new Float32Array(512); let prevMag = 0;
    proc.onaudioprocess = (e) => {
      const x = e.inputBuffer.getChannelData(0);
      let energy = 0; for (let i = 0; i < x.length; i++) energy += x[i] * x[i]; energy /= x.length;
      let mag = 0; for (let i = 0; i < prev.length; i++) mag += Math.abs(x[i] - prev[i]); prev.set(x.subarray(0, prev.length));
      const flux = Math.abs(mag - prevMag); prevMag = mag;
      const score = 0.85 * energy + 0.15 * (flux / prev.length);
      const t = ctx.currentTime;
      if (this.state === "idle" && score > this.startT) { this.state = "speech"; this.lastStart = t; bus.emit("vad:start", { t, energy: score }); }
      else if (this.state === "speech" && score < this.stopT && (t - this.lastStart) > this.minHold) { this.state = "idle"; bus.emit("vad:stop", { t, energy: score }); }
    };
    this.media.connect(proc); proc.connect(ctxPool.node()); this.node = proc;
    this._watchPermission();
  }
  async _watchPermission() {
    try {
      const perms = await navigator.permissions.query({ name: "microphone" });
      const onChange = () => {
        if (perms.state === "denied") { bus.emit("diag:warn", {where: "mic", msg: "permission denied"}); this._attemptRecover(); }
      };
      perms.onchange = onChange;
    } catch {}
  }
  _attemptRecover() {
    clearTimeout(this._recoveryTimer);
    this._recoveryTimer = setTimeout(async () => {
      try { this.stop(); await this.start(); bus.emit("diag:info", {where: "mic", msg: "auto-recovered"}); }
      catch(e) { bus.emit("diag:error", {where: "mic", msg: "recovery failed", e: e?.message}); }
    }, 2000);
  }
  stop() {
    try { this.node && this.node.disconnect(); } catch {}
    try { this.media && this.media.disconnect(); } catch {}
    try { this.stream && this.stream.getTracks().forEach(t => t.stop()); } catch {}
    this.node = null; this.media = null; this.stream = null; this.state = "idle";
  }
}