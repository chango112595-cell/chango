// lib/audio/ensureMicReady.ts
let _booting = false;

export async function ensureMicReady(): Promise<MediaStream> {
  if (_booting) throw new Error("mic_boot_in_progress");
  _booting = true;
  try {
    // 1) resume AudioContext on iOS
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AC) {
      (window as any).__globalAC = (window as any).__globalAC || new AC();
      if ((window as any).__globalAC.state !== 'running') {
        await (window as any).__globalAC.resume();
      }
    }

    // 2) request mic with conservative constraints
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      }
    });

    // 3) cache & sanity check
    const track = stream.getAudioTracks()[0];
    if (!track || track.readyState !== 'live') throw new Error("mic_track_dead");

    return stream;
  } finally {
    _booting = false;
  }
}