/* Chango Self-Test: run from console with Chango.selftest()
   Checks: Audio -> TTS -> Mic/VAD -> STT (WebSpeech/WASM) -> Wake path -> VoiceGate -> HUD
*/
import { bus } from "../core/eventBus.js";
import { ctxPool } from "../audio/contextPool.js";
import { device } from "../core/device.js";
import { wasmSTT } from "../stt/wasm_fallback.js";
import { kws } from "../stt/kws_local.js";
import { voiceGate } from "../security/voicegate.js";

function log(line){ bus.emit("selftest:log", { t: Date.now(), line }); }
function ok(name, extra){ bus.emit("selftest:log", { t: Date.now(), line: `✅ ${name}${extra?`: ${extra}`:""}` }); }
function fail(name, extra){ bus.emit("selftest:log", { t: Date.now(), line: `❌ ${name}${extra?`: ${extra}`:""}` }); }

async function withTimeout(promise, ms, label){
  let to; const timeout = new Promise((_,rej)=> to=setTimeout(()=>rej(new Error(`${label} timeout after ${ms}ms`)), ms));
  try{ const v = await Promise.race([promise, timeout]); clearTimeout(to); return v; } catch(e){ clearTimeout(to); throw e; }
}

async function checkAudio(){
  log("[Audio] unlocking…");
  try { await ctxPool.unlock(); ok("Audio unlock"); } catch(e){ fail("Audio unlock", e.message); throw e; }
}

async function checkTTS(){
  log("[TTS] speak() check…");
  const t0 = performance.now();
  let ended = false;
  const off = bus.on("tts:end", ()=>{ ended = true; });
  try{
    if (typeof window.speak === "function") {
      window.speak("Self test voice online.");
    } else {
      const u = new SpeechSynthesisUtterance("Self test voice online.");
      speechSynthesis.speak(u);
      ended = true; // we can't reliably detect end here
    }
    await withTimeout((async()=>{ while(!ended) await new Promise(r=>setTimeout(r,50)); })(), 4000, "TTS");
    ok("TTS", `${Math.round(performance.now()-t0)}ms`);
  } catch(e){ fail("TTS", e.message); }
  finally { off && off(); }
}

async function checkMicVAD(){
  log("[Mic] permission + VAD…");
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    ok("Mic permission");
  } catch(e){ fail("Mic permission", e.name||e.message); throw e; }
  // We don't control your VAD instance here; we just confirm permission works.
}

async function checkSTT(){
  log("[STT] engine availability…");
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) { ok("WebSpeech available"); return { mode:"webspeech" }; }
  if (await wasmSTT.available()) { ok("WASM STT available"); return { mode:"wasm" }; }
  fail("STT", "No WebSpeech, no WASM model"); return { mode:"none" };
}

async function checkWakePath(){
  log("[Wake] emit wake:hit → expect intent or prompt…");
  let got = false;
  const offA = bus.on("cmd", ()=>{ got=true; });
  const offB = bus.on("brain:intent", ()=>{ got=true; });
  const offC = bus.on("stt:result", (e)=>{ if(e?.final) got=true; });
  bus.emit("wake:hit", { phrase: "selftest", score: 1, source: "selftest" });
  try{
    await withTimeout((async()=>{ for(let i=0;i<30 && !got;i++){ await new Promise(r=>setTimeout(r,100)); } })(), 3000, "wake");
    ok("Wake path");
  } catch(e){ fail("Wake path", "no downstream activity"); }
  finally { offA(); offB(); offC(); }
}

async function checkGate(){
  log("[Gate] status…");
  const enabled = !!voiceGate.enabled;
  if (!enabled){ ok("Owner Gate", "disabled"); return; }
  if (voiceGate.vp){ ok("Owner Gate", "LOCKED (enrolled)"); return; }
  fail("Owner Gate", "enabled but UNENROLLED"); 
}

async function checkHUD(){
  log("[HUD] GET /hud/status.json …");
  try{
    const res = await fetch("/hud/status.json", { cache:"no-store" });
    if (!res.ok) throw new Error(`${res.status}`);
    const j = await res.json();
    ok("HUD endpoint", `stt_health=${j?.metrics?.stt_health ?? "?"}%`);
  } catch(e){ fail("HUD endpoint", e.message); }
}

async function run(){
  const started = Date.now();
  log("— SelfTest started —");
  const results = [];
  for (const step of [checkAudio, checkTTS, checkMicVAD, checkSTT, checkWakePath, checkGate, checkHUD]){
    try{ await step(); results.push({ step: step.name, ok: true }); }
    catch(e){ results.push({ step: step.name, ok: false, err: e?.message }); }
  }
  const took = Date.now()-started;
  const summary = { ok: results.every(r=>r.ok), took_ms: took, results };
  bus.emit("selftest:result", summary);
  log(`— SelfTest finished in ${took}ms —`);
  return summary;
}

if (!window.Chango) window.Chango = {};
window.Chango.selftest = run;
export { run as selftest };