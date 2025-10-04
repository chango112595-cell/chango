import { DebugBusSafe } from '../debug/DebugBus_safe';
import { VoiceGateSafe } from './gate_safe';
import { speakSafe } from './tts_safe';
import { sendToLLMSafe } from '../llm/orchestrator_safe';

let rec: SpeechRecognition | null = null;

export async function startSTTSafe(){
  stopSTTSafe();
  const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if(!SR) throw new Error('no_speech_recognition');

  rec = new SR(); rec.lang='en-US'; rec.continuous=true; rec.interimResults=true;

  rec.onresult = async (ev: SpeechRecognitionEvent) => {
    let final=''; for(let i=ev.resultIndex;i<ev.results.length;i++){ const r=ev.results[i]; if(r.isFinal) final+=r[0].transcript; }
    if(!final) return;
    const raw=final.trim(); DebugBusSafe.emit({tag:'STT',level:'info',msg:`heard="${raw.toLowerCase()}"`});
    const check=VoiceGateSafe.check(raw); if(!check.pass){ DebugBusSafe.emit({tag:'Gate',level:'info',msg:'ignored (no wake word)'}); return; }
    const reply = await sendToLLMSafe(check.cmd); DebugBusSafe.emit({tag:'Orch',level:'ok',msg:`reply="${(reply||'').slice(0,80)}..."`});
    await speakSafe(reply);
  };
  rec.onerror=(e:any)=>DebugBusSafe.emit({tag:'STT',level:'error',msg:e?.error||'stt_error'});
  rec.onend = ()=>{ DebugBusSafe.emit({tag:'STT',level:'warn',msg:'recognizer ended – auto-restart'}); try{ rec?.start(); }catch{} };

  try{ rec.start(); DebugBusSafe.emit({tag:'STT',level:'ok',msg:'recognizer started'}); }
  catch(e:any){ DebugBusSafe.emit({tag:'STT',level:'error',msg:`start failed: ${e?.message||e}`}); throw e; }
}

export function stopSTTSafe(){ try{ rec?.stop(); }catch{} rec=null; }