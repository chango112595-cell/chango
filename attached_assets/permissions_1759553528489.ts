export type MicPermission = 'granted' | 'denied' | 'prompt';

export async function queryMicPermission(): Promise<MicPermission> {
  try {
    // @ts-ignore
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: 'microphone' as any });
      return status.state as MicPermission;
    }
  } catch {}
  return 'prompt';
}

/** Must be called from a user gesture (tap/keypress) on iOS/Safari. */
export async function ensureMicPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return true;
  } catch {
    return false;
  }
}