/**
 * Microphone Permissions Module
 * Handles microphone permission queries and requests with iOS Safari support
 */

import { debugBus } from '../dev/debugBus';

export interface PermissionStatus {
  granted: boolean;
  state: 'granted' | 'denied' | 'prompt' | 'unknown';
  error?: string;
}

/**
 * Query microphone permission status without prompting
 */
export async function queryMicPermission(): Promise<PermissionStatus> {
  try {
    // Try the Permissions API first (not available in iOS Safari)
    if ('permissions' in navigator && 'query' in navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        const granted = result.state === 'granted';
        
        debugBus.info('Permissions', 'query_result', { state: result.state, granted });
        
        return {
          granted,
          state: result.state as 'granted' | 'denied' | 'prompt'
        };
      } catch (err) {
        // Permissions API not supported for microphone (common in Safari)
        console.log('[Permissions] Permissions API not supported for microphone');
      }
    }

    // Fallback: Check if we already have a stream stored
    const hasStoredStream = sessionStorage.getItem('mic_permission_granted') === 'true';
    if (hasStoredStream) {
      debugBus.info('Permissions', 'cached_permission', { granted: true });
      return {
        granted: true,
        state: 'granted'
      };
    }

    // We can't determine permission without prompting
    debugBus.info('Permissions', 'unknown_permission', {});
    return {
      granted: false,
      state: 'prompt'
    };
  } catch (error) {
    debugBus.error('Permissions', 'query_error', { error: String(error) });
    return {
      granted: false,
      state: 'unknown',
      error: String(error)
    };
  }
}

/**
 * Ensure microphone permission is granted (will prompt if needed)
 * Must be called from a user gesture on iOS Safari
 */
export async function ensureMicPermission(): Promise<PermissionStatus> {
  try {
    debugBus.info('Permissions', 'ensure_permission_start', {});
    
    // First check current status
    const current = await queryMicPermission();
    if (current.granted) {
      debugBus.info('Permissions', 'already_granted', {});
      return current;
    }

    // Try to get user media (will prompt for permission)
    debugBus.info('Permissions', 'requesting_permission', {});
    
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    // Success! Store the permission state
    sessionStorage.setItem('mic_permission_granted', 'true');
    
    // Stop the stream immediately - we just wanted permission
    stream.getTracks().forEach(track => {
      track.stop();
    });

    debugBus.info('Permissions', 'permission_granted', {});
    
    return {
      granted: true,
      state: 'granted'
    };
  } catch (error: any) {
    const errorMessage = String(error);
    let state: 'denied' | 'unknown' = 'unknown';
    
    if (errorMessage.includes('NotAllowedError') || errorMessage.includes('PermissionDeniedError')) {
      state = 'denied';
      debugBus.error('Permissions', 'permission_denied', { error: errorMessage });
    } else {
      debugBus.error('Permissions', 'permission_error', { error: errorMessage });
    }
    
    return {
      granted: false,
      state,
      error: errorMessage
    };
  }
}

/**
 * Check if we're in a secure context (required for getUserMedia)
 */
export function isSecureContext(): boolean {
  return window.isSecureContext === true;
}

/**
 * Check if getUserMedia is available
 */
export function isGetUserMediaAvailable(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Get a diagnostic report of permission capabilities
 */
export function getPermissionDiagnostics() {
  return {
    secureContext: isSecureContext(),
    getUserMediaAvailable: isGetUserMediaAvailable(),
    permissionsApiAvailable: 'permissions' in navigator,
    cachedPermission: sessionStorage.getItem('mic_permission_granted') === 'true',
    userAgent: navigator.userAgent,
    isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
    isIOS: /iPhone|iPad|iPod/.test(navigator.userAgent)
  };
}