import { getMicrophonePermission, isPermissionDenied } from '@/lib/permissions/microphone';
import { debugBus } from '@/dev/debugBus';
import { bootSttHealthMonitor } from '@/monitor/sttHealth';
import { ensureAudioUnlockedOnce, isAudioUnlocked } from '@/lib/audio/unlockAudio';

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
    debugBus.info('Permissions', `Microphone: ${mic}`, {
      audioUnlocked: isAudioUnlocked()
    });
  } else if (mic === 'denied') {
    debugBus.error('Permissions', `Microphone: ${mic}`, { 
      help: 'Please enable microphone in browser settings',
      permanentlyDenied: isPermissionDenied(),
      action: 'Voice features will be disabled until permission is granted'
    });
    
    // Don't boot health monitor if permission is denied
    debugBus.warn('VoiceInfra', 'Skipping STT Health Monitor - permission denied');
    return {
      success: false,
      reason: 'permission_denied',
      micPermission: mic
    };
  } else if (mic === 'prompt') {
    debugBus.warn('Permissions', `Microphone: ${mic}`, { 
      help: 'User needs to grant permission when prompted',
      action: 'Will ask for permission when voice features are used'
    });
  } else {
    // unsupported
    debugBus.warn('Permissions', `Microphone: ${mic}`, { 
      help: 'Microphone API not supported in this browser',
      action: 'Voice features may not work properly'
    });
  }
  
  // Step 4: Boot STT Health Monitor only if we have permission or might get it
  if (mic === 'granted' || mic === 'prompt' || mic === 'unsupported') {
    bootSttHealthMonitor();
    debugBus.info('VoiceInfra', 'Voice infrastructure booted successfully', {
      audioUnlocked: isAudioUnlocked(),
      micPermission: mic,
      healthMonitor: 'started'
    });
    return {
      success: true,
      micPermission: mic
    };
  } else {
    debugBus.warn('VoiceInfra', 'Voice infrastructure partially booted', {
      audioUnlocked: isAudioUnlocked(),
      micPermission: mic,
      healthMonitor: 'skipped'
    });
    return {
      success: false,
      reason: 'permission_issue',
      micPermission: mic
    };
  }
}