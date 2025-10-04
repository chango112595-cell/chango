import { useEffect, useRef, useState } from 'react';
import { ensureMicPermission, queryMicPermission } from '../core/permissions';
import { voiceGate } from '../core/gate';

export function useAlwaysListen(wakeWord = 'lolo') {
  const [ready, setReady] = useState(false);
  const armedRef = useRef(false);

  useEffect(() => {
    let unsub: (()=>void) | null = null;

    const arm = async () => {
      if (armedRef.current) return;
      const ok = await ensureMicPermission();
      if (!ok) { voiceGate.close(); return; }
      armedRef.current = true;
      setReady(true);
      voiceGate.open();
      // Start your STT/VAD here only after the gate opens.
    };

    const gesture = () => arm();
    window.addEventListener('pointerdown', gesture, { once: true });
    window.addEventListener('keydown', gesture, { once: true });

    (async () => {
      const p = await queryMicPermission();
      if (p === 'granted') queueMicrotask(arm);
    })();

    return () => { unsub?.(); };
  }, [wakeWord]);

  return { ready, gateOpen: voiceGate.isOpen };
}