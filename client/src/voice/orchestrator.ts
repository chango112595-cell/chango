import { useRef } from 'react';
import { VAD } from './vad';
import { useVoiceprint } from '../hooks/useVoiceprint';
import { voiceBus } from './voiceBus';
import { debugBus } from '../dev/debugBus';
import { FEATURES } from '../config/features';
import { beat } from '../dev/health/monitor';

// Simplified Voice Orchestrator with VAD + Voiceprint + Barge-in
export function useVoiceOrchestrator(){
  const vadRef = useRef<VAD>();
  const { checkMatch } = useVoiceprint();
  const streamRef = useRef<MediaStream>();

  const startMic = async () => {
    // Emit orchestrator heartbeat
    beat('orchestrator', { action: 'startMic' });
    
    // Check voice gate
    const gate = await checkMatch();
    
    // Emit gate check result
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('Orchestrator', 'gate_check', { 
        allowed: gate.ok, 
        score: gate.score 
      });
    }
    beat('orchestrator', { action: 'gate_check', allowed: gate.ok, score: gate.score });
    
    if(!gate.ok){
      console.warn('Voice gate blocked. score=', gate.score.toFixed(2));
      
      // Emit gate blocked event
      if (FEATURES.DEBUG_BUS) {
        debugBus.warn('Orchestrator', 'gate_blocked', { 
          score: gate.score 
        });
      }
      
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
    
    // Emit VAD integration event
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('Orchestrator', 'vad_integrated', { 
        hasStream: !!streamRef.current 
      });
    }
    beat('orchestrator', { action: 'vad_integrated' });
    
    // Setup VAD event handlers
    vadRef.current.on(ev=>{
      if(ev.type==='speech_start' && window.speechSynthesis?.speaking){
        // Barge-in: stop TTS so user can speak
        window.speechSynthesis.cancel();
        voiceBus.emit({ type: 'cancelSpeak', source: 'system' });
        
        // Emit barge-in event
        if (FEATURES.DEBUG_BUS) {
          debugBus.info('Orchestrator', 'barge_in_triggered', { 
            ttsSpeaking: true 
          });
        }
      }
      if(ev.type==='speech_end'){
        // Auto-idle after 1 second of silence
        setTimeout(()=> {
          console.log('Auto-idle after silence');
          
          // Emit auto-idle event
          if (FEATURES.DEBUG_BUS) {
            debugBus.info('Orchestrator', 'auto_idle', { 
              silenceDuration: 1000 
            });
          }
        }, 1000);
      }
    });
  };

  const stopMic = async ()=> {
    // Emit orchestrator stop event
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('Orchestrator', 'stopMic', { 
        hadVAD: !!vadRef.current,
        hadStream: !!streamRef.current 
      });
    }
    beat('orchestrator', { action: 'stopMic' });
    
    vadRef.current?.stop();
    if(streamRef.current){
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = undefined;
    }
  };

  return { startMic, stopMic };
}