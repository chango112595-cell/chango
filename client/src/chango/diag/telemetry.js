/**
 * Headless telemetry collector; no UI changes.
 * - Listens to bus events and aggregates counts.
 * - Exposes window.ChangoTelemetry.download() to save `telemetry/runtime.json`.
 */
import { bus } from "../core/eventBus.js";
import { device } from "../core/device.js";

function nowISO(){ return new Date().toISOString(); }
function dlJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
}

export class Telemetry {
  constructor() {
    this.payload = {
      session: { id: Math.random().toString(36).slice(2), start: nowISO() },
      device: { type: device.isCar ? "car" : device.isMobile ? "mobile" : "desktop", sampleRate: device.sampleRateHint },
      tts: { success: 0, error: 0, durations_ms: 0 },
      stt: { interim: 0, final: 0, error: 0 },
      vad: { sessions: 0, active: false },
      mic: { denied: 0, recovered: 0 },
      diag: { errors: 0, warns: 0, infos: 0 }
    };
    this._wire();
    window.ChangoTelemetry = {
      download: () => this.download(),
      snapshot: () => JSON.parse(JSON.stringify(this.payload))
    };
  }
  _wire() {
    bus.on("vad:start", () => { if (!this.payload.vad.active) { this.payload.vad.active = true; this.payload.vad.sessions++; } });
    bus.on("vad:stop", () => { this.payload.vad.active = false; });

    bus.on("stt:result", (e) => { if (!e) return; if (e.final) this.payload.stt.final++; else this.payload.stt.interim++; });
    bus.on("stt:unavailable", () => { this.payload.stt.error++; });

    bus.on("diag:error", () => { this.payload.diag.errors++; });
    bus.on("diag:warn",  () => { this.payload.diag.warns++;  });
    bus.on("diag:info",  () => { this.payload.diag.infos++;  });

    // TTS timing hooks (emit these around synth if desired)
    bus.on("tts:begin", (ms)=>{ /* placeholder for begin ts */ });
    bus.on("tts:end", (ms)=>{ this.payload.tts.durations_ms += (ms||0); this.payload.tts.success++; });
    bus.on("tts:fail", ()=>{ this.payload.tts.error++; });

    // Mic permissions
    // If your VAD emits denial events, count them here:
    bus.on("mic:denied", ()=>{ this.payload.mic.denied++; });
    bus.on("mic:recovered", ()=>{ this.payload.mic.recovered++; });
  }
  download() {
    const out = {
      ...this.payload,
      session: { ...this.payload.session, end: nowISO() }
    };
    dlJSON("runtime.json", out);
  }
}

export const telemetry = new Telemetry();