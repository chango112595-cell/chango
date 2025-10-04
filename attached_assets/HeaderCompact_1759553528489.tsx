import React from 'react';

export default function HeaderCompact({ online = true, version = 'v-current' }) {
  return (
    <header className="app-header" style={{padding:'12px 14px'}}>
      <div className="title">Chango AI</div>
      <div className="pill" title={online ? 'Online' : 'Offline'}>
        <span className={online ? 'dot ok' : 'dot bad'} /> {version}
      </div>
      <button className="theme-btn" aria-label="HUD Theme">HUD Theme</button>
      <style>{`
        .app-header { display:flex; align-items:center; gap:.5rem; }
        .title{ font-weight:700; font-size: clamp(18px, 4vw, 22px); }
        .theme-btn{ margin-left:auto; }
        .app-header .pill{
          display:flex; align-items:center; gap:.4rem;
          margin-left:.5rem; padding:.25rem .6rem; border-radius:999px;
          background: rgba(255,255,255,.08); font-size:12px;
        }
        .dot { width:8px; height:8px; border-radius:999px; display:inline-block; }
        .ok { background:#45e67b; } .bad { background:#ff5a58; }
      `}</style>
    </header>
  );
}