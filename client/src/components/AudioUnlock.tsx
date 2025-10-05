import { useState, useEffect } from 'react';

export function AudioUnlock() {
  const [isHidden, setIsHidden] = useState(false);
  
  // Check if iOS or Safari - be more thorough
  const isIOS = (/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream) || 
                (navigator.userAgent.includes('Replit-Bonsai') && navigator.userAgent.includes('iOS'));
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  useEffect(() => {
    // Check sessionStorage to see if audio was already unlocked
    const audioUnlocked = sessionStorage.getItem('audioUnlocked');
    if (audioUnlocked === 'true') {
      setIsHidden(true);
      console.log('[AudioUnlock] Audio already unlocked from previous session');
    } else if (isIOS || isSafari) {
      console.log('[AudioUnlock] Detected iOS/Safari, will show button');
    }
  }, [isIOS, isSafari]);
  
  const handleUnlock = async () => {
    console.log('[AudioUnlock] Button clicked, hiding button immediately');
    
    // Hide button immediately for user feedback
    setIsHidden(true);
    sessionStorage.setItem('audioUnlocked', 'true');
    
    try {
      // Method 1: Silent audio element
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      audio.volume = 0.1;
      
      try {
        await audio.play();
        console.log('[AudioUnlock] Audio element played');
      } catch (e) {
        console.warn('[AudioUnlock] Audio play failed:', e);
      }
      
      // Method 2: AudioContext
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        console.log('[AudioUnlock] AudioContext state:', ctx.state);
        
        // Play a very short tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(0);
        osc.stop(ctx.currentTime + 0.01);
      }
      
      // Method 3: Speech synthesis
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(' ');
        utterance.volume = 0.01;
        window.speechSynthesis.speak(utterance);
        console.log('[AudioUnlock] Speech synthesis triggered');
      }
      
    } catch (error) {
      console.error('[AudioUnlock] Error:', error);
    }
  };
  
  // ONLY show on iOS - not Safari on desktop, and only if not hidden
  if (isIOS && !isHidden) {
    return (
      <button
        onClick={handleUnlock}
        className="fixed rounded-full px-5 py-2.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-xl transition-all duration-200 active:scale-95"
        style={{ 
          bottom: '110px',
          right: '20px',
          zIndex: 99999  // Very high z-index
        }}
      >
        Enable Audio{isIOS ? ' (iOS)' : ''}
      </button>
    );
  }
  
  return null;
}