import { debugBus } from '@/dev/debugBus';
import { startAlwaysListenNew as startAlwaysListen, stopAlwaysListenNew as stopAlwaysListen, isAlwaysListenActive } from '@/voice/always_listen';
import { getMicrophonePermission } from '@/lib/permissions/microphone';

let lastOk = Date.now();
let recovering = false;
let failCount = 0;
const MAX_RECOVERIES = 4;
const STUCK_MS = 12_000;

export function sttHeartbeatOk() {
  lastOk = Date.now();
  failCount = 0;
}

export async function sttHealthTick() {
  const age = Date.now() - lastOk;
  const mic = await getMicrophonePermission();

  if (mic === 'denied') {
    debugBus.error('Health', 'Mic denied by browser. Please allow microphone.');
    return;
  }

  if (age < STUCK_MS) return;

  if (recovering || failCount >= MAX_RECOVERIES) {
    debugBus.warn('Health', 'Max STT recoveries reached; manual action required.');
    return;
  }

  recovering = true;
  failCount++;
  debugBus.warn('Health', `STT seems stuck (${age}ms). Recovery #${failCount}`);

  try {
    if (isAlwaysListenActive()) {
      await stopAlwaysListen();
      await new Promise(r => setTimeout(r, 800));
    }
    await startAlwaysListen({ enabled: true });
  } catch (e) {
    debugBus.error('Health', `Recovery failed: ${String(e)}`);
  } finally {
    recovering = false;
    lastOk = Date.now();
  }
}

// call this on app boot once
export function bootSttHealthMonitor() {
  setInterval(sttHealthTick, 2_000);
}