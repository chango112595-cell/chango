import fs from "node:fs"; 
import path from "node:path";
const DIR=path.join(process.cwd(),"telemetry"); 
const FILE=path.join(DIR,"runtime.json");
let _last={ ts:null, payload:null };
function ensure(){ try{ if(!fs.existsSync(DIR)) fs.mkdirSync(DIR,{recursive:true}); }catch{} }
function load(){ try{ if(fs.existsSync(FILE)){ const p=JSON.parse(fs.readFileSync(FILE,"utf8")); _last={ ts:Date.now(), payload:p }; } }catch{} }
function save(p){ try{ ensure(); fs.writeFileSync(FILE, JSON.stringify(p,null,2)); }catch{} }
export function setHUD(payload){ _last={ ts:Date.now(), payload }; save(payload); }
export function getHUD(){ const p=_last.payload||{}; const pct=(a=0,b=0)=>{ b=Math.max(1,b); return Math.round((a/b)*100); };
  const stability=pct(p.tts?.success,(p.tts?.success||0)+(p.tts?.error||0));
  const sttQual=pct(p.stt?.final,(p.stt?.final||0)+(p.stt?.error||0));
  const rec=p.stt?.recoveries||0; const sttHealth=Math.max(0,100-Math.min(100, rec*15));
  return { updated:_last.ts||0, device:p.device||{}, metrics:{ voice_stability:stability, stt_quality:sttQual, stt_recoveries:rec, stt_health:sttHealth, last_recovery_ms:p.stt?.last_recovery_ms||0, vad_sessions:p.vad?.sessions||0, mic_denied:p.mic?.denied||0, errors:p.diag?.errors||0 }, selftest:p.selftest||{ last_pass:null, took_ms:null, at:null } };
}
load();