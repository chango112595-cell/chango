import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "telemetry");
const DATA_FILE = path.join(DATA_DIR, "runtime.json");

let _last = { ts: null, payload: null };

function ensureDir() { try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {} }
function loadFromDisk() {
  try { if (fs.existsSync(DATA_FILE)) { const p = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); _last = { ts: Date.now(), payload: p }; } } catch {}
}
function saveToDisk(payload) { try { ensureDir(); fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2)); } catch {} }

export function setHUD(payload) { _last = { ts: Date.now(), payload }; saveToDisk(payload); }
export function getHUD() {
  const p = _last.payload || {};
  const stability = pct(p.tts?.success, (p.tts?.success||0)+(p.tts?.error||0));
  const sttQual   = pct(p.stt?.final, (p.stt?.final||0)+(p.stt?.error||0));
  const rec       = p.stt?.recoveries || 0;
  const sttHealth = Math.max(0, 100 - Math.min(100, rec * 15)); // every recovery knocks 15 points
  return {
    updated: _last.ts || 0,
    device: p.device || {},
    metrics: {
      voice_stability: stability,
      stt_quality: sttQual,
      stt_recoveries: rec,
      stt_health: sttHealth,
      last_recovery_ms: p.stt?.last_recovery_ms || 0,
      vad_sessions: p.vad?.sessions || 0,
      mic_denied: p.mic?.denied || 0,
      errors: p.diag?.errors || 0
    }
  };
}
function pct(a=0,b=0){ b=Math.max(1,b); return Math.round((a/b)*100); }
loadFromDisk();