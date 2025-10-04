import React, { useState } from 'react';
export default function ChatInputBar({ onSend }:{ onSend:(msg:string)=>void }) {
  const [msg, setMsg] = useState('');
  const send = () => { const t = msg.trim(); if (!t) return; onSend(t); setMsg(''); };
  return (
    <div className="chatdock" role="region" aria-label="Chat input">
      <input className="chatdock__field" value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==='Enter' && send()} placeholder="Ask Chango…" />
      <button className="chatdock__send" onClick={send} aria-label="Send">➤</button>
    </div>
  );
}