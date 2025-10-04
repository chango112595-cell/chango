import { useState, useEffect } from 'react';

export function AudioUnlock() {
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [attempts, setAttempts] = useState(0);
  
  // Check if iOS or Safari
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  useEffect(() => {
    // Check if already unlocked from previous session
    const stored = sessionStorage.getItem('audio_unlocked');
    if (stored === '1') {
      setUnlocked(true);
    }
  }, []);
  
  // Hide if not iOS/Safari and already unlocked
  if (!isIOS && !isSafari && unlocked) return null;
  
  const handleUnlock = async () => {
    try {
      setAttempts(prev => prev + 1);
      
      // Method 1: Create and immediately play a silent audio element
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      audio.volume = 0.1;
      
      // Try to play the audio
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
        
        // Resume if suspended (iOS requirement)
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          console.log('AudioContext resumed');
        }
        
        // Create an oscillator and play a very short, quiet sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.001; // Very quiet
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 440;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.01); // Stop after 10ms
        
        console.log('AudioContext state:', audioContext.state);
      }
      
      // Method 3: Try speech synthesis as fallback
      if (window.speechSynthesis) {
        try {
          // Cancel any pending speech
          window.speechSynthesis.cancel();
          
          // Create a very short utterance
          const utterance = new SpeechSynthesisUtterance(' ');
          utterance.volume = 0.01;
          utterance.rate = 10; // Very fast
          window.speechSynthesis.speak(utterance);
          console.log('Speech synthesis activated');
        } catch (e) {
          console.warn('Speech synthesis failed:', e);
        }
      }
      
      // Mark as unlocked
      sessionStorage.setItem('audio_unlocked', '1');
      setUnlocked(true);
      
      // Show success feedback
      console.log('Audio unlock successful!');
      
    } catch (error) {
      console.error('Audio unlock failed:', error);
      
      // On failure, still mark as attempted so user can proceed
      if (attempts >= 2) {
        // After 3 attempts, just hide the button
        sessionStorage.setItem('audio_unlocked', '1');
        setUnlocked(true);
      }
    }
  };
  
  // Always show on iOS until unlocked, or if unlock failed
  if ((isIOS || isSafari) && !unlocked) {
    return (
      <button
        onClick={handleUnlock}
        className="fixed z-[10000] rounded-full px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-lg transition-colors"
        style={{ 
          bottom: '100px',
          right: '16px'
        }}
      >
        {isIOS ? 'Tap to Enable Audio (iOS)' : 'Enable Audio'}
        {attempts > 0 && attempts < 3 && (
          <span className="ml-1 text-xs opacity-75">
            (Try {attempts}/3)
          </span>
        )}
      </button>
    );
  }
  
  return null;
}