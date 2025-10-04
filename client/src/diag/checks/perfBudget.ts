import { registerHealthCheck } from '../healthRegistry';

registerHealthCheck({
  name: 'perf.budget',
  cadenceMs: 2000,
  run: () => {
    const mem = (performance as any).memory;
    if(mem && mem.usedJSHeapSize/mem.jsHeapSizeLimit > 0.8){
      return {
        ok:false,
        event:{ id:'perf.heap.high', domain:'perf', severity:'warn', msg:'High memory pressure (>80%)', fixable:true },
        fix: async () => { try{ await caches?.keys()?.then(keys=>keys.forEach(k=>caches.delete(k))); return true; }catch{ return false; } }
      };
    }
    return { ok:true };
  }
});