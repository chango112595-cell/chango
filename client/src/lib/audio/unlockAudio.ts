// Isolated: safe to import anywhere
let unlocked = false;
let ctx: AudioContext | null = null;

export function ensureAudioUnlockedOnce(): void {
  if (unlocked) return;
  const resume = () => {
    try {
      // iOS Safari uses webkitAudioContext
      // @ts-ignore
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
      unlocked = true;
      window.removeEventListener('pointerdown', resume, { capture: true } as any);
      window.removeEventListener('touchend', resume, { capture: true } as any);
      document.removeEventListener('visibilitychange', resume, { capture: true } as any);
      console.debug('[AudioUnlock] audio unlocked');
    } catch {
      // ignore
    }
  };

  window.addEventListener('pointerdown', resume, { once: true, capture: true });
  window.addEventListener('touchend', resume, { once: true, capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resume();
  }, { capture: true });
}