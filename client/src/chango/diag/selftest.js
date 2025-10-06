import { bus } from "../core/eventBus.js";
import { ctxPool } from "../audio/contextPool.js";
import { once } from "../core/once.js";
function log(x){ bus.emit("selftest:log",{t:Date.now(),line:x}); }
async function withTimeout(p,ms,label){ let to; const t=new Promise((_,r)=>to=setTimeout(()=>r(new Error(`${label} timeout ${ms}ms`)),ms)); try{ const v=await Promise.race([p,t]); clearTimeout(to); return v; } finally{ clearTimeout(to); } }
async function testAudio(){ await ctxPool.unlock(); }
async function testTTS(){ return new Promise((res)=>{ try{ if(typeof window.speak==="function"){ window.speak("Self test voice online."); setTimeout(res,1500); } else { const u=new SpeechSynthesisUtterance("Self test voice online."); speechSynthesis.speak(u); setTimeout(res,1500);} }catch{ setTimeout(res,1500);} }); }
async function testHUD(){ const r=await fetch("/hud/status.json",{cache:"no-store"}); if(!r.ok) throw new Error(`HUD ${r.status}`); return r.json(); }
async function run(){ const t0=Date.now(); log("— SelfTest started —");
  const steps=[["Audio unlock",()=>withTimeout(testAudio(),4000,"audio")],["TTS",()=>withTimeout(testTTS(),4000,"tts")],["HUD",()=>withTimeout(testHUD(),3000,"hud")]];
  const results=[]; for(const [name,fn] of steps){ try{ await fn(); log(`✅ ${name}`); results.push({step:name,ok:true}); }catch(e){ log(`❌ ${name}: ${e.message}`); results.push({step:name,ok:false,err:e.message}); } }
  const sum={ ok:results.every(r=>r.ok), took_ms:Date.now()-t0, results }; bus.emit("selftest:result",sum); log(`— SelfTest finished (${sum.took_ms}ms) —`); return sum; }
const api=once("selftest_api",()=>({ selftest:run })); if(!window.Chango) window.Chango={}; window.Chango.selftest=api.selftest; export{ run as selftest };