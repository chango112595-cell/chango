/* WASM STT wrapper (optional). If model files exist at /models/wasm_stt/,
 * it will activate and emit final transcripts. Otherwise, it remains disabled.
 * API: available(), start(), stop()
 */
import { bus } from "../core/eventBus.js";
import { audioContextPool as ctxPool } from "../audio/contextPool.js";

export class WasmSTT {
  constructor() {
    this.model = null;
    this.stream = null;
    this.src = null;
    this.proc = null;
    this.active = false;
    this.modelPath = "/models/wasm_stt/";
    this._checkModel();
  }

  async _checkModel() {
    try {
      // Check if model files exist
      const resp = await fetch(this.modelPath + "model.json");
      if (resp.ok) {
        bus.emit("diag:info", { where: "wasm_stt", msg: "model files found, ready to load" });
        // In a real implementation, load the WASM model here
        // For now, we'll just mark it as potentially available
        this.model = "placeholder";
      } else {
        bus.emit("diag:info", { where: "wasm_stt", msg: "no model files, staying idle" });
      }
    } catch {
      // Model files don't exist, stay disabled
      this.model = null;
    }
  }

  available() {
    return this.model !== null;
  }

  async start() {
    if (!this.available()) {
      bus.emit("diag:warn", { where: "wasm_stt", msg: "cannot start, no model loaded" });
      return false;
    }

    await ctxPool.ensure();
    const ctx = ctxPool.ctx;
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false
      });
      
      this.src = ctx.createMediaStreamSource(this.stream);
      this.proc = ctx.createScriptProcessor(4096, 1, 1);
      
      // Buffer for accumulating audio
      this.audioBuffer = [];
      this.silenceCounter = 0;
      
      this.proc.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        this._processAudio(data);
      };
      
      this.src.connect(this.proc);
      this.proc.connect(ctx.createGain());
      
      this.active = true;
      bus.emit("diag:info", { where: "wasm_stt", msg: "started" });
      return true;
    } catch (e) {
      bus.emit("diag:error", { where: "wasm_stt", msg: `start failed: ${e.message}` });
      return false;
    }
  }

  stop() {
    try { this.proc && this.proc.disconnect(); } catch {}
    try { this.src && this.src.disconnect(); } catch {}
    try { this.stream && this.stream.getTracks().forEach(t => t.stop()); } catch {}
    
    this.proc = null;
    this.src = null;
    this.stream = null;
    this.active = false;
    this.audioBuffer = [];
    
    bus.emit("diag:info", { where: "wasm_stt", msg: "stopped" });
  }

  _processAudio(data) {
    if (!this.active || !this.model) return;
    
    // Simple energy-based silence detection
    const energy = data.reduce((sum, val) => sum + Math.abs(val), 0) / data.length;
    const isSilent = energy < 0.01;
    
    if (!isSilent) {
      // Add audio to buffer
      this.audioBuffer.push(...data);
      this.silenceCounter = 0;
    } else {
      this.silenceCounter++;
      
      // If we have audio buffered and silence for ~500ms, process it
      if (this.audioBuffer.length > 4096 && this.silenceCounter > 5) {
        this._runInference();
        this.audioBuffer = [];
        this.silenceCounter = 0;
      }
    }
    
    // Limit buffer size to prevent memory issues
    if (this.audioBuffer.length > 48000 * 10) { // 10 seconds max
      this._runInference();
      this.audioBuffer = [];
    }
  }

  _runInference() {
    // In a real implementation, this would run WASM inference
    // For now, emit a placeholder event
    if (this.audioBuffer.length > 4096) {
      // Simulate transcription (would be actual WASM model inference)
      const simulatedText = "wasm transcription placeholder";
      bus.emit("stt:result", { 
        text: simulatedText, 
        final: true, 
        source: "wasm" 
      });
      bus.emit("diag:info", { 
        where: "wasm_stt", 
        msg: `processed ${Math.round(this.audioBuffer.length/48000*1000)}ms of audio` 
      });
    }
  }

  // Method to load a custom WASM model (for future use)
  async loadModel(modelUrl) {
    try {
      // In a real implementation, load WASM model here
      bus.emit("diag:info", { where: "wasm_stt", msg: `loading model from ${modelUrl}` });
      // For now, just mark as loaded
      this.model = modelUrl;
      return true;
    } catch (e) {
      bus.emit("diag:error", { where: "wasm_stt", msg: `model load failed: ${e.message}` });
      return false;
    }
  }
}

export const wasmSTT = new WasmSTT();

// Console helpers
window.ChangoWasmSTT = {
  available: () => wasmSTT.available(),
  start: () => wasmSTT.start(),
  stop: () => wasmSTT.stop(),
  loadModel: (url) => wasmSTT.loadModel(url)
};

// Auto-fallback: if main STT fails, try WASM if available
bus.on("stt:unavailable", () => {
  if (wasmSTT.available() && !wasmSTT.active) {
    bus.emit("diag:info", { where: "wasm_stt", msg: "main STT unavailable, activating WASM fallback" });
    wasmSTT.start();
  }
});