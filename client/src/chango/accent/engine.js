// Rule-based accent shifts; timing skew + vowel/consonant transforms
export function accentize(phonemes, profile = "neutral") {
  const out = [];
  const rules = profiles[profile] || profiles.neutral;
  for (const ph of phonemes) {
    let p = ph;
    if (rules.vowel[p]) p = rules.vowel[p];
    if (rules.cons[p]) p = rules.cons[p];
    out.push({ ...ph, dur: (ph.dur || 1) * rules.tscale, gain: (ph.gain || 1) * rules.gscale });
  }
  return out;
}

const profiles = {
  neutral: { 
    vowel: {}, 
    cons: {}, 
    tscale: 1, 
    gscale: 1 
  },
  uk_rp: { 
    vowel: { ae: "aa", ax: "ah", er: "əː" }, 
    cons: { r: "ɹ" }, 
    tscale: 1.05, 
    gscale: 0.95 
  },
  us_south: { 
    vowel: { ih: "iy", ey: "eə", ay: "aə" }, 
    cons: { r: "ɻ" }, 
    tscale: 0.95, 
    gscale: 1.02 
  }
};