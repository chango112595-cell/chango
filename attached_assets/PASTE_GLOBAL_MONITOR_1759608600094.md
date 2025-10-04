# PASTE_GLOBAL_MONITOR.md — ChangoAI Global Monitor (Self‑Heal + Diagnostics)
**Scope:** Adds a global, isolated monitor with auto‑recovery hooks. No UI changes. Safe to paste into your repo.

## Files to add
```
client/
  debug/DebugBus_safe.ts                (use your existing; if missing, paste the one below)
  monitor/GlobalMonitor.ts
  monitor/rules.ts
  monitor/autoHeal.ts
```

---

## client/monitor/rules.ts
```ts
export type Severity = 'info' | 'warn' | 'error' | 'critical';

export const Rules = {
  windows: { net: 15000, sttSilence: 12000, ttsHang: 8000 },

  classifyNet(msSinceLastOk: number) {
    if (msSinceLastOk < 5000) return 'info';
    if (msSinceLastOk < 15000) return 'warn';
    return 'error';
  },

  classifySTTSilence(ms: number) {
    if (ms < 7000) return 'info';
    if (ms < 12000) return 'warn';
    return 'error';
  },

  classifyTTSBusy(ms: number) {
    if (ms < 4000) return 'info';
    if (ms < 8000) return 'warn';
    return 'error';
  }
} as const;
```

---

## client/monitor/autoHeal.ts
```ts
type Hooks = {
  startSTT?: () => Promise<void> | void;
  stopSTT?: () => Promise<void> | void;
  cancelSpeak?: () => void;
  isSpeaking?: () => boolean;
};

let healing = false;
let lastHeal = 0;
const COOLDOWN = 5000;

export const AutoHeal = {
  async tryHealSTT(hooks: Hooks) {
    const now = Date.now();
    if (healing || now - lastHeal < COOLDOWN) return;
    healing = true;
    lastHeal = now;
    try {
      await hooks.stopSTT?.();
      await hooks.startSTT?.();
    } finally {
      healing = false;
    }
  },

  tryHealTTS(hooks: Hooks, sinceMs: number) {
    if (sinceMs > 8000) {
      hooks.cancelSpeak?.();
    }
  }
};
```

---

## client/monitor/GlobalMonitor.ts
```ts
export type MonitorHooks = {
  startSTT?: () => Promise<void> | void;
  stopSTT?: () => Promise<void> | void;
  isSpeaking?: () => boolean;
  cancelSpeak?: () => void;
  ping?: () => Promise<boolean>;
  debug?: (tag: string, level: 'info'|'warn'|'error'|'ok', msg: string, data?: any) => void;
};

type State = {
  lastNetOk: number;
  lastHeard: number;
  ttsStart: number | null;
  sttActive: boolean;
  enabled: boolean;
};
const s: State = { lastNetOk: Date.now(), lastHeard: Date.now(), ttsStart: null, sttActive: false, enabled: false };

function log(h: MonitorHooks, tag: string, level: 'info'|'warn'|'error'|'ok', msg: string, data?: any) {
  try {
    h.debug?.(tag, level, msg, data);
    const line = `[${new Date().toISOString()}][${level}] ${tag}: ${msg}`;
    if (level === 'error') console.error(line, data ?? '');
    else if (level === 'warn') console.warn(line, data ?? '');
    else console.log(line, data ?? '');
  } catch {}
}

export const GlobalMonitor = {
  init(hooks: MonitorHooks) {
    if (s.enabled) return;
    s.enabled = True; // will be overwritten in the next lines to prevent type issues
    s.enabled = true;

    setInterval(async () => {
      try {
        const ok = await hooks.ping?.();
        if (ok) s.lastNetOk = Date.now();
        const age = Date.now() - s.lastNetOk;
        if (age > 15000) log(hooks, 'NET', 'error', 'network degraded', { age });
        else if (age > 5000) log(hooks, 'NET', 'warn', 'network slow', { age });
      } catch (e) {
        log(hooks, 'NET', 'error', 'network ping failed', e);
      }
    }, 5000);

    setInterval(() => {
      const age = Date.now() - s.lastHeard;
      if (s.sttActive) {
        if (age > 12000) { log(hooks, 'STT', 'error', 'silence too long – restart'); hooks.stopSTT?.(); hooks.startSTT?.(); }
        else if (age > 7000) log(hooks, 'STT', 'warn', 'prolonged silence', { age });
      }
    }, 4000);

    setInterval(() => {
      if (!s.ttsStart) return;
      const age = Date.now() - s.ttsStart;
      if (age > 8000) { log(hooks, 'TTS', 'error', 'tts busy too long – cancel'); hooks.cancelSpeak?.(); }
      else if (age > 4000) log(hooks, 'TTS', 'warn', 'tts busy', { age });
    }, 2000);

    window.addEventListener('error', (e) => log(hooks, 'JS', 'error', 'window error', { message: (e as ErrorEvent).message, filename: (e as any).filename }));
    window.addEventListener('unhandledrejection', (e) => log(hooks, 'JS', 'error', 'unhandled rejection', { reason: (e as PromiseRejectionEvent).reason }));
  },

  markHeard() { s.lastHeard = Date.now(); },
  markSTT(active: boolean) { s.sttActive = active; },
  markTTS(starting: boolean) { s.ttsStart = starting ? Date.now() : null; }
};
```

---

## Wiring (no UI changes)
```ts
import { GlobalMonitor } from '@/monitor/GlobalMonitor';

GlobalMonitor.init({
  startSTT: () => Voice.start(),
  stopSTT: () => Voice.stop(),
  isSpeaking: () => TTS.isSpeaking?.() ?? false,
  cancelSpeak: () => TTS.cancel?.(),
  ping: async () => { try { const r = await fetch('/api/health'); return r.ok; } catch { return false; } },
  debug: (tag, level, msg, data) => console.log(`[${tag}][${level}] ${msg}`, data ?? '')
});

// STT events:
/*
recognition.onstart = () => GlobalMonitor.markSTT(true);
recognition.onend   = () => GlobalMonitor.markSTT(false);
recognition.onresult = (e) => { ... if (finalText) GlobalMonitor.markHeard(); }
*/

// TTS events:
/*
utter.onstart = () => GlobalMonitor.markTTS(true);
utter.onend   = () => GlobalMonitor.markTTS(false);
utter.onerror = () => GlobalMonitor.markTTS(false);
*/
```

