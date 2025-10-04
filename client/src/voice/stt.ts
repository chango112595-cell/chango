// client/src/voice/stt.ts
import { debugBus } from '../dev/debugBus';
import { responder } from '../services/responder'; // your text → reply
import { voiceController } from './voiceController'; // for TTS speak

type STTOpts = { stream: MediaStream };
let recognizer: any = null;

const WAKE = (localStorage.getItem('wake_word') || 'lolo').toLowerCase();

export async function startSTT(opts: STTOpts) {
  stopSTT(); // clean old
  const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if (!SR) throw new Error('no_speech_recognition');

  recognizer = new SR();
  recognizer.lang = 'en-US';
  recognizer.continuous = true;
  recognizer.interimResults = true;

  recognizer.onresult = async (ev: any) => {
    let finalTxt = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) finalTxt += r[0].transcript;
    }
    if (!finalTxt) return;

    const raw = finalTxt.trim().toLowerCase();
    debugBus.info('STT', `heard="${raw}"`);

    // Respond ONLY if addressed (wake word first or "@lolo" in text UI)
    const wakeIdx = raw.indexOf(WAKE);
    if (wakeIdx === -1) {
      debugBus.info('Gate', 'ignored (no wake word)');
      return;
    }
    const command = raw.slice(wakeIdx + WAKE.length).replace(/^[\s,.:;-]+/,'');
    if (!command) return;

    const reply = await responder.respond(command);
    debugBus.info('Orch', `reply="${reply?.slice(0,80)}..."`);
    
    // Use the existing voice controller to speak
    if (voiceController) {
      await voiceController.speak(reply);
    }
  };

  recognizer.onerror = (e:any) => {
    debugBus.error('STT', e?.error || 'stt_error');
  };
  
  recognizer.onend = () => {
    debugBus.warn('STT', 'recognizer ended – auto-restart');
    try { recognizer?.start(); } catch {}
  };

  try {
    recognizer.start();
    debugBus.info('STT', 'recognizer started');
  } catch (e:any) {
    debugBus.error('STT', `start failed: ${e?.message||e}`);
    throw e;
  }
}

export function stopSTT() {
  try { recognizer?.stop(); } catch {}
  recognizer = null;
}