import { diagBus } from './diagBus';
import { listHealthChecks } from './healthRegistry';

let timer: number | undefined;
const lastFire: Record<string, number> = {};
const RATE_MS = 4000; // rate limit notifications per id

export function startDiagRunner(){
  if(timer) return;
  const loop = async () => {
    const checks = listHealthChecks();
    for(const c of checks){
      try{
        const r = await c.run();
        if(!r.ok && r.event){
          const now = Date.now();
          const last = lastFire[r.event.id] || 0;
          if(now - last > RATE_MS){
            lastFire[r.event.id] = now;
            diagBus.emit({ ...r.event, ts: now });
            if(r.fix){ // auto-heal only for warn/error/critical with fix
              const sev = r.event.severity;
              if(sev !== 'info'){
                try{
                  const ok = await r.fix();
                  diagBus.emit({
                    id: `${r.event.id}.autoheal`,
                    domain: r.event.domain,
                    severity: ok ? 'info' : 'warn',
                    msg: ok ? `Self-healed: ${r.event.id}` : `Auto-heal failed: ${r.event.id}`,
                    ts: Date.now(),
                  });
                }catch{
                  diagBus.emit({
                    id: `${r.event.id}.autoheal.exc`,
                    domain: r.event.domain, severity: 'warn',
                    msg: `Auto-heal exception: ${r.event.id}`, ts: Date.now()
                  });
                }
              }
            }
          }
        }
      }catch{
        diagBus.emit({ id:`${c.name}.check.exc`, domain:'core', severity:'warn', msg:'Check threw', ts:Date.now() });
      }
    }
    timer = window.setTimeout(loop, 800);
  };
  loop();
}

export function stopDiagRunner(){
  if(timer){ clearTimeout(timer); timer = undefined; }
}