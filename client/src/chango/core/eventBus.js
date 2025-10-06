export class EventBus {
  constructor() { this.map = new Map(); }
  on(type, fn) { (this.map.get(type) || this.map.set(type, new Set()).get(type)).add(fn); return () => this.off(type, fn); }
  off(type, fn) { const s = this.map.get(type); if (s) s.delete(fn); }
  emit(type, payload) { const s = this.map.get(type); if (!s) return; for (const fn of s) { try { fn(payload); } catch {} } }
}
export const eventBus = new EventBus();
export const bus = eventBus; // for compatibility