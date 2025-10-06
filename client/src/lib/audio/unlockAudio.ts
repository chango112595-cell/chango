// Isolated: safe to import anywhere
let unlocked = false;
let ctx: AudioContext | null = null;
let unlockAttempts = 0;
const MAX_UNLOCK_ATTEMPTS = 3;

export function ensureAudioUnlockedOnce(): void {
  if (unlocked) return;
  
  const resume = async () => {
    if (unlocked || unlockAttempts >= MAX_UNLOCK_ATTEMPTS) return;
    
    unlockAttempts++;
    
    try {
      // iOS Safari uses webkitAudioContext
      // @ts-ignore
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      
      if (!AudioContextClass) {
        console.warn('[AudioUnlock] AudioContext not supported');
        return;
      }
      
      if (!ctx) {
        ctx = new AudioContextClass();
      }
      
      if (ctx.state === 'suspended') {
        await ctx.resume().catch((err) => {
          console.warn('[AudioUnlock] Failed to resume AudioContext:', err);
          // Don't throw - continue with unlocked = false
        });
      }
      
      // Try to play silence to verify audio works
      if (ctx.state === 'running') {
        try {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          gainNode.gain.value = 0; // Silent
          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);
          oscillator.start(0);
          oscillator.stop(ctx.currentTime + 0.01);
          
          unlocked = true;
          console.debug('[AudioUnlock] Audio successfully unlocked');
        } catch (playErr) {
          console.warn('[AudioUnlock] Failed to play test sound:', playErr);
        }
      }
      
      if (unlocked) {
        // Clean up event listeners only if successful
        window.removeEventListener('pointerdown', resume, { capture: true } as any);
        window.removeEventListener('touchend', resume, { capture: true } as any);
        document.removeEventListener('visibilitychange', visibilityHandler, { capture: true } as any);
      } else if (unlockAttempts >= MAX_UNLOCK_ATTEMPTS) {
        console.warn('[AudioUnlock] Max unlock attempts reached, audio may not work properly');
      }
    } catch (err) {
      console.error('[AudioUnlock] Error during audio unlock:', err);
    }
  };
  
  const visibilityHandler = () => {
    if (document.visibilityState === 'visible' && !unlocked) {
      resume();
    }
  };

  // Add event listeners for user interaction
  window.addEventListener('pointerdown', resume, { once: true, capture: true });
  window.addEventListener('touchend', resume, { once: true, capture: true });
  document.addEventListener('visibilitychange', visibilityHandler, { capture: true });
  
  // Try to unlock immediately if possible
  resume();
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function getAudioContext(): AudioContext | null {
  return ctx;
}