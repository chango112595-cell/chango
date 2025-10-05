/**
 * DuplexGuard Module
 * Manages the speaking state to prevent duplex communication issues
 * Prevents STT from picking up TTS output
 */

let speaking = false;
const listeners = new Set<(s: boolean) => void>();

export const DuplexGuard = {
  isSpeaking() { 
    return speaking; 
  },
  
  onChange(fn: (s: boolean) => void) { 
    listeners.add(fn); 
    return () => listeners.delete(fn); 
  },
  
  setSpeaking(s: boolean) {
    if (speaking === s) return;
    speaking = s;
    for (const fn of [...listeners]) {
      try { 
        fn(speaking); 
      } catch (e) {
        console.error('[DuplexGuard] Listener error:', e);
      }
    }
  }
};