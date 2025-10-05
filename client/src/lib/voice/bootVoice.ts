import { getMicrophonePermission } from '@/lib/permissions/microphone';
import { debugBus } from '@/dev/debugBus';
import { bootSttHealthMonitor } from '@/monitor/sttHealth';
import { ensureAudioUnlockedOnce } from '@/lib/audio/unlockAudio';

/**
 * Boot Voice Infrastructure
 * Initializes all voice-related systems including:
 * - Audio unlock for mobile browsers
 * - Microphone permission check and logging
 * - STT Health Monitor for auto-recovery
 */
export async function bootVoiceInfra() {
  // Step 1: Ensure audio is unlocked (for iOS Safari and mobile browsers)
  ensureAudioUnlockedOnce();
  
  // Step 2: Check microphone permissions
  const mic = await getMicrophonePermission();
  
  // Step 3: Log permission status to debug bus
  // Using the actual debugBus API: module, message, data
  if (mic === 'granted') {
    debugBus.info('Permissions', `Microphone: ${mic}`);
  } else if (mic === 'denied') {
    debugBus.error('Permissions', `Microphone: ${mic}`, { 
      help: 'Please enable microphone in browser settings' 
    });
  } else if (mic === 'prompt') {
    debugBus.warn('Permissions', `Microphone: ${mic}`, { 
      help: 'User needs to grant permission when prompted' 
    });
  } else {
    // unsupported
    debugBus.warn('Permissions', `Microphone: ${mic}`, { 
      help: 'Microphone API not supported in this browser' 
    });
  }
  
  // Step 4: Boot STT Health Monitor for auto-recovery
  bootSttHealthMonitor();
  debugBus.info('VoiceInfra', 'Voice infrastructure booted successfully', {
    audioUnlocked: true,
    micPermission: mic,
    healthMonitor: 'started'
  });
}