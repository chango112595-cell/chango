type GateState = 'open' | 'closed';

export class VoiceGate {
  private state: GateState = 'closed';
  private listeners = new Set<(s: GateState) => void>();
  get isOpen() { return this.state === 'open'; }

  on(fn: (s: GateState) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { const s = this.state; this.listeners.forEach(fn => queueMicrotask(() => fn(s))); }

  open()  { if (this.state !== 'open') { this.state = 'open';  this.emit(); } }
  close() { if (this.state !== 'closed') { this.state = 'closed'; this.emit(); } }
}

export const voiceGate = new VoiceGate();