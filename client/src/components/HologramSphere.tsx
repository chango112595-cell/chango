import { useEffect, useState } from 'react';
import './hologram.css';

interface HologramSphereProps {
  state?: 'idle' | 'listening' | 'speaking' | 'error';
}

export function HologramSphere({ state = 'idle' }: HologramSphereProps) {
  const [pulseIntensity, setPulseIntensity] = useState(1);

  useEffect(() => {
    if (state === 'speaking') {
      const interval = setInterval(() => {
        setPulseIntensity(0.8 + Math.random() * 0.4);
      }, 100);
      return () => clearInterval(interval);
    }
    setPulseIntensity(1);
  }, [state]);

  return (
    <div 
      className="hologram-sphere-container"
      data-state={state}
      data-testid="hologram-sphere"
    >
      <div className="hologram-sphere">
        {/* Outer rotating rings */}
        <div className="ring ring-a">
          <div className="ring-inner"></div>
        </div>
        <div className="ring ring-b">
          <div className="ring-inner"></div>
        </div>
        <div className="ring ring-c">
          <div className="ring-inner"></div>
        </div>
        
        {/* Core sphere */}
        <div 
          className="core"
          style={{ 
            transform: `scale(${pulseIntensity})`,
            transition: state === 'speaking' ? 'transform 0.1s ease-out' : 'transform 0.3s ease-in-out'
          }}
        >
          <div className="core-inner"></div>
          <div className="core-glow"></div>
        </div>

        {/* Particle effects */}
        <div className="particles">
          <div className="particle particle-1"></div>
          <div className="particle particle-2"></div>
          <div className="particle particle-3"></div>
          <div className="particle particle-4"></div>
        </div>
      </div>
    </div>
  );
}