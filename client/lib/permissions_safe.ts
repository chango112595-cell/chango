export type MicState = 'unknown'|'granted'|'denied'|'blocked'|'prompt';
let audioUnlocked = false;

export async function unlockAudioContext(ctx: AudioContext) {
  if (ctx.state === 'suspended') await ctx.resume();
  audioUnlocked = true;
}
export function isAudioUnlocked(){ return audioUnlocked; }

export async function checkMicPermission(): Promise<MicState> {
  try {
    // @ts-ignore
    if (navigator.permissions?.query) {
      // @ts-ignore
      const s = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (s.state==='granted') return 'granted';
      if (s.state==='denied')   return 'denied';
      return 'prompt';
    }
  } catch {}
  try {
    const strm = await navigator.mediaDevices.getUserMedia({ audio:true });
    strm.getTracks().forEach(t=>t.stop());
    return 'granted';
  } catch(e:any){
    const n = e?.name||'';
    if (n==='NotAllowedError'||n==='SecurityError') return 'denied';
    if (n==='NotFoundError') return 'blocked';
    return 'prompt';
  }
}

export async function requestMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true, channelCount:1, sampleRate:44100 }
  });
}