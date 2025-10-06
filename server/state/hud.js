// In-memory HUD store (ephemeral). Safe for dev; persist if you want later.
let _last = { ts: null, payload: null };

export function setHUD(payload) { 
  _last = { ts: Date.now(), payload }; 
}

export function getHUD() {
  const p = _last.payload || {};
  const stability = pct(p.tts?.success, (p.tts?.success || 0) + (p.tts?.error || 0));
  const sttQual   = pct(p.stt?.final, (p.stt?.final || 0) + (p.stt?.error || 0));
  return {
    updated: _last.ts || 0,
    device: p.device || {},
    metrics: {
      voice_stability: stability,
      stt_quality: sttQual,
      vad_sessions: p.vad?.sessions || 0,
      mic_denied: p.mic?.denied || 0,
      errors: p.diag?.errors || 0
    }
  };
}

function pct(a = 0, b = 0){ 
  b = Math.max(1, b); 
  return Math.round((a / b) * 100); 
}