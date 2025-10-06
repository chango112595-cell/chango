import { bus } from "../core/eventBus.js";
import { registerIntent, routeIntent } from "../brain/intent.js";
let timer=null, pending=false;
registerIntent({ name:"sys.stop", match:t=>/^\s*(stop|cancel|quiet|silence)\b/.test(t), handle:async({speak})=>{ speak("Stopping."); bus.emit("sys:stop"); return true; }});
registerIntent({ name:"sys.power", match:t=>/^\s*(power|shutdown|go sleep)\b/.test(t), handle:async({speak})=>{ speak("Standing by."); bus.emit("sys:standby"); return true; }});
function speakOut(m){ try{ if(typeof window.speak==="function") window.speak(m); else if(window.Chango?.speak) window.Chango.speak(m); else speechSynthesis.speak(new SpeechSynthesisUtterance(m)); }catch{} }
bus.on("wake:hit",()=>{ clearTimeout(timer); pending=true; timer=setTimeout(()=>{ if(!pending) return; speakOut("Yes?"); pending=false; },2000); });
bus.on("stt:result",async({text,final})=>{ if(!text) return; if(final){ clearTimeout(timer); pending=false; const handled=await routeIntent(text); if(!handled) speakOut(text); }});