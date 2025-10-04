// Modules register passive health checks + optional fixers
export type CheckResult = {
  ok: boolean;
  event?: Omit<import('./diagBus').HealthEvent,'ts'>; // ts filled by runner
  fix?: () => Promise<boolean>;                       // self-heal action
};

export type HealthCheck = {
  name: string;                 // 'stt.pipeline'
  cadenceMs: number;            // run periodically
  run: () => Promise<CheckResult> | CheckResult;
};

const REG: HealthCheck[] = [];
export function registerHealthCheck(h:HealthCheck){ REG.push(h); }
export function listHealthChecks(){ return [...REG]; }