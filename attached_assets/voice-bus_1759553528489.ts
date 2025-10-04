export type VoiceEvent =
  | { type: 'start' }
  | { type: 'end' }
  | { type: 'cancel'; source?: 'user' | 'system' }
  | { type: 'error'; err: unknown }
  | { type: 'muteChange'; muted: boolean };

export class VoiceBus {
  private listeners = new Set<(ev: VoiceEvent) => void>();
  private _isCancelling = false;
  on(fn: (ev: VoiceEvent) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emitAsync(ev: VoiceEvent) { [...this.listeners].forEach(fn => queueMicrotask(() => fn(ev))); }

  cancelSpeak(source: 'user'|'system'='user') {
    if (this._isCancelling) return;
    this._isCancelling = true;
    try { if (typeof window !== 'undefined') window.speechSynthesis?.cancel(); }
    finally { this._isCancelling = false; }
    this.emitAsync({ type: 'cancel', source });
  }
}

export const voiceBus = new VoiceBus();