// client/src/components/AudioUnlock.tsx
import { useState } from 'react';

let audioContext: AudioContext | null = null;

async function ensureAudioUnlocked() {
  if (!audioContext) {
    audioContext = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

export function AudioUnlock() {
  const [ok, setOk] = useState<boolean>(() => !!sessionStorage.getItem('audio_unlocked'));
  
  if (ok) return null;
  
  return (
    <button
      onClick={async () => {
        await ensureAudioUnlocked();
        sessionStorage.setItem('audio_unlocked','1');
        setOk(true);
      }}
      className="rounded-full px-3 py-1 text-xs bg-emerald-600/20 border border-emerald-500 hover:bg-emerald-600/30 transition-colors"
      style={{ position:'fixed', right:12, bottom:88, zIndex:1000 }}
    >
      Enable Audio
    </button>
  );
}