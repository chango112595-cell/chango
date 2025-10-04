import { checkMicPermission, requestMicStream, unlockAudioContext } from '../lib/permissions_safe';
import { DebugBusSafe } from '../debug/DebugBus_safe';
import { startSTTSafe, stopSTTSafe } from './stt_safe';
import { VoiceGateSafe } from './gate_safe';

let running=false; let ctx: AudioContext | null = null;
async function ensureAudioUnlocked(){ if(!ctx) ctx=new (window.AudioContext||(window as any).webkitAudioContext)(); await unlockAudioContext(ctx); }

export async function startAlwaysListenSafe({ wakeWord='lolo', enabled=true }={}) {
  if(running||!enabled) return;
  try{
    await ensureAudioUnlocked();
    const state = await checkMicPermission();
    DebugBusSafe.emit({tag:'AlwaysListen',level:'info',msg:`perm=${state}`});
    if(state==='denied'||state==='blocked') throw new Error('mic_denied');

    const s = await requestMicStream(); s.getTracks().forEach(t=>t.stop());
    VoiceGateSafe.enable(wakeWord);
    await startSTTSafe();
    running=true; DebugBusSafe.flag('STT',true); DebugBusSafe.flag('Gate',true);
  }catch(e:any){
    running=false; DebugBusSafe.flag('STT',false); DebugBusSafe.flag('Gate',false);
    DebugBusSafe.emit({tag:'AlwaysListen',level:'error',msg:`startup_failed: ${e?.message||e}`});
  }
}

export async function stopAlwaysListenSafe(){
  try{ VoiceGateSafe.disable(); await stopSTTSafe(); }
  finally { running=false; DebugBusSafe.flag('STT',false); DebugBusSafe.flag('Gate',false); }
}