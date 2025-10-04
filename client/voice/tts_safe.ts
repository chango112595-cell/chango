import { DebugBusSafe } from '../debug/DebugBus_safe';
let utter: SpeechSynthesisUtterance | null = null;
let speaking = false;

export async function speakSafe(text: string){
  if (!('speechSynthesis' in window)) { DebugBusSafe.emit({tag:'TTS',level:'warn',msg:'no WebSpeech'}); return; }
  try{
    if (speaking && utter){ window.speechSynthesis.cancel(); speaking=false; }
    utter = new SpeechSynthesisUtterance(text||'');
    utter.rate=1; utter.pitch=1; utter.volume=1;
    utter.onstart=()=>{ speaking=true; DebugBusSafe.flag('TTS',true); };
    utter.onend=()=>{ speaking=false; DebugBusSafe.flag('TTS',false); };
    utter.onerror=(e:any)=>{ speaking=false; DebugBusSafe.emit({tag:'TTS',level:'error',msg:e?.error||'tts_error'}); };
    window.speechSynthesis.speak(utter);
  }catch(e:any){ DebugBusSafe.emit({tag:'TTS',level:'error',msg:e?.message||'tts_failed'}); }
}
export function stopSpeakSafe(){ try{ window.speechSynthesis.cancel(); }catch{} speaking=false; DebugBusSafe.flag('TTS',false); }