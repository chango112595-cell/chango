import { useEffect } from 'react';
import { voiceGate } from '../core/gate';

export function useMonitorSentries(log: (msg:string)=>void, alert: (msg:string)=>void) {
  useEffect(() => {
    const onRej = (ev: PromiseRejectionEvent) => alert(`[UnhandledRejection] ${String(ev.reason)}`);
    const onErr = (ev: ErrorEvent) => alert(`[Error] ${ev.message}`);
    window.addEventListener('unhandledrejection', onRej);
    window.addEventListener('error', onErr);
    const offGate = voiceGate.on(s => {
      log(`[Gate] ${s}`);
      if (s === 'closed') alert('Voice gate closed — mic permission or wake flow is blocked.');
    });
    return () => {
      window.removeEventListener('unhandledrejection', onRej);
      window.removeEventListener('error', onErr);
      offGate();
    };
  }, [log, alert]);
}