import { DebugBus } from '../debug/DebugBus';

let synth: SpeechSynthesis | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;

export async function speak(text: string): Promise<void> {
  if (!text) return;
  
  if (!synth) synth = window.speechSynthesis;
  if (!synth) {
    DebugBus.emit({ tag: 'TTS', level: 'error', msg: 'No speech synthesis available' });
    return;
  }

  // Cancel any current speech
  if (currentUtterance) {
    synth.cancel();
    currentUtterance = null;
  }

  return new Promise((resolve) => {
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.rate = 1.0;
    currentUtterance.pitch = 1.0;
    currentUtterance.volume = 1.0;
    
    currentUtterance.onend = () => {
      DebugBus.emit({ tag: 'TTS', level: 'info', msg: 'Speech ended' });
      currentUtterance = null;
      resolve();
    };
    
    currentUtterance.onerror = (e) => {
      DebugBus.emit({ tag: 'TTS', level: 'error', msg: 'Speech error', data: e });
      currentUtterance = null;
      resolve();
    };

    if (synth) {
      synth.speak(currentUtterance);
    }
    DebugBus.emit({ tag: 'TTS', level: 'info', msg: `Speaking: "${text.slice(0,50)}..."` });
  });
}

export function cancelSpeech() {
  if (synth && currentUtterance) {
    synth.cancel();
    currentUtterance = null;
    DebugBus.emit({ tag: 'TTS', level: 'info', msg: 'Speech cancelled' });
  }
}