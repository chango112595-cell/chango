import { DebugBus } from '../debug/DebugBus';
import { isDuplicate } from './dupFilter';
import { speakOnce } from './speakOnce';
import { speak as speakCore } from './ttsWrapper';

let synth: SpeechSynthesis | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;

export async function speak(text: string): Promise<void> {
  if (!text) return;
  
  // Check for duplicate text
  if (isDuplicate(text)) {
    DebugBus.emit({ tag: 'TTS', level: 'info', msg: 'Duplicate text filtered' });
    return;
  }
  
  // Create unique ID for this speech request
  const id = `${Date.now()}::${text.slice(0, 40)}`;
  
  // Use speakOnce to prevent rapid repeats
  return new Promise((resolve) => {
    speakOnce(id, text, (textToSpeak) => {
      // Use the wrapped speak function that handles DuplexGuard
      speakCore(textToSpeak);
      
      // Since speakCore doesn't return a promise, we need to listen for completion
      // This is a temporary solution until we refactor the TTS system
      const checkComplete = setInterval(() => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          clearInterval(checkComplete);
          resolve();
        }
      }, 100);
      
      // Timeout after 30 seconds to prevent hanging
      setTimeout(() => {
        clearInterval(checkComplete);
        resolve();
      }, 30000);
    });
  });
}

export function cancelSpeech() {
  if (synth && currentUtterance) {
    synth.cancel();
    currentUtterance = null;
    DebugBus.emit({ tag: 'TTS', level: 'info', msg: 'Speech cancelled' });
  }
}