export type MicState = 'granted' | 'prompt' | 'denied' | 'unsupported';

// Track if permission was explicitly denied to avoid retry loops
let permissionDeniedFlag = false;
let lastPermissionCheck = 0;
const PERMISSION_CACHE_TIME = 5000; // Cache permission result for 5 seconds

export function isPermissionDenied(): boolean {
  return permissionDeniedFlag;
}

export function clearPermissionDenied(): void {
  permissionDeniedFlag = false;
  console.log('[Microphone] Permission denied flag cleared');
}

export async function getMicrophonePermission(): Promise<MicState> {
  // Use cached result if recent to avoid spamming permission checks
  if (permissionDeniedFlag && Date.now() - lastPermissionCheck < PERMISSION_CACHE_TIME) {
    return 'denied';
  }
  
  lastPermissionCheck = Date.now();
  
  try {
    if (!('permissions' in navigator)) {
      console.warn('[Microphone] Permissions API not supported');
      return 'unsupported';
    }
    
    // @ts-ignore
    const status = await navigator.permissions.query({ name: 'microphone' });
    const state = status.state as MicState;
    
    // Track if permission was denied
    if (state === 'denied') {
      permissionDeniedFlag = true;
      console.warn('[Microphone] Permission is denied - will not retry');
    } else if (state === 'granted') {
      permissionDeniedFlag = false;
    }
    
    return state ?? 'unsupported';
  } catch (err) {
    console.warn('[Microphone] Failed to query permission:', err);
    return 'unsupported';
  }
}

export async function requestMicrophoneIfNeeded(): Promise<boolean> {
  // Don't even try if we know permission was denied
  if (permissionDeniedFlag) {
    console.warn('[Microphone] Permission was previously denied - not requesting again');
    return false;
  }
  
  const state = await getMicrophonePermission();
  
  if (state === 'denied') {
    permissionDeniedFlag = true;
    console.error('[Microphone] Permission denied - user must enable in browser settings');
    return false;
  }
  
  if (state === 'granted') {
    permissionDeniedFlag = false;
    return true;
  }
  
  // State is 'prompt' or 'unsupported' - try to request
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });
    
    // Clean up the stream immediately
    stream.getTracks().forEach(track => track.stop());
    
    permissionDeniedFlag = false;
    console.log('[Microphone] Permission granted');
    return true;
  } catch (err: any) {
    const errorName = err?.name || '';
    const errorMessage = err?.message || '';
    
    // Check if this is a permission denial
    if (errorName === 'NotAllowedError' || 
        errorName === 'SecurityError' || 
        errorName === 'PermissionDeniedError' ||
        errorMessage.includes('Permission denied') ||
        errorMessage.includes('not allowed')) {
      permissionDeniedFlag = true;
      console.error('[Microphone] Permission denied by user:', errorMessage);
    } else if (errorName === 'NotFoundError') {
      console.error('[Microphone] No microphone device found');
    } else {
      console.error('[Microphone] Failed to get microphone access:', errorName, errorMessage);
    }
    
    return false;
  }
}