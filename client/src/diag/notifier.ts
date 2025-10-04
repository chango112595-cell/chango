import { diagBus, HealthEvent } from './diagBus';

type Policy = {
  speak: (e:HealthEvent) => boolean; // should TTS speak it?
  toast: (e:HealthEvent) => boolean; // UI toast?
};

const policy: Policy = {
  speak: (e) => e.severity === 'critical' || (e.severity==='error' && e.domain!=='ui'),
  toast: (e) => e.severity !== 'info'
};

// Plug into your TTS + UI toast safely via adapters
type Adapters = { speak:(s:string)=>void; toast:(s:string, sev:HealthEvent['severity'])=>void; log:(...a:any[])=>void; };
export function attachDiagNotifier(ad: Adapters){
  diagBus.on(e=>{
    ad.log?.('[Diag]', e.severity, e.domain, e.msg);
    if(policy.toast(e)) ad.toast?.(e.msg, e.severity);
    if(policy.speak(e)) ad.speak?.(`Heads up: ${e.msg}`);
  });
}