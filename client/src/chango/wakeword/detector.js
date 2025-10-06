// Tiny mel-template DTW matcher for wake word; expects short-cut template vectors
import { bus } from "../core/eventBus.js";
import { MFCC } from "../audio/mfcc.js";

export class WakeWordDetector {
  constructor({ name = "lolo", thresh = 0.72 } = {}) {
    this.name = name; this.thresh = thresh; this.mfcc = new MFCC(); this.templates = [];
  }
  enroll(templateFrames) { this.templates.push(templateFrames); }
  score(seq, tmpl) { // cosine mean over aligned frames (naive length match)
    const L = Math.min(seq.length, tmpl.length); let s = 0;
    for (let i = 0; i < L; i++) s += this.mfcc.cosine(seq[i], tmpl[i]);
    return s / L;
  }
  detect(seq) {
    let best = -1; for (const t of this.templates) best = Math.max(best, this.score(seq, t));
    if (best >= this.thresh) bus.emit("wake:hit", { phrase: this.name, score: best });
  }
}