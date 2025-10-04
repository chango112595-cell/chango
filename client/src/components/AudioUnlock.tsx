import { useState } from 'react';

export function AudioUnlock() {
  const [attempts, setAttempts] = useState(0);
  
  // Check if iOS or Safari
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  const handleUnlock = async () => {
    try {
      setAttempts(prev => prev + 1);
      
      // Method 1: Create and immediately play a silent audio element
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      audio.volume = 0.1;
      
      try {
        await audio.play();
        console.log('Audio element played successfully');
      } catch (e) {
        console.warn('Audio element play failed:', e);
      }
      
      // Method 2: Create AudioContext with user gesture
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const audioContext = new AudioContext();
        
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          console.log('AudioContext resumed, state:', audioContext.state);
        }
        
        // Create oscillator
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.001;
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 440;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.01);
      }
      
      // Method 3: Speech synthesis
      if (window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(' ');
          utterance.volume = 0.01;
          utterance.rate = 10;
          window.speechSynthesis.speak(utterance);
          console.log('Speech synthesis activated');
        } catch (e) {
          console.warn('Speech synthesis failed:', e);
        }
      }
      
    } catch (error) {
      console.error('Audio unlock failed:', error);
    }
  };
  
  // Always show on iOS, never auto-hide
  if (isIOS || isSafari) {
    return (
      <button
        onClick={handleUnlock}
        className="fixed z-[10000] rounded-full px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-lg transition-colors"
        style={{ 
          bottom: '100px',
          right: '16px'
        }}
      >
        {isIOS ? 'Enable Audio (iOS)' : 'Enable Audio'}
        {attempts > 0 && (
          <span className="ml-1 text-xs opacity-75">
            (Attempt {attempts})
          </span>
        )}
      </button>
    );
  }
  
  return null;
}