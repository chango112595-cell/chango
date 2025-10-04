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