import { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { DebugBus } from '@/debug/DebugBus';

export function VoiceStatusWidget() {
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState('Ready');

  useEffect(() => {
    // Listen for STT events
    const unsubscribeSTT = DebugBus.on((event) => {
      if (event.tag === 'STT' || event.tag === 'AlwaysListen') {
        if (event.msg?.includes('listening') || event.msg?.includes('started')) {
          setIsMicActive(true);
          setStatus('Listening...');
        } else if (event.msg?.includes('stopped')) {
          setIsMicActive(false);
          setStatus('Ready');
        }
      }
    });

    // Listen for TTS events
    const unsubscribeTTS = DebugBus.on((event) => {
      if (event.tag === 'TTS') {
        if (event.msg?.includes('speaking') || event.msg?.includes('speak')) {
          setIsSpeaking(true);
          setStatus('Speaking...');
        } else if (event.msg?.includes('ended') || event.msg?.includes('end')) {
          setIsSpeaking(false);
          setStatus('Ready');
        }
      }
    });

    return () => {
      unsubscribeSTT();
      unsubscribeTTS();
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 flex items-center gap-4 p-3 rounded-lg bg-black/50 backdrop-blur-sm border border-white/20 z-50">
      <div className="flex items-center gap-2">
        {isMicActive ? (
          <Mic className="w-5 h-5 text-green-400 animate-pulse" />
        ) : (
          <MicOff className="w-5 h-5 text-gray-400" />
        )}
        <span className="text-sm text-white/80">{isMicActive ? 'Mic Active' : 'Mic Inactive'}</span>
      </div>
      
      <div className="w-px h-6 bg-white/20" />
      
      <div className="flex items-center gap-2">
        {isSpeaking ? (
          <Volume2 className="w-5 h-5 text-blue-400 animate-pulse" />
        ) : (
          <VolumeX className="w-5 h-5 text-gray-400" />
        )}
        <span className="text-sm text-white/80">{status}</span>
      </div>
    </div>
  );
}