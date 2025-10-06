// Why: keep G2P and timeline pure for testing.
export function wordsToPhones(plan) {
  const dict = { hello:["h","eh","l","ow"], world:["w","er","l","d"], chango:["ch","aa","ng","ow"], jarvis:["jh","aa","r","v","ih","s"] };
  const out = [];
  for (const unit of plan) {
    const w = unit.word.toLowerCase().replace(/\*|_/g, "");
    const phs = dict[w] || fallbackGrapheme(w);
    for (const ph of phs) out.push({ ph, dur: 1, gain: 1 });
    const boundary = unit.boundary;
    out.push({ ph: "pau", dur: boundary === "H%" ? 1.4 : boundary === "ip" ? 0.7 : 0.5 });
  }
  return out;
}
export function fallbackGrapheme(w){
  const seq=[]; for(let i=0;i<w.length;i++){ const c=w[i];
    if ("aeiou".includes(c)) seq.push(vowel(c, w[i+1]||""));
    else seq.push(cons(c));
  } return seq;
}
export function vowel(v, n){ return v==="a"?(["e","y"].includes(n)?"ey":"ae"):v==="e"?"eh":v==="i"?"ih":v==="o"?(n==="w"?"ow":"ao"):v==="u"?"uw":"ah"; }
export function cons(c){ const map={b:"b",c:"k",d:"d",f:"f",g:"g",h:"h",j:"jh",k:"k",l:"l",m:"m",n:"n",p:"p",q:"k",r:"r",s:"s",t:"t",v:"v",w:"w",x:"k",y:"y",z:"z"}; return map[c]||"pau"; }
export function toTimeline(phs){ return phs.map(p=>({ ph: p.ph, dur: (p.dur||1)*0.08, gain: p.gain||1 })); }