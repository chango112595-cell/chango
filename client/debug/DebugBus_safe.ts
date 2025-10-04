type Level = 'ok'|'info'|'warn'|'error';
type Event = { tag: string; level: Level; msg: string; data?: any; ts?: number };

const listeners = new Set<(e: Event) => void>();
const flags = new Map<string, boolean>();

export const DebugBusSafe = {
  on(fn:(e:Event)=>void){ listeners.add(fn); return ()=>listeners.delete(fn); },
  emit(e: Event){
    e.ts = e.ts || Date.now();
    for (const fn of listeners) { try{ fn(e); }catch{} }
    const line = `[${new Date(e.ts).toISOString()}][${e.level}] ${e.tag}: ${e.msg}`;
    (e.level==='error'?console.error:e.level==='warn'?console.warn:console.log)(line, e.data??"");
  },
  defineFlags(names: string[]){ names.forEach(n=>flags.set(n,false)); },
  flag(name: string, val: boolean){ flags.set(name,val); DebugBusSafe.emit({tag:'FLAG',level:'info',msg:`${name}=${val}`}); },
  snapshot(){ return Object.fromEntries(flags.entries()); }
};