export function accentize(phonemes, profile = "neutral") {
  const out = [];
  const rules = profiles[profile] || profiles.neutral;
  for (const ph of phonemes) {
    let sym = ph.ph;
    if (rules.vowel[sym]) sym = rules.vowel[sym];
    if (rules.cons[sym]) sym = rules.cons[sym];
    out.push({ ...ph, ph: sym, dur: (ph.dur || 1) * rules.tscale, gain: (ph.gain || 1) * rules.gscale });
  }
  return out;
}
const profiles = {
  neutral: { vowel: {}, cons: {}, tscale: 1, gscale: 1 },
  uk_rp:   { vowel: { ae: "aa", ah: "ax", er: "əː" }, cons: { r: "ɹ" }, tscale: 1.05, gscale: 0.95 },
  us_south:{ vowel: { ih: "iy", ey: "eə", ay: "aə" }, cons: { r: "ɻ" }, tscale: 0.95, gscale: 1.02 }
};