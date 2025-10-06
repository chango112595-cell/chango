#!/usr/bin/env node
/**
 * Refresh docs from runtime telemetry snapshot: telemetry/runtime.json
 * Appends "Auto Status (telemetry)" to TASK_MASTER_CURRENT.md and a brief handover entry.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const stamp = () => new Date().toISOString();
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const append = (p, s) => fs.appendFileSync(p, s, "utf8");

function safePct(num) { return isFinite(num) && num>=0 ? Math.max(0, Math.min(100, Math.round(num))) : 0; }

function deriveStatus(t) {
  // Inputs expected from telemetry.js (see below)
  const tts_ok = t.tts.success || 0;
  const tts_err = t.tts.error || 0;
  const stt_final = t.stt.final || 0;
  const stt_interim = t.stt.interim || 0;
  const stt_err = t.stt.error || 0;
  const vad_sessions = t.vad.sessions || 0;
  const mic_denied = t.mic.denied || 0;

  const voice_stability = safePct((tts_ok / Math.max(1, (tts_ok + tts_err))) * 100);
  const stt_quality = safePct((stt_final / Math.max(1, (stt_final + stt_err))) * 100);
  const hands_free = vad_sessions > 0 ? 100 : 0;
  const mic_health = mic_denied === 0 ? 100 : Math.max(0, 100 - mic_denied * 5);

  return { voice_stability, stt_quality, hands_free, mic_health };
}

(function main(){
  const telPath = path.join(ROOT, "telemetry", "runtime.json");
  if (!fs.existsSync(telPath)) {
    console.error(`Telemetry file not found: ${telPath}`);
    process.exit(1);
  }
  const t = readJSON(telPath);
  const s = deriveStatus(t);

  // TASK_MASTER_CURRENT.md
  const tmc = path.join(ROOT, "TASK_MASTER_CURRENT.md");
  const md = [
    "\n---\n",
    `### Auto Status (telemetry) — ${stamp()}\n`,
    `- Voice System Stability: **${s.voice_stability}%**`,
    `- STT Quality (finalization ratio): **${s.stt_quality}%**`,
    `- Hands-Free (VAD sessions present): **${s.hands_free}%**`,
    `- Microphone Health: **${s.mic_health}%**\n`
  ].join("\n");
  append(tmc, md);

  // HANDDOWN_SUMMARY.md (brief)
  const hdf = path.join(ROOT, "HANDDOWN_SUMMARY.md");
  const hand = [
    "\n---\n",
    `**Auto Handover Note — ${stamp()}**`,
    `- Session: ${t.session?.id || "n/a"} — device: ${t.device?.type || "unknown"} — sr: ${t.device?.sampleRate || "?"}`,
    `- TTS ok/err: ${t.tts?.success || 0}/${t.tts?.error || 0} — STT final/interim/err: ${t.stt?.final || 0}/${t.stt?.interim || 0}/${t.stt?.error || 0}`,
    `- VAD sessions: ${t.vad?.sessions || 0} — mic: denied=${t.mic?.denied || 0}`
  ].join("\n");
  append(hdf, hand);

  console.log("Appended telemetry-based status to TASK_MASTER_CURRENT.md and HANDDOWN_SUMMARY.md");
})();