import React, { useState } from 'react';
import { handleUserInput } from '../core/orchestrator';

export default function ChatInputBar() {
  const [text, setText] = useState('');

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    // TODO: append to timeline UI (user message)
    const reply = await handleUserInput(t);
    // TODO: append {role:'assistant', content: reply} to timeline
  };

  return (
    <div className="chat-input">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && send()}
        placeholder="Ask Chango anything…"
        aria-label="Message Chango"
      />
      <button onClick={send} aria-label="Send">➤</button>
    </div>
  );
}