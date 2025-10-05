/**
 * TTS Wrapper Module
 * Wraps the Web Speech API with DuplexGuard integration
 * Manages speaking state to prevent audio feedback loops
 */

import { DuplexGuard } from './duplexGuard';

export function speak(text: string) {
  const u = new SpeechSynthesisUtterance(text);
  
  u.onstart = () => {
    console.log('[TTSWrapper] Speech started');
    DuplexGuard.setSpeaking(true);
  };
  
  const end = () => {
    console.log('[TTSWrapper] Speech ended');
    DuplexGuard.setSpeaking(false);
  };
  
  u.onend = end;
  u.onerror = (e) => {
    console.error('[TTSWrapper] Speech error:', e);
    end();
  };
  
  // Cancel any ongoing speech before starting new
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  
  window.speechSynthesis.speak(u);
}