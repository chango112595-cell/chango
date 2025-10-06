// ToBI-lite phrasing + simple contouring: interrogatives rise, commas pause, emphasis via **bold** markers
export function prosodyPlan(text) {
  const raw = (text || "").trim();
  const spans = splitIntoPhrases(raw).map(seg => toPhonPlans(seg));
  return spans.flat();
}

function splitIntoPhrases(t) {
  return t.split(/([.?!,;:])/).reduce((acc, cur, idx, arr) => {
    if (!cur) return acc; 
    if (" .?!,;:".includes(cur) && idx > 0) { 
      acc[acc.length - 1] += cur; 
    }
    else acc.push(cur); 
    return acc;
  }, []).map(s => s.trim()).filter(Boolean);
}

function toPhonPlans(phrase) {
  const isQ = /[?]$/.test(phrase);
  const words = phrase.replace(/[.?!,;:]/g, "").split(/\s+/);
  return words.map((w, i) => ({
    word: w,
    emphasis: /\*{2}[^*]+\*{2}/.test(w),
    boundary: (i === words.length - 1) ? (isQ ? "H%" : "L%") : (i % 3 === 2 ? "ip" : "none")
  }));
}