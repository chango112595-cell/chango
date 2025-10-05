export type MicState = 'granted' | 'prompt' | 'denied' | 'unsupported';

export async function getMicrophonePermission(): Promise<MicState> {
  try {
    if (!('permissions' in navigator)) return 'unsupported';
    // @ts-ignore
    const status = await navigator.permissions.query({ name: 'microphone' });
    return (status.state as MicState) ?? 'unsupported';
  } catch {
    return 'unsupported';
  }
}

export async function requestMicrophoneIfNeeded(): Promise<boolean> {
  const state = await getMicrophonePermission();
  if (state === 'granted') return true;
  try {
    // Ask for mic once to trigger browser prompt
    await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch {
    return false;
  }
}