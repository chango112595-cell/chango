import { DebugBusSafe } from '../debug/DebugBus_safe';
let enabled=false; let wake='lolo';
export const VoiceGateSafe = {
  enable(word:string){ enabled=true; wake=(word||'lolo').toLowerCase(); DebugBusSafe.flag('Gate',true); },
  disable(){ enabled=false; DebugBusSafe.flag('Gate',false); },
  check(txt:string){
    if(!enabled) return {pass:true, cmd:txt};
    const raw=(txt||'').toLowerCase(); const i=raw.indexOf(wake);
    if(i===-1) return {pass:false, cmd:''};
    const cmd=raw.slice(i+wake.length).replace(/^[\s,.:;-]+/,'');
    return {pass:!!cmd, cmd};
  }
};