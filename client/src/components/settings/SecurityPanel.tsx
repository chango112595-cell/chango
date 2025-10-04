import React from 'react';
import { useVoiceprint } from '../../hooks/useVoiceprint';

export function SecurityPanel(){
  const { sec, enroll, setRequireMatch, setThreshold } = useVoiceprint();

  return (
    <div className="card">
      <div className="row">
        <strong>Voice Security</strong>
        {sec.enrolled ? <span className="pill">Enrolled</span> : <span className="pill warn">Not enrolled</span>}
      </div>

      <div className="row">
        <button onClick={()=> enroll(7)}>Enroll / Re-enroll</button>
        <label>
          <input type="checkbox" checked={!!sec.requireMatch} onChange={e=> setRequireMatch(e.target.checked)} />
          Require match to accept commands
        </label>
      </div>

      <div className="row">
        <label>Match threshold: {sec.threshold.toFixed(2)}</label>
        <input type="range" min={0.70} max={0.95} step={0.01}
               value={sec.threshold}
               onChange={e=> setThreshold(parseFloat(e.target.value))}/>
      </div>

      <p className="muted">Your voice stays local on this device.</p>
    </div>
  );
}