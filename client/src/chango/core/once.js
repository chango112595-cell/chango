// Why: prevent multiple initializations (hot-reload duplicates crash STT/KWS/telemetry).
const KEY="__CHANGO_SINGLETONS__";
const G=(globalThis[KEY] ||= { map:new Map(), flags:new Set() });
export function once(name,factory){ if(G.map.has(name)) return G.map.get(name); const v=factory(); G.map.set(name,v); return v; }
export function flag(name){ if(G.flags.has(name)) return false; G.flags.add(name); return true; }
export function get(name){ return G.map.get(name); }