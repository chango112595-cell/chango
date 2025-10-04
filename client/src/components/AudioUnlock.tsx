import React from 'react';
import { ensureAudioUnlocked } from '../voice/always_listen';

export function AudioUnlock() {
  const [ok, setOk] = React.useState<boolean>(() => !!sessionStorage.getItem('audio_unlocked'));
  if (ok) return null;
  return (
    <button
      onClick={async () => {
        await ensureAudioUnlocked();
        sessionStorage.setItem('audio_unlocked','1');
        setOk(true);
      }}
      className="rounded-full px-3 py-1 text-xs bg-emerald-600/20 border border-emerald-500"
      style={{ position:'fixed', right:12, bottom:88, zIndex:1000 }}
    >
      Enable Audio
    </button>
  );
}