// Central bus for health events (no external deps)
export type Severity = 'info'|'warn'|'error'|'critical';
export type Domain = 'voice'|'stt'|'tts'|'wake'|'mic'|'ui'|'perf'|'net'|'core';
export type HealthEvent = {
  id: string;               // stable key ('stt.pipeline.idle', etc.)
  domain: Domain;
  severity: Severity;
  msg: string;
  ts: number;
  data?: Record<string, unknown>;
  fixable?: boolean;
};

type Listener = (e: HealthEvent) => void;

class DiagBus {
  private ls = new Set<Listener>();
  on(f:Listener){ this.ls.add(f); return ()=>this.ls.delete(f); }
  emit(e:HealthEvent){ for(const f of Array.from(this.ls)) f(e); }
}
export const diagBus = new DiagBus();