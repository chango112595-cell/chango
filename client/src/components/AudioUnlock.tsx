import React from 'react';

export function AudioUnlock() {
  const [unlocked, setUnlocked] = React.useState<boolean>(() => {
    return sessionStorage.getItem('audio_unlocked') === '1';
  });
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  // Always show on iOS until properly unlocked
  if (!isIOS && unlocked) return null;
  
  const handleUnlock = async () => {
    try {
      // Create audio context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      
      // Create and play a silent buffer
      const buffer = audioContext.createBuffer(1, 1, 22050);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      
      // Resume if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // Play the silent sound
      source.start(0);
      
      // Also try to enable speech synthesis
      if (window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0;
        window.speechSynthesis.speak(utterance);
      }
      
      sessionStorage.setItem('audio_unlocked', '1');
      setUnlocked(true);
      
      // For iOS, keep showing until we verify it works
      if (isIOS) {
        // Test if audio really works
        setTimeout(() => {
          if (audioContext.state !== 'running') {
            setUnlocked(false);
            sessionStorage.removeItem('audio_unlocked');
          }
        }, 100);
      }
    } catch (error) {
      console.error('Failed to unlock audio:', error);
      sessionStorage.removeItem('audio_unlocked');
      setUnlocked(false);
    }
  };
  
  if (isIOS || !unlocked) {
    return (
      <button
        onClick={handleUnlock}
        className="fixed bottom-24 right-4 z-[10000] rounded-full px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
      >
        {isIOS ? 'Tap to Enable Audio (iOS)' : 'Enable Audio'}
      </button>
    );
  }
  
  return null;
}