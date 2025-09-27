// Chango Voice Engine (CVE) — phoneme+prosody planner with accent & emotion shaping
// Output: { text, plan, prosody } for client playback (WebSpeech) or future local TTS.

const VOWELS = /[aeiouyAEIOUY]/;
const PUNCT = /([,;:!?])/g;
const WORD_SPLIT = /\s+/;

const BASE_PROSODY = {
  rate: 1.0,       // speech rate (1.0 = neutral)
  pitch: 1.0,      // pitch multiplier
  volume: 1.0,     // loudness
  pauseComma: 180, // ms
  pausePeriod: 280,
  pauseClause: 160
};

const EMOTIONS = {
  neutral:  { rate: 1.0, pitch: 1.0, volume: 1.0, pitchVar: .02, rateVar: .03 },
  calm:     { rate: 0.95,pitch: 0.98,volume: 0.95,pitchVar: .01, rateVar: .02 },
  cheerful: { rate: 1.05,pitch: 1.06,volume: 1.05,pitchVar: .03, rateVar: .04 },
  serious:  { rate: 0.97,pitch: 0.94,volume: 0.98,pitchVar: .01, rateVar: .02 },
  empathetic:{rate:0.98,pitch: 1.02,volume: 1.02,pitchVar: .02, rateVar: .02 }
};

const ACCENTS = {
  neutral:   { name: 'Neutral',    transform: (w,i)=>w },
  brit_rp:   { name: 'British RP', transform: (w,i)=> w.replace(/([aeiouAEIOU])r\b/g,(m,v)=>v) },
  southern_us:{name:'Southern US', transform: (w,i)=> i>.4 ? w.replace(/\byou all\b/ig,'y\'all') : w },
  spanish_en:{name:'Spanish-EN',   transform: (w,i)=> {
    let x=w; if(i>.3) x=x.replace(/\bvery\b/ig,'bery');
    if(i>.5) x=x.replace(/th/g,'d').replace(/TH/g,'D');
    return x;
  }},
  caribbean: { name:'Caribbean',   transform: (w,i)=> i>.35 ? w.replace(/th/g,'t').replace(/TH/g,'T') : w }
};

function rand(){ return Math.random(); }
function jitter(v,a){ return +(v + (rand()*2-1)*a).toFixed(3); }

function tokenize(text){
  // split but keep punctuation tokens
  const out=[]; let buf='';
  for(const ch of text){
    if(',.;:!?'.includes(ch)){ if(buf) out.push(buf), buf=''; out.push(ch); }
    else if(/\s/.test(ch)){ if(buf) out.push(buf), buf=''; }
    else buf+=ch;
  }
  if(buf) out.push(buf);
  return out;
}

function phonemize(word){
  // ultra-light heuristic phonemizer (placeholder for future ML)
  const w = word.toLowerCase();
  const syl = Math.max(1, (w.match(VOWELS)||[]).length);
  return { syl };
}

function planProsody(tokens, opts){
  const { accent='neutral', intensity=0.5, emotion='neutral' } = opts||{};
  const emo = EMOTIONS[emotion]||EMOTIONS.neutral;
  const base = { ...BASE_PROSODY };
  const a = ACCENTS[accent]||ACCENTS.neutral;

  const plan=[]; let outWords=[];
  for(let i=0;i<tokens.length;i++){
    const t = tokens[i];
    if(',;:'.includes(t)){ plan.push({ type:'pause', ms: base.pauseComma }); continue; }
    if('!?'.includes(t)){ plan.push({ type:'pause', ms: base.pauseClause+60 }); continue; }
    if('.'.includes(t)){ plan.push({ type:'pause', ms: base.pausePeriod }); continue; }
    const wAcc = a.transform(t, intensity);
    const ph = phonemize(wAcc);
    // syllable-based micro-timing
    const rate = jitter(base.rate*emo.rate*(1 + (ph.syl-1)*0.02), emo.rateVar);
    const pitch= jitter(base.pitch*emo.pitch, emo.pitchVar);
    const vol  = base.volume*emo.volume;
    plan.push({ type:'word', w:wAcc, rate, pitch, volume: vol });
    outWords.push(wAcc);
    // gentle micro pause between long words
    if(wAcc.length>10 && rand()<0.25) plan.push({ type:'pause', ms: 60 });
  }

  // smooth pauses: merge neighbors, cap extremes
  for(let i=1;i<plan.length;i++){
    if(plan[i-1].type==='pause' && plan[i].type==='pause'){
      plan[i-1].ms = Math.min(600, plan[i-1].ms + plan[i].ms);
      plan.splice(i,1); i--;
    }
  }

  const prosody = {
    engine: 'CVE-1',
    route: 'client',
    emotion,
    accent,
    intensity,
    base
  };
  return { text: outWords.join(' '), plan, prosody };
}

export { planProsody, tokenize, ACCENTS, EMOTIONS };