#!/usr/bin/env node

// CLI WAV exporter - pure Node.js formant synthesis
import { promises as fs } from 'fs';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { text: 'Hello from Chango', out: './out.wav', rate: 1, pitch: 1, sr: 48000 };
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const val = args[i + 1];
    if (key === 'text') opts.text = val;
    else if (key === 'out') opts.out = val;
    else if (key === 'rate') opts.rate = parseFloat(val) || 1;
    else if (key === 'pitch') opts.pitch = parseFloat(val) || 1;
    else if (key === 'sr') opts.sr = parseInt(val) || 48000;
  }
  
  return opts;
}

// G2P dictionary and fallback
const g2pDict = {
  hello: ["hh", "ax", "l", "ow"],
  from: ["f", "r", "ah", "m"],
  chango: ["ch", "ae", "ng", "ow"],
  world: ["w", "er", "l", "d"],
  test: ["t", "eh", "s", "t"],
  voice: ["v", "oy", "s"],
  system: ["s", "ih", "s", "t", "ax", "m"]
};

function g2p(word) {
  const w = word.toLowerCase();
  if (g2pDict[w]) return g2pDict[w];
  
  // Fallback: simple grapheme-to-phoneme
  const chars = w.split('');
  const phonemes = [];
  
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const next = chars[i + 1];
    
    // Handle digraphs
    if (c === 'c' && next === 'h') { phonemes.push('ch'); i++; }
    else if (c === 's' && next === 'h') { phonemes.push('sh'); i++; }
    else if (c === 't' && next === 'h') { phonemes.push('th'); i++; }
    else if (c === 'n' && next === 'g') { phonemes.push('ng'); i++; }
    // Vowels
    else if ('aeiou'.includes(c)) {
      if (c === 'a') phonemes.push('ae');
      else if (c === 'e') phonemes.push('eh');
      else if (c === 'i') phonemes.push('ih');
      else if (c === 'o') phonemes.push('ow');
      else if (c === 'u') phonemes.push('ah');
    }
    // Consonants
    else if ('bcdfghjklmnpqrstvwxyz'.includes(c)) {
      phonemes.push(c);
    }
  }
  
  return phonemes.length > 0 ? phonemes : ['ah'];
}

// Prosody analysis
function prosodyPlan(text) {
  const words = text.toLowerCase().replace(/[.,!?;:]/g, '').split(/\s+/);
  const plan = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const emphasis = i === 0 || i === words.length - 1;
    const boundary = i === words.length - 1 ? 'L%' : 'none';
    plan.push({ word, emphasis, boundary });
  }
  
  return plan;
}

// Phoneme to formant mapping
const formants = {
  // Vowels [F1, F2, F3]
  iy: [270, 2290, 3010],
  ih: [390, 1990, 2550],
  eh: [530, 1840, 2480],
  ae: [660, 1720, 2410],
  aa: [730, 1090, 2440],
  ah: [520, 1190, 2390],
  ao: [570, 840, 2410],
  ow: [300, 870, 2240],
  uw: [300, 870, 2240],
  er: [490, 1350, 1690],
  ax: [500, 1500, 2500],
  
  // Consonants (approximations)
  m: [280, 900, 2200],
  n: [280, 1700, 2600],
  ng: [280, 2300, 2750],
  l: [380, 880, 2575],
  r: [420, 1300, 1600],
  w: [300, 610, 2200],
  y: [260, 2070, 2840],
  
  // Fricatives
  f: [0, 0, 0], // Noise
  v: [300, 1000, 2500],
  s: [0, 0, 0], // High freq noise
  z: [300, 1000, 2500],
  sh: [0, 0, 0], // Noise
  zh: [300, 1000, 2500],
  th: [0, 0, 0], // Noise
  h: [0, 0, 0], // Aspiration
  
  // Plosives
  p: [0, 0, 0], // Silent + burst
  b: [200, 900, 2400],
  t: [0, 0, 0], // Silent + burst
  d: [200, 1700, 2600],
  k: [0, 0, 0], // Silent + burst
  g: [200, 2300, 2750],
  
  // Affricates
  ch: [0, 0, 0], // t + sh
  jh: [200, 1800, 2600], // d + zh
};

