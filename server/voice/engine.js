// Chango Voice Engine (CVE) — phrase-level prosody planner with natural rhythm
// Output: { text, plan, prosody } for client playback (WebSpeech) or future local TTS.

const VOWELS = /[aeiouyAEIOUY]/;
const PUNCT = /([,;:!?.])/g;
const WORD_SPLIT = /\s+/;

const BASE_PROSODY = {
  rate: 1.0,       // speech rate (1.0 = neutral)
  pitch: 1.0,      // pitch multiplier
  volume: 1.0,     // loudness
  pauseComma: 180, // ms
  pausePeriod: 350,
  pauseClause: 200,
  pauseQuestion: 300,
  pauseExclamation: 250,
  pauseSemicolon: 220,
  pauseEllipsis: 400,
  breathingPause: 150 // natural breathing between longer phrases
};

const EMOTIONS = {
  neutral:  { rate: 1.0, pitch: 1.0, volume: 1.0, pitchVar: .03, rateVar: .04 },
  calm:     { rate: 0.92, pitch: 0.96, volume: 0.93, pitchVar: .02, rateVar: .03 },
  cheerful: { rate: 1.08, pitch: 1.15, volume: 1.10, pitchVar: .18, rateVar: .12 }, // Much more variation
  serious:  { rate: 0.95, pitch: 0.92, volume: 0.96, pitchVar: .02, rateVar: .03 },
  empathetic:{rate:0.96, pitch: 1.04, volume: 1.04, pitchVar: .04, rateVar: .04 }
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

// Common stop words for emphasis detection
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them', 'their', 'this', 'that'
]);

function rand(){ return Math.random(); }
function jitter(v,a){ return +(v + (rand()*2-1)*a).toFixed(3); }

// Parse text into natural phrases based on punctuation boundaries
function parsePhrases(text) {
  const phrases = [];
  let currentPhrase = '';
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    currentPhrase += char;
    
    // Check for phrase boundaries
    if ('.,!?;:'.includes(char)) {
      // Look ahead for ellipsis
      if (char === '.' && i + 1 < text.length && text[i + 1] === '.') {
        // Handle ellipsis
        while (i + 1 < text.length && text[i + 1] === '.') {
          i++;
          currentPhrase += text[i];
        }
      }
      
      // Skip trailing spaces
      while (i + 1 < text.length && text[i + 1] === ' ') {
        i++;
        currentPhrase += text[i];
      }
      
      // Add the phrase if it has content
      if (currentPhrase.trim()) {
        phrases.push(currentPhrase);
        currentPhrase = '';
      }
    }
    
    i++;
  }
  
  // Add any remaining text as final phrase
  if (currentPhrase.trim()) {
    phrases.push(currentPhrase);
  }
  
  return phrases;
}

// Detect if a word is a content word (for emphasis)
function isContentWord(word) {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  return cleaned.length > 3 && !STOP_WORDS.has(cleaned);
}

// Keep the old tokenize function for backward compatibility
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

// New phrase-based prosody planning that preserves punctuation
function planProsody(text, opts) {
  // Handle both old API (tokens array) and new API (text string)
  if (Array.isArray(text)) {
    // Old API compatibility - join tokens preserving punctuation
    text = text.join(' ').replace(/ ([,;:!?.])/g, '$1');
  }
  
  const { accent='neutral', intensity=0.5, emotion='neutral' } = opts||{};
  const emo = EMOTIONS[emotion]||EMOTIONS.neutral;
  const base = { ...BASE_PROSODY };
  const a = ACCENTS[accent]||ACCENTS.neutral;

  const plan = [];
  
  // Parse text into natural phrases
  const phrases = parsePhrases(text);
  
  for (let phraseIndex = 0; phraseIndex < phrases.length; phraseIndex++) {
    const phrase = phrases[phraseIndex];
    const trimmedPhrase = phrase.trim();
    
    if (!trimmedPhrase) continue;
    
    // Apply accent transformation to the whole phrase
    const transformedPhrase = a.transform(trimmedPhrase, intensity);
    
    // Calculate prosody for this phrase
    let phraseRate = jitter(base.rate * emo.rate, emo.rateVar);
    let phrasePitch = jitter(base.pitch * emo.pitch, emo.pitchVar);
    const phraseVolume = jitter(base.volume * emo.volume, 0.05);
    
    // Detect phrase type and adjust prosody
    const isQuestion = trimmedPhrase.includes('?');
    const isExclamation = trimmedPhrase.includes('!');
    const hasEllipsis = trimmedPhrase.includes('...');
    
    if (isQuestion) {
      // Rising intonation for questions
      phrasePitch *= 1.15;
    } else if (isExclamation) {
      // More energy for exclamations
      phrasePitch *= 1.12;
      phraseRate *= 1.05;
    } else if (hasEllipsis) {
      // Slower, more thoughtful for ellipsis
      phraseRate *= 0.92;
    }
    
    // Add natural variation based on phrase position
    if (phraseIndex === 0) {
      // Start with slightly higher energy
      phrasePitch *= 1.02;
    } else if (phraseIndex === phrases.length - 1) {
      // End with slightly lower pitch (unless question)
      if (!isQuestion) {
        phrasePitch *= 0.98;
      }
    }
    
    // Longer phrases need slightly slower rate
    const wordCount = transformedPhrase.split(/\s+/).length;
    if (wordCount > 8) {
      phraseRate *= 0.96;
    } else if (wordCount < 3) {
      phraseRate *= 1.03;
    }
    
    // Add the phrase to the plan
    plan.push({
      type: 'phrase',
      text: transformedPhrase,
      rate: Math.max(0.8, Math.min(1.5, phraseRate)),
      pitch: Math.max(0.8, Math.min(1.5, phrasePitch)),
      volume: Math.max(0.8, Math.min(1.2, phraseVolume)),
      emotion: emotion
    });
    
    // Determine appropriate pause after phrase
    let pauseMs = 100; // Default minimal pause
    
    const lastChar = trimmedPhrase[trimmedPhrase.length - 1];
    if (lastChar === '.') {
      pauseMs = hasEllipsis ? base.pauseEllipsis : base.pausePeriod;
    } else if (lastChar === ',') {
      pauseMs = base.pauseComma;
    } else if (lastChar === '?') {
      pauseMs = base.pauseQuestion;
    } else if (lastChar === '!') {
      pauseMs = base.pauseExclamation;
    } else if (lastChar === ';') {
      pauseMs = base.pauseSemicolon;
    } else if (lastChar === ':') {
      pauseMs = base.pauseClause;
    }
    
    // Add breathing pause for longer phrases
    if (wordCount > 6 && phraseIndex < phrases.length - 1) {
      pauseMs += base.breathingPause;
    }
    
    // Add pause step (except after last phrase)
    if (phraseIndex < phrases.length - 1) {
      plan.push({
        type: 'pause',
        ms: pauseMs
      });
    }
  }
  
  const prosody = {
    engine: 'CVE-2-Phrase',
    route: 'client',
    emotion,
    accent,
    intensity,
    base
  };
  
  // Return the original text with punctuation preserved
  return { text: text, plan, prosody };
}

export { planProsody, tokenize, parsePhrases, ACCENTS, EMOTIONS };