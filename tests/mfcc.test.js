import { MFCC } from "../client/src/chango/audio/mfcc.js";
test("MFCC voiceprint is stable on constant tone", () => {
  const sr = 48000, N = 1024, toneHz = 440;
  const frame = new Float32Array(N);
  for (let i=0;i<N;i++) frame[i] = Math.sin(2*Math.PI*toneHz*i/sr);
  const mfcc = new MFCC({ fftSize: N, sampleRate: sr, melBands: 20, coeffs: 13 });
  const v1 = mfcc.extract(frame);
  const v2 = mfcc.extract(frame);
  let diff = 0; for (let i=0;i<v1.length;i++) diff += Math.abs(v1[i]-v2[i]);
  expect(diff).toBeLessThan(1e-6);
});