// MFCC(13) + Δ/ΔΔ for simple voiceprint; offline extractor
import { audioContextPool as ctxPool } from "./contextPool.js";

export class MFCC {
  constructor({ fftSize = 1024, sampleRate = 48000, melBands = 24, coeffs = 13 } = {}) {
    this.fftSize = fftSize; this.sampleRate = sampleRate; this.melBands = melBands; this.coeffs = coeffs;
    this._hann = new Float32Array(fftSize).map((_, i) => 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1))));
  }
  _fftReIm(x) { // Radix-2 Cooley–Tukey (compact)
    const N = x.length; const re = x.slice(); const im = new Float32Array(N);
    for (let i = 0, j = 0; i < N; i++) { if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
      let m = N >> 1; while (j >= m && m >= 2) { j -= m; m >>= 1; } j += m; }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1; const step = (2 * Math.PI) / size;
      for (let i = 0; i < N; i += size) {
        for (let k = 0; k < half; k++) {
          const ang = step * k; const wr = Math.cos(ang), wi = -Math.sin(ang);
          const tr = wr * re[i + k + half] - wi * im[i + k + half];
          const ti = wr * im[i + k + half] + wi * re[i + k + half];
          re[i + k + half] = re[i + k] - tr; im[i + k + half] = im[i + k] - ti;
          re[i + k] += tr; im[i + k] += ti;
        }
      }
    }
    return { re, im };
  }
  _hz2mel(hz) { return 2595 * Math.log10(1 + hz / 700); }
  _mel2hz(m) { return 700 * (Math.pow(10, m / 2595) - 1); }
  _melFilterbank() {
    const sr = this.sampleRate; const nfft = this.fftSize; const nb = this.melBands;
    const mMin = this._hz2mel(20), mMax = this._hz2mel(sr / 2);
    const mpts = new Array(nb + 2).fill(0).map((_, i) => mMin + (i * (mMax - mMin)) / (nb + 1)).map(m => this._mel2hz(m));
    const bins = mpts.map(f => Math.floor((nfft + 1) * f / sr));
    const fb = Array.from({ length: nb }, () => new Float32Array(nfft / 2 + 1));
    for (let i = 0; i < nb; i++) {
      for (let k = bins[i]; k < bins[i + 1]; k++) fb[i][k] = (k - bins[i]) / (bins[i + 1] - bins[i]);
      for (let k = bins[i + 1]; k < bins[i + 2]; k++) fb[i][k] = (bins[i + 2] - k) / (bins[i + 2] - bins[i + 1]);
    }
    return fb;
  }
  _dct(melE) { // DCT-II
    const K = this.coeffs; const N = melE.length; const out = new Float32Array(K);
    for (let k = 0; k < K; k++) {
      let sum = 0; for (let n = 0; n < N; n++) sum += melE[n] * Math.cos(Math.PI * k * (2 * n + 1) / (2 * N));
      out[k] = sum * Math.sqrt(2 / N);
    }
    return out;
  }
  extract(frame) {
    const x = frame.slice(0, this.fftSize);
    for (let i = 0; i < x.length; i++) x[i] *= this._hann[i]; // window
    const { re, im } = this._fftReIm(x);
    const mag = new Float32Array(re.length / 2);
    for (let i = 0; i < mag.length; i++) mag[i] = Math.hypot(re[i], im[i]);
    const fb = this._melFilterbank();
    const mel = new Float32Array(fb.length);
    for (let i = 0; i < fb.length; i++) {
      let s = 0; for (let k = 0; k < fb[i].length; k++) s += fb[i][k] * mag[k];
      mel[i] = Math.log(1e-8 + s);
    }
    return this._dct(mel);
  }
  voiceprint(frames) {
    const mfccs = frames.map(f => this.extract(f));
    const mean = new Float32Array(this.coeffs);
    for (const v of mfccs) for (let i = 0; i < mean.length; i++) mean[i] += v[i];
    for (let i = 0; i < mean.length; i++) mean[i] /= mfccs.length;
    return mean;
  }
  cosine(a, b) {
    let s = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return s / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
  }
}