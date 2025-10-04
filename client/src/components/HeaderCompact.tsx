import React from 'react';
export default function HeaderCompact({ version = 'v-current' }: { version?: string }) {
  return (
    <header className="hc">
      <div className="hc__left">
        <span className="hc__dot" />
        <span className="hc__title">Chango AI</span>
      </div>
      <div className="hc__spacer" />
      <div className="hc__pill" title="System online">{version}</div>
    </header>
  );
}