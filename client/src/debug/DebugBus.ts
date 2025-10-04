type Level = 'ok'|'info'|'warn'|'error';
type Event = { tag: string; level: Level; msg: string; data?: any; ts?: number };

const flags = new Map<string, boolean>();
const listeners = new Set<(e: Event) => void>();

export const DebugBus = {
  on(fn:(e:Event)=>void){ listeners.add(fn); return ()=>listeners.delete(fn); },
  emit(e: Event){
    e.ts = e.ts || Date.now();
    for (const fn of Array.from(listeners)) try{ fn(e); }catch{}
    const line = `[${new Date(e.ts).toISOString()}] [${e.level}] ${e.tag}: ${e.msg}`;
    if (e.level==='error') console.error(line, e.data||'');
    else if (e.level==='warn') console.warn(line, e.data||'');
    else console.log(line, e.data||'');
  },
  defineFlags(names: string[]){ names.forEach(n=>flags.set(n, false)); },
  flag(name: string, val: boolean){ flags.set(name, val); DebugBus.emit({tag:'FLAG', level:'info', msg:`${name}=${val}`}); },
  snapshot(){ return Object.fromEntries(flags.entries()); }
};