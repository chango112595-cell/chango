export type MicState = 'unknown'|'granted'|'denied'|'blocked'|'prompt';

let audioUnlocked = false;

export async function unlockAudioContext(ctx: AudioContext) {
  if (ctx.state === 'suspended') await ctx.resume();
  audioUnlocked = true;
}

export async function checkMicPermission(): Promise<MicState> {
  try {
    // @ts-ignore
    if (navigator.permissions?.query) {
      // @ts-ignore
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (status.state === 'granted') return 'granted';
      if (status.state === 'denied')   return 'denied';
      return 'prompt';
    }
  } catch {}
  try {
    const s = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true, 
        autoGainControl: true 
      } 
    });
    s.getTracks().forEach(t => t.stop());
    return 'granted';
  } catch (e:any) {
    const name = e?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
    if (name === 'NotFoundError') return 'blocked';
    return 'prompt';
  }
}

export async function requestMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 44100
    }
  });
}

export function isAudioUnlocked(){ return audioUnlocked; }