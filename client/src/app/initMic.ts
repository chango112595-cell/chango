/**
 * Microphone Permission Helper
 * Ensures microphone permission on app start (Safari/iOS safe)
 */

import { debugBus } from '../dev/debugBus';
import { FEATURES } from '../config/featureFlags';

export interface MicPermissionResult {
  granted: boolean;
  error?: string;
  deviceAvailable: boolean;
  permissionState?: PermissionState;
}

/**
 * Check current microphone permission state (if available)
 */
async function checkPermissionState(): Promise<PermissionState | null> {
  try {
    // Check if Permissions API is available
    if ('permissions' in navigator) {
      // Note: microphone permission query may not be available in all browsers
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return permission.state;
    }
  } catch (error) {
    // Permissions API not available or microphone permission query not supported
    console.log('[InitMic] Permissions API not available for microphone');
  }
  return null;
}

/**
 * Test microphone access with Safari/iOS safe implementation
 */
async function testMicrophoneAccess(): Promise<MicPermissionResult> {
  try {
    // Check if MediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        granted: false,
        error: 'MediaDevices API not available',
        deviceAvailable: false
      };
    }

    // Safari/iOS specific: Create a user gesture handler if needed
    // This is handled by the UI layer when user clicks a button

    // Request microphone access with minimal constraints
    const constraints: MediaStreamConstraints = {
      audio: {
        // Use basic constraints for maximum compatibility
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };

    // Try to get stream
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Check if we got audio tracks
    const audioTracks = stream.getAudioTracks();
    
    if (audioTracks.length === 0) {
      // No audio tracks available
      stream.getTracks().forEach(track => track.stop());
      return {
        granted: false,
        error: 'No audio tracks available',
        deviceAvailable: false
      };
    }

    // Check track state
    const track = audioTracks[0];
    const deviceAvailable = track.readyState === 'live' && !track.muted;
    
    console.log('[InitMic] Microphone track info:', {
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState
    });

    // Stop the stream - we only needed to test access
    stream.getTracks().forEach(track => track.stop());

    return {
      granted: true,
      deviceAvailable,
      permissionState: await checkPermissionState() || undefined
    };

  } catch (error: any) {
    console.error('[InitMic] Microphone access test failed:', error);
    
    // Analyze error type
    let errorMessage = 'Unknown error';
    let granted = false;
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      errorMessage = 'Microphone permission denied';
    } else if (error.name === 'NotFoundError' || error.name === 'DeviceNotFoundError') {
      errorMessage = 'No microphone device found';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      errorMessage = 'Microphone in use by another application';
    } else if (error.name === 'OverconstrainedError') {
      errorMessage = 'Audio constraints could not be satisfied';
    } else if (error.name === 'TypeError') {
      errorMessage = 'Invalid audio constraints';
    }
    
    return {
      granted,
      error: errorMessage,
      deviceAvailable: false
    };
  }
}

/**
 * Initialize microphone permission on app start
 * Returns true if permission is granted, false otherwise
 */
export async function initializeMicrophone(): Promise<MicPermissionResult> {
  console.log('[InitMic] Initializing microphone permission check...');
  
  if (FEATURES.DEBUG_BUS) {
    debugBus.info('InitMic', 'Starting initialization');
  }

  // Check current permission state first (if available)
  const permissionState = await checkPermissionState();
  
  if (permissionState) {
    console.log('[InitMic] Current permission state:', permissionState);
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('InitMic', 'Permission state', { state: permissionState });
    }

    // If already denied, don't try to request again
    if (permissionState === 'denied') {
      return {
        granted: false,
        error: 'Microphone permission previously denied',
        deviceAvailable: false,
        permissionState
      };
    }
  }

  // Test microphone access
  const result = await testMicrophoneAccess();
  
  // Log result
  if (result.granted) {
    console.log('[InitMic] ✅ Microphone permission granted and device available');
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('InitMic', 'Permission granted', { 
        deviceAvailable: result.deviceAvailable 
      });
    }
  } else {
    console.warn('[InitMic] ⚠️ Microphone permission not granted:', result.error);
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.warn('InitMic', 'Permission not granted', { 
        error: result.error,
        deviceAvailable: result.deviceAvailable 
      });
    }
  }

  return result;
}

/**
 * Request microphone permission with user gesture (for Safari/iOS)
 * This should be called from a user interaction event handler
 */
export async function requestMicrophoneWithGesture(): Promise<MicPermissionResult> {
  console.log('[InitMic] Requesting microphone with user gesture...');
  
  if (FEATURES.DEBUG_BUS) {
    debugBus.info('InitMic', 'User gesture request');
  }

  // This function should be called from a button click or similar user gesture
  // Safari/iOS requires user gesture for getUserMedia
  
  return await testMicrophoneAccess();
}

/**
 * Monitor microphone permission changes
 */
export function monitorMicrophonePermission(callback: (result: MicPermissionResult) => void): () => void {
  let intervalId: NodeJS.Timeout | null = null;
  let lastState: PermissionState | null = null;

  const checkPermission = async () => {
    const state = await checkPermissionState();
    
    if (state && state !== lastState) {
      lastState = state;
      
      // Permission state changed
      if (state === 'granted') {
        const result = await testMicrophoneAccess();
        callback(result);
      } else {
        callback({
          granted: false,
          error: `Permission ${state}`,
          deviceAvailable: false,
          permissionState: state
        });
      }
    }
  };

  // Check immediately
  checkPermission();

  // Set up periodic monitoring
  intervalId = setInterval(checkPermission, 2000); // Check every 2 seconds

  // Return cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}

/**
 * Get browser microphone compatibility info
 */
export function getMicrophoneCompatibility() {
  const info = {
    hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    hasPermissionsAPI: 'permissions' in navigator,
    hasSpeechRecognition: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
    isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream,
    requiresUserGesture: false
  };

  // Safari and iOS require user gesture for getUserMedia
  info.requiresUserGesture = info.isSafari || info.isIOS;

  return info;
}

/**
 * Preload and cache microphone permission on app start
 */
export async function preloadMicrophonePermission(): Promise<void> {
  console.log('[InitMic] Preloading microphone permission...');
  
  // Get compatibility info
  const compatibility = getMicrophoneCompatibility();
  
  console.log('[InitMic] Browser compatibility:', compatibility);
  
  if (FEATURES.DEBUG_BUS) {
    debugBus.info('InitMic', 'Compatibility check', compatibility);
  }

  // Only auto-request if not requiring user gesture
  if (!compatibility.requiresUserGesture) {
    await initializeMicrophone();
  } else {
    console.log('[InitMic] User gesture required for microphone access (Safari/iOS)');
  }
}