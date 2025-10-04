import { DebugBus } from '../debug/DebugBus';
import { VoiceGate } from './gate';
import { speak } from './tts';
import { sendToLLM } from '../llm/orchestrator';

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

let recognizer: any = null;

export async function startSTT() {
  stopSTT();
  const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if (!SR) throw new Error('no_speech_recognition');

  recognizer = new SR();
  recognizer.lang = 'en-US';
  recognizer.continuous = true;
  recognizer.interimResults = true;

  recognizer.onresult = async (ev: SpeechRecognitionEvent) => {
    let finalTxt = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) finalTxt += r[0].transcript;
    }
    if (!finalTxt) return;

    const raw = finalTxt.trim();
    DebugBus.emit({ tag:'STT', level:'info', msg:`heard="${raw.toLowerCase()}"` });

    const check = VoiceGate.check(raw);
    if (!check.pass) {
      DebugBus.emit({ tag:'Gate', level:'info', msg:'ignored (no wake word)' });
      return;
    }

    const reply = await sendToLLM(check.cmd);
    DebugBus.emit({ tag:'Orch', level:'ok', msg:`reply="${(reply||'').slice(0,80)}..."` });
    await speak(reply);
  };

  recognizer.onerror = (e:any) => {
    DebugBus.emit({ tag:'STT', level:'error', msg: e?.error || 'stt_error' });
  };
  recognizer.onend = () => {
    DebugBus.emit({ tag:'STT', level:'warn', msg:'recognizer ended – auto-restart' });
    try { recognizer?.start(); } catch {}
  };

  try {
    recognizer.start();
    DebugBus.emit({ tag:'STT', level:'ok', msg:'recognizer started' });
  } catch (e:any) {
    DebugBus.emit({ tag:'STT', level:'error', msg:`start failed: ${e?.message||'unknown'}` });
    throw e;
  }
}

export function stopSTT() {
  if (recognizer) {
    recognizer.onend = null;
    try { recognizer.stop(); } catch {}
    try { recognizer.abort(); } catch {}
    recognizer = null;
  }
}