import { useRef } from 'react';
import { VAD } from './vad';
import { useVoiceprint } from '../hooks/useVoiceprint';
import { voiceBus } from './voiceBus';

// Simplified Voice Orchestrator with VAD + Voiceprint + Barge-in
export function useVoiceOrchestrator(){
  const vadRef = useRef<VAD>();
  const { checkMatch } = useVoiceprint();
  const streamRef = useRef<MediaStream>();

  const startMic = async () => {
    // Check voice gate
    const gate = await checkMatch();
    if(!gate.ok){
      console.warn('Voice gate blocked. score=', gate.score.toFixed(2));
      return;
    }

    // Get microphone stream
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
    } catch (err) {
      console.error('Failed to get microphone access:', err);
      return;
    }

    // Initialize VAD
    vadRef.current = vadRef.current ?? new VAD();
    await vadRef.current.start(streamRef.current);
    
    // Setup VAD event handlers
    vadRef.current.on(ev=>{
      if(ev.type==='speech_start' && window.speechSynthesis?.speaking){
        // Barge-in: stop TTS so user can speak
        window.speechSynthesis.cancel();
        voiceBus.emit({ type: 'cancelSpeak', source: 'system' });
      }
      if(ev.type==='speech_end'){
        // Auto-idle after 1 second of silence
        setTimeout(()=> {
          console.log('Auto-idle after silence');
        }, 1000);
      }
    });
  };

  const stopMic = async ()=> {
    vadRef.current?.stop();
    if(streamRef.current){
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = undefined;
    }
  };

  return { startMic, stopMic };
}