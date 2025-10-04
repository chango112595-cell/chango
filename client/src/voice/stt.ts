/**
 * Speech-to-Text (STT) Module
 * ===========================
 * 
 * @module voice/stt
 * @description Handles speech recognition using the Web Speech API.
 * 
 * **Responsibilities:**
 * - Manages browser's SpeechRecognition API
 * - Processes voice input and converts to text
 * - Filters commands through wake word detection
 * - Routes recognized text to responder service
 * 
 * **Dependencies:**
 * - debugBus: For logging and debugging
 * - responder: For generating responses to commands
 * - voiceController: For text-to-speech output
 * - system.config: For STT configuration values
 * 
 * **Module Boundary:**
 * This module is a low-level voice input handler. It should not contain
 * business logic or UI concerns. It only handles the technical aspects
 * of speech recognition and passes results to higher-level services.
 */

import { debugBus } from '../dev/debugBus';
import { responder } from '../services/responder';
import { voiceController } from './voiceController';
import { STT_CONFIG, WAKE_WORD_CONFIG, STORAGE_KEYS } from '../config/system.config';

/** STT initialization options */
export type STTOpts = { stream: MediaStream };

/** Internal recognizer instance */
let recognizer: any = null;

/** Get the configured wake word */
const WAKE = (localStorage.getItem(STORAGE_KEYS.local.wakeWord) || WAKE_WORD_CONFIG.primary).toLowerCase();

/**
 * Start speech-to-text recognition
 * @param opts - Options including the media stream
 * @throws Error if speech recognition is not available
 */
export async function startSTT(opts: STTOpts): Promise<void> {
  stopSTT(); // clean old
  const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if (!SR) throw new Error('no_speech_recognition');

  recognizer = new SR();
  recognizer.lang = STT_CONFIG.language;
  recognizer.continuous = STT_CONFIG.continuous;
  recognizer.interimResults = STT_CONFIG.interimResults;

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

/**
 * Stop speech-to-text recognition
 */
export function stopSTT(): void {
  try { recognizer?.stop(); } catch {}
  recognizer = null;
}

/**
 * Check if STT is currently active
 * @returns True if recognizer exists and is active
 */
export function isSTTActive(): boolean {
  return recognizer !== null;
}