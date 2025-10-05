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
  markTTS(starting: boolean) { s.ttsStart = starting ? Date.now() : null; },
  
  // New functions for duplicate detection
  markReply(text: string, debug?: (tag: string, level: 'info'|'warn'|'error'|'ok', msg: string, data?: any) => void) {
    const norm = (text || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const now = Date.now();
    if (norm && norm === lastReply && now - lastReplyAt < 8000) {
      debug?.('REPEAT', 'warn', 'duplicate reply suppressed', { text: norm });
    }
    lastReply = norm;
    lastReplyAt = now;
  },
  
  markEcho(debug?: (tag: string, level: 'info'|'warn'|'error'|'ok', msg: string, data?: any) => void) {
    debug?.('ECHO', 'warn', 'stt heard while tts speaking – likely device echo');
  }
};

// Variables for duplicate detection
let lastReply = '';
let lastReplyAt = 0;