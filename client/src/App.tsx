import React from 'react';
import HeaderCompact from '@/components/HeaderCompact';
import ChatInputBar from '@/components/ChatInputBar';
import { AudioUnlock } from '@/components/AudioUnlock';
import { useViewportVh } from '@/lib/useViewportVh';
import { startAlwaysListenNew } from '@/voice/always_listen';
import { DebugBus } from '@/debug/DebugBus';
// Import the new safe modules
import { DebugBusSafe } from '@/debug/DebugBus_safe';
import { startAlwaysListenSafe } from '@/voice/alwaysListen_safe';
import '@/styles/layout.css';

export default function App(){
  useViewportVh();
  React.useEffect(() => {
    // Initialize existing voice system
    DebugBus.defineFlags(['STT','TTS','Gate','Orch']);
    startAlwaysListenNew({ enabled: true, wakeWord: 'lolo' });
    
    // Initialize new safe voice system
    DebugBusSafe.defineFlags(['STT','TTS','Gate','Orch']);
    startAlwaysListenSafe({ enabled: true, wakeWord: 'lolo' });
  }, []);

  const send = async (text:string) => {
    const { sendToLLM } = await import('@/llm/orchestrator');
    const { speak } = await import('@/voice/tts');
    const reply = await sendToLLM(text);
    await speak(reply);
  };

  return (
    <div className="app">
      <HeaderCompact />
      <div className="hologram">{/* sphere */}</div>
      <div className="debug-monitor">{/* monitor */}</div>
      {/* chat timeline */}
      <ChatInputBar onSend={send} />
      <AudioUnlock />
    </div>
  );
}