export interface AccentProfile {
  name: string;
  rules: (text: string, intensity: number) => string;
  rateModifier: number;
  pitchModifier: number;
  characteristics: string[];
}

export interface AccentConfig {
  profile: string;
  intensity: number;
  rate: number;
  pitch: number;
}

// Utility functions for accent processing
const chance = (probability: number): boolean => Math.random() < probability;
const jitter = (value: number, amount: number): number => {
  return Math.max(0, value + (Math.random() * 2 - 1) * amount);
};

export const ACCENT_PROFILES: Record<string, AccentProfile> = {
  neutral: {
    name: "Neutral",
    rules: (text: string, intensity: number) => {
      // Add natural pauses
      return text.replace(/,\s*/g, (match) => 
        chance(0.6) ? ", " : ",  "
      ).replace(/\.\s*/g, (match) => 
        chance(0.5) ? ". " : ".  "
      );
    },
    rateModifier: 0,
    pitchModifier: 0,
    characteristics: ["Clear pronunciation", "Natural rhythm"],
  },

  brit_rp: {
    name: "British (RP)",
    rules: (text: string, intensity: number) => {
      let result = text;
      
      // Drop 'r' sounds at word endings
      if (intensity > 0.3) {
        result = result.replace(/([aeiouAEIOU])r\b/g, (match, vowel) => 
          chance(intensity * 0.8) ? vowel : match
        );
      }
      
      // Replace certain vowel sounds
      if (intensity > 0.5) {
        result = result.replace(/\bbath\b/gi, "bahth");
        result = result.replace(/\bask\b/gi, "ahsk");
        result = result.replace(/\bcan't\b/gi, "caahn't");
      }
      
      // Add sophisticated vocabulary preferences
      if (intensity > 0.7) {
        result = result.replace(/\bawesome\b/gi, "brilliant");
        result = result.replace(/\bgreat\b/gi, "smashing");
      }
      
      return result;
    },
    rateModifier: -0.1,
    pitchModifier: 0.1,
    characteristics: ["Non-rhotic", "Refined pronunciation", "Longer vowels"],
  },

  southern_us: {
    name: "Southern US",
    rules: (text: string, intensity: number) => {
      let result = text;
      
      // Common contractions and phrases
      if (intensity > 0.4) {
        result = result.replace(/\byou all\b/gi, "y'all");
        result = result.replace(/\bgoing to\b/gi, "gonna");
        result = result.replace(/\babout to\b/gi, "'bout to");
      }
      
      // Vowel modifications
      if (intensity > 0.6) {
        result = result.replace(/\bi\b/gi, "ah");
        result = result.replace(/\btime\b/gi, "tahm");
        result = result.replace(/\bnice\b/gi, "nahs");
      }
      
      // Draw out certain words
      if (intensity > 0.5) {
        result = result.replace(/\bwell\b/gi, "weell");
        result = result.replace(/\boh\b/gi, "ooh");
      }
      
      return result;
    },
    rateModifier: -0.2,
    pitchModifier: 0.05,
    characteristics: ["Drawn out vowels", "Relaxed pace", "Friendly intonation"],
  },

  spanish_en: {
    name: "Spanish-influenced English",
    rules: (text: string, intensity: number) => {
      let result = text;
      
      // V/B confusion
      if (intensity > 0.3) {
        result = result.replace(/\bvery\b/gi, (match) => 
          chance(intensity * 0.7) ? "bery" : match
        );
        result = result.replace(/\bvolume\b/gi, (match) => 
          chance(intensity * 0.6) ? "bolume" : match
        );
      }
      
      // TH sound modifications
      if (intensity > 0.5) {
        result = result.replace(/th/gi, (match) => {
          const isUpperCase = match === match.toUpperCase();
          return chance(intensity * 0.6) ? 
            (isUpperCase ? "D" : "d") : 
            (isUpperCase ? "T" : "t");
        });
      }
      
      // Rolling R emphasis (represented textually)
      if (intensity > 0.7) {
        result = result.replace(/\brr/gi, "rrrr");
        result = result.replace(/\brough\b/gi, "rrrrough");
      }
      
      return result;
    },
    rateModifier: 0.1,
    pitchModifier: 0.15,
    characteristics: ["TH -> T/D substitution", "V/B confusion", "Rhythmic patterns"],
  },

  caribbean: {
    name: "Caribbean / Jamaican-influenced",
    rules: (text: string, intensity: number) => {
      let result = text;
      
      // TH sound modifications (similar to Spanish but different pattern)
      if (intensity > 0.3) {
        result = result.replace(/th/gi, (match) => {
          const isUpperCase = match === match.toUpperCase();
          return chance(intensity * 0.7) ? 
            (isUpperCase ? "D" : "d") : 
            (isUpperCase ? "T" : "t");
        });
      }
      
      // Distinctive Caribbean expressions
      if (intensity > 0.6) {
        result = result.replace(/\bwhat's up\b/gi, "wha' gwan");
        result = result.replace(/\bokay\b/gi, "alright");
        result = result.replace(/\bno problem\b/gi, "no worries, mon");
      }
      
      // H-dropping in some words
      if (intensity > 0.5) {
        result = result.replace(/\bhim\b/gi, "'im");
        result = result.replace(/\bher\b/gi, "'er");
        result = result.replace(/\bhere\b/gi, "'ere");
      }
      
      return result;
    },
    rateModifier: 0.05,
    pitchModifier: 0.2,
    characteristics: ["Melodic intonation", "H-dropping", "Rhythmic speech patterns"],
  },
};

export function applyAccentToText(text: string, config: AccentConfig): string {
  const profile = ACCENT_PROFILES[config.profile] || ACCENT_PROFILES.neutral;
  return profile.rules(text, config.intensity);
}

export function getAccentParameters(config: AccentConfig): {
  rate: number;
  pitch: number;
} {
  const profile = ACCENT_PROFILES[config.profile] || ACCENT_PROFILES.neutral;
  
  return {
    rate: jitter(config.rate + profile.rateModifier, 0.05),
    pitch: jitter(config.pitch + profile.pitchModifier, 0.03),
  };
}

export function analyzeTextForAccent(text: string): {
  suggestedProfile: string;
  confidence: number;
  characteristics: string[];
} {
  const textLower = text.toLowerCase();
  const scores: Record<string, number> = {};
  
  // Analyze text for accent indicators
  Object.entries(ACCENT_PROFILES).forEach(([key, profile]) => {
    let score = 0;
    
    // Check for characteristic words/phrases
    if (key === "brit_rp") {
      if (textLower.includes("brilliant") || textLower.includes("rather") || textLower.includes("quite")) score += 0.3;
      if (textLower.includes("colour") || textLower.includes("favour")) score += 0.2;
    }
    
    if (key === "southern_us") {
      if (textLower.includes("y'all") || textLower.includes("gonna") || textLower.includes("fixin'")) score += 0.4;
      if (textLower.includes("bless your heart") || textLower.includes("mighty")) score += 0.3;
    }
    
    if (key === "spanish_en") {
      if (textLower.includes("bery") || textLower.includes("ees")) score += 0.3;
      if (textLower.match(/\bt\w+/g)?.some(word => word.includes("th"))) score += 0.2;
    }
    
    scores[key] = score;
  });
  
  // Find highest scoring profile
  const bestMatch = Object.entries(scores).reduce((best, [key, score]) => 
    score > best.score ? { profile: key, score } : best,
    { profile: "neutral", score: 0 }
  );
  
  return {
    suggestedProfile: bestMatch.profile,
    confidence: Math.min(bestMatch.score, 1.0),
    characteristics: ACCENT_PROFILES[bestMatch.profile].characteristics,
  };
}
