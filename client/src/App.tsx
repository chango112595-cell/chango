import { useEffect, useState } from 'react';
import { HolographicSphere } from '@/components/HolographicSphere';
import { VoiceStatusWidget } from '@/components/VoiceStatusWidget';
import { AudioUnlock } from '@/components/AudioUnlock';
import { ChatInterface } from '@/components/ChatInterface';
import { DiagnosticsDashboard } from '@/components/DiagnosticsDashboard';
import { VoiceSecurityUI } from '@/components/VoiceSecurityUI';
import { useViewportVh } from '@/lib/useViewportVh';
import { DebugBus } from '@/debug/DebugBus';
import { VoiceGate } from '@/voice/gate';

export default function App() {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [messages, setMessages] = useState<Array<{id: string; text: string; sender: 'user' | 'chango'}>>([]);
  
  useViewportVh();
  
  useEffect(() => {
    DebugBus.defineFlags(['STT','TTS','Gate','Orch']);
    VoiceGate.enable('lolo');
    
    // Try to start voice if available, but don't block on failure
    import('@/voice/always_listen').then(({ startAlwaysListen }) => {
      startAlwaysListen({ enabled: true, wakeWord: 'lolo' }).catch(() => {
        console.log('Voice not available - text input still works');
      });
    });
  }, []);

  const handleTextSubmit = async (text: string) => {
    // Add user message
    const userMsg = { id: Date.now().toString(), text, sender: 'user' as const };
    setMessages(prev => [...prev, userMsg]);
    
    // Check wake word
    const check = VoiceGate.check(text);
    if (!check.pass) {
      DebugBus.emit({ tag: 'App', level: 'info', msg: 'No wake word - ignoring' });
      return;
    }
    
    // Get response
    const { sendToLLM } = await import('@/llm/orchestrator');
    const reply = await sendToLLM(check.cmd);
    
    // Add Chango's response
    const changoMsg = { id: (Date.now() + 1).toString(), text: reply, sender: 'chango' as const };
    setMessages(prev => [...prev, changoMsg]);
    
    // Try TTS but don't fail if unavailable
    try {
      const { speak } = await import('@/voice/tts');
      await speak(reply);
    } catch (e) {
      console.log('TTS not available:', e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <HolographicSphere />
      <VoiceStatusWidget />
      <ChatInterface messages={messages} onSubmit={handleTextSubmit} />
      <VoiceSecurityUI />
      <AudioUnlock />
      
      <button
        onClick={() => setShowDiagnostics(!showDiagnostics)}
        className="fixed bottom-4 right-4 p-3 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors z-50"
        aria-label="Toggle diagnostics"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>
      
      {showDiagnostics && <DiagnosticsDashboard onClose={() => setShowDiagnostics(false)} />}
    </div>
  );
}