/* Telemetry collector: aggregates counters and beacons to server; powers HUD JSON. */
import { bus } from "../core/eventBus.js";
import { device } from "../core/device.js";

export class Telemetry {
  constructor({ intervalMs = 10000 } = {}) {
    this.t = null; 
    this.intervalMs = intervalMs;
    this.payload = {
      session: { id: Math.random().toString(36).slice(2), start: new Date().toISOString() },
      device: { type: device.isCar ? "car" : device.isMobile ? "mobile" : "desktop", sampleRate: device.sampleRateHint },
      tts: { success: 0, error: 0, ms: 0 },
      stt: { interim: 0, final: 0, error: 0 },
      vad: { sessions: 0, active: false },
      mic: { denied: 0, recovered: 0 },
      diag: { errors: 0, warns: 0, infos: 0 }
    };
    this._wire();
    this._schedule();
    window.addEventListener("beforeunload", () => this._beacon(true));
  }
  
  _wire() {
    bus.on("vad:start", () => { 
      if (!this.payload.vad.active) { 
        this.payload.vad.active = true; 
        this.payload.vad.sessions++; 
      } 
    });
    bus.on("vad:stop",  () => { this.payload.vad.active = false; });
    bus.on("stt:result", (e) => { 
      if (e?.final) this.payload.stt.final++; 
      else this.payload.stt.interim++; 
    });
    bus.on("stt:unavailable", () => { this.payload.stt.error++; });
    bus.on("diag:error", () => { this.payload.diag.errors++; });
    bus.on("diag:warn",  () => { this.payload.diag.warns++;  });
    bus.on("diag:info",  () => { this.payload.diag.infos++;  });
    bus.on("tts:end", (ms) => { 
      this.payload.tts.ms += (ms || 0); 
      this.payload.tts.success++; 
    });
    bus.on("tts:fail",   () => { this.payload.tts.error++; });
    bus.on("mic:denied", () => { this.payload.mic.denied++; });
    bus.on("mic:recovered", () => { this.payload.mic.recovered++; });
  }
  
  _schedule() { 
    clearInterval(this.t); 
    this.t = setInterval(() => this._beacon(false), this.intervalMs); 
  }
  
  _beacon(final) {
    const out = { 
      ...this.payload, 
      session: { 
        ...this.payload.session, 
        end: new Date().toISOString(), 
        final: !!final 
      } 
    };
    try {
      const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/telemetry", blob);
      } else {
        fetch("/api/telemetry", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify(out) 
        });
      }
    } catch {}
  }
  
  snapshot() { 
    return JSON.parse(JSON.stringify(this.payload)); 
  }
}

export const telemetry = new Telemetry();