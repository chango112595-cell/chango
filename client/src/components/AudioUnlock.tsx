import React from 'react';

export function AudioUnlock() {
  const [ok, setOk] = React.useState<boolean>(() => !!sessionStorage.getItem('audio_unlocked'));
  
  // Check if iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (ok && !isIOS) return null;
  
  const handleUnlock = async () => {
    try {
      // Create and unlock audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // Create a short silence to unlock
      const source = audioContext.createBufferSource();
      source.buffer = audioContext.createBuffer(1, 1, 22050);
      source.connect(audioContext.destination);
      source.start(0);
      
      sessionStorage.setItem('audio_unlocked', '1');
      setOk(true);
    } catch (error) {
      console.error('Failed to unlock audio:', error);
    }
  };
  
  if (!ok || isIOS) {
    return (
      <button
        onClick={handleUnlock}
        className="rounded-full px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
        style={{ 
          position: 'fixed', 
          right: 12, 
          bottom: isIOS ? 120 : 88, 
          zIndex: 10000 
        }}
      >
        {isIOS ? 'Enable Audio (iOS)' : 'Enable Audio'}
      </button>
    );
  }
  
  return null;
}