// Formant synthesis
function synthesize(phonemes, sampleRate, rate, pitch) {
  const samples = [];
  const baseF0 = 120 * pitch; // Base pitch
  
  for (const ph of phonemes) {
    const formant = formants[ph.ph] || formants['ax'];
    const duration = ph.dur * sampleRate / rate;
    const numSamples = Math.floor(duration);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;
      
      // Fundamental frequency (voiced sounds)
      if (formant[0] > 0) {
        sample += 0.3 * Math.sin(2 * Math.PI * baseF0 * t);
        
        // Add formant resonances
        for (let f = 0; f < 3; f++) {
          const freq = formant[f];
          if (freq > 0) {
            const bandwidth = freq * 0.1;
            const Q = freq / bandwidth;
            const amp = 0.2 / (f + 1);
            
            // Resonant filter approximation
            sample += amp * Math.sin(2 * Math.PI * freq * t) * 
                      Math.exp(-Math.PI * bandwidth * t);
          }
        }
      } else {
        // Unvoiced (noise)
        sample = (Math.random() - 0.5) * 0.3;
      }
      
      // Apply emphasis gain
      if (ph.emphasis) sample *= 1.3;
      
      samples.push(sample);
    }
    
    // Add short pause for boundaries
    if (ph.boundary !== 'none') {
      const pauseDur = ph.boundary === 'L%' ? 0.2 : 0.1;
      const pauseSamples = Math.floor(pauseDur * sampleRate);
      for (let i = 0; i < pauseSamples; i++) {
        samples.push(0);
      }
    }
  }
  
  return samples;
}

// Convert to 16-bit PCM
function toPCM16(samples) {
  const buffer = Buffer.alloc(samples.length * 2);
  
  for (let i = 0; i < samples.length; i++) {
    // Clamp to [-1, 1] and convert to 16-bit
    const val = Math.max(-1, Math.min(1, samples[i]));
    const pcm = Math.floor(val * 32767);
    buffer.writeInt16LE(pcm, i * 2);
  }
  
  return buffer;
}

// Create WAV header
function createWavHeader(dataLength, sampleRate) {
  const buffer = Buffer.alloc(44);
  
  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  
  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // Byte rate
  buffer.writeUInt16LE(2, 32); // Block align
  buffer.writeUInt16LE(16, 34); // Bits per sample
  
  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);
  
  return buffer;
}

// Main function
async function main() {
  const opts = parseArgs();
  
  console.log('🎵 Chango TTS WAV Renderer');
  console.log(`Text: "${opts.text}"`);
  console.log(`Output: ${opts.out}`);
  console.log(`Rate: ${opts.rate}x, Pitch: ${opts.pitch}x, Sample Rate: ${opts.sr}Hz`);
  
  // Process text
  const plan = prosodyPlan(opts.text);
  const phonemeList = [];
  
  for (const unit of plan) {
    const phonemes = g2p(unit.word);
    for (const ph of phonemes) {
      phonemeList.push({
        ph,
        dur: isVowel(ph) ? 0.12 : 0.08,
        emphasis: unit.emphasis,
        boundary: unit.boundary
      });
    }
  }
  
  console.log(`Phonemes: ${phonemeList.map(p => p.ph).join(' ')}`);
  
  // Synthesize audio
  const samples = synthesize(phonemeList, opts.sr, opts.rate, opts.pitch);
  const pcmData = toPCM16(samples);
  
  // Create WAV file
  const header = createWavHeader(pcmData.length, opts.sr);
  const wavBuffer = Buffer.concat([header, pcmData]);
  
  // Write to file
  await fs.writeFile(opts.out, wavBuffer);
  
  console.log(`✅ WAV file written: ${opts.out}`);
  console.log(`Duration: ${(samples.length / opts.sr).toFixed(2)}s`);
  console.log(`Size: ${(wavBuffer.length / 1024).toFixed(2)}KB`);
}

// Helper function
function isVowel(ph) {
  return ['iy', 'ih', 'eh', 'ae', 'aa', 'ah', 'ao', 'ow', 'uw', 'er', 'ax', 'ay', 'ey', 'oy'].includes(ph);
}

// Run
main().catch(console.error);