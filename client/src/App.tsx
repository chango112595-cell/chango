import React, { useState, useEffect } from 'react';
import HeaderCompact from '@/components/HeaderCompact';
import ChatInputBar from '@/components/ChatInputBar';
import { AudioUnlock } from '@/components/AudioUnlock';
import { useViewportVh } from '@/lib/useViewportVh';
import { DebugBus } from '@/debug/DebugBus';
import { VoiceGate } from '@/voice/gate';
import '@/styles/layout.css';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'chango';
}

export default function App(){
  const [messages, setMessages] = useState<Message[]>([]);
  useViewportVh();
  
  useEffect(() => {
    DebugBus.defineFlags(['STT','TTS','Gate','Orch']);
    // Enable gate for text checking but don't require mic
    VoiceGate.enable('lolo');
    // Try to start voice if available, but don't block on failure
    import('@/voice/always_listen').then(({ startAlwaysListen }) => {
      startAlwaysListen({ enabled: true, wakeWord: 'lolo' }).catch(() => {
        console.log('Voice not available - text input still works');
      });
    });
  }, []);

  const send = async (text: string) => {
    // Add user message
    const userMsg: Message = { id: Date.now().toString(), text, sender: 'user' };
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
    const changoMsg: Message = { id: (Date.now() + 1).toString(), text: reply, sender: 'chango' };
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
    <div className="app">
      <HeaderCompact />
      <div className="chat-container" style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              marginBottom: '1rem',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              backgroundColor: msg.sender === 'user' ? 'rgba(46, 111, 255, 0.2)' : 'rgba(39, 211, 107, 0.2)',
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '70%',
            }}
          >
            <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.25rem' }}>
              {msg.sender === 'user' ? 'You' : 'Chango'}
            </div>
            <div>{msg.text}</div>
          </div>
        ))}
      </div>
      <ChatInputBar onSend={send} />
      <AudioUnlock />
    </div>
  );
}