/**
 * Debug Overlay Component
 * Visual debug monitoring interface for Lolo AI with health status indicators
 */

import { useEffect, useState } from 'react';
import { debugBus, DebugEvent } from './debugBus';
import { FEATURES } from '../config/featureFlags';

interface HealthStatus {
  stt: 'ok' | 'issue';
  gate: 'ok' | 'issue'; 
  tts: 'ok' | 'issue';
  lastSttActivity: number;
  lastGatePass: number;
  lastTtsSpeech: number;
  ttsSpeakingStartTime: number | null;
}

export function DebugOverlay() {
  // Don't render if feature flag is disabled or in production
  if (!FEATURES.DEBUG_OVERLAY || import.meta.env.PROD) {
    return null;
  }
  
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [health, setHealth] = useState<HealthStatus>({
    stt: 'ok',
    gate: 'ok',
    tts: 'ok',
    lastSttActivity: Date.now(),
    lastGatePass: Date.now(),
    lastTtsSpeech: Date.now(),
    ttsSpeakingStartTime: null
  });
  
  useEffect(() => {
    // Subscribe to debug events
    const unsubscribe = debugBus.subscribe((event) => {
      setEvents(prev => {
        const newEvents = [event, ...prev].slice(0, 14); // Keep last 14 events
        return newEvents;
      });
      
      // Update health status based on events
      setHealth(prev => {
        const now = Date.now();
        const newHealth = { ...prev };
        
        // STT events
        if (event.module === 'STT') {
          newHealth.lastSttActivity = now;
          newHealth.stt = 'ok';
          
          if (event.type === 'error') {
            newHealth.stt = 'issue';
          }
        }
        
        // Gate events
        if (event.module === 'Gate' && event.message === 'pass') {
          newHealth.lastGatePass = now;
          newHealth.gate = 'ok';
        }
        
        // TTS events
        if (event.module === 'TTS') {
          if (event.message === 'speak') {
            newHealth.lastTtsSpeech = now;
            newHealth.ttsSpeakingStartTime = now;
            newHealth.tts = 'ok';
          } else if (event.type === 'error') {
            newHealth.tts = 'issue';
            newHealth.ttsSpeakingStartTime = null;
          }
        }
        
        // Clear TTS speaking when done
        if (event.module === 'TTS' && (event.message === 'end' || event.type === 'error')) {
          newHealth.ttsSpeakingStartTime = null;
        }
        
        // Also check Health module heartbeats
        if (event.module === 'Health') {
          if (event.message === 'stt_heartbeat') {
            newHealth.lastSttActivity = now;
            newHealth.stt = 'ok';
          } else if (event.message === 'gate_heartbeat' && event.data?.passed) {
            newHealth.lastGatePass = now;
            newHealth.gate = 'ok';
          } else if (event.message === 'tts_heartbeat') {
            newHealth.lastTtsSpeech = now;
            if (event.data?.speaking === true) {
              newHealth.ttsSpeakingStartTime = now;
              newHealth.tts = 'ok';
            } else if (event.data?.speaking === false) {
              newHealth.ttsSpeakingStartTime = null;
            }
          }
        }
        
        return newHealth;
      });
    });
    
    // Health monitoring interval
    const healthInterval = setInterval(() => {
      setHealth(prev => {
        const now = Date.now();
        const newHealth = { ...prev };
        
        // Check STT health (12s timeout)
        if (now - prev.lastSttActivity > 12000) {
          newHealth.stt = 'issue';
        }
        
        // Check Gate health (20s timeout for pass events)
        if (now - prev.lastGatePass > 20000) {
          newHealth.gate = 'issue';
        }
        
        // Check TTS health (10s stuck timeout)
        if (prev.ttsSpeakingStartTime && now - prev.ttsSpeakingStartTime > 10000) {
          newHealth.tts = 'issue';
        }
        
        return newHealth;
      });
    }, 3000);
    
    // Get initial history
    setEvents(debugBus.getHistory().slice(0, 14));
    
    return () => {
      unsubscribe();
      clearInterval(healthInterval);
    };
  }, []);
  
  // Format timestamp for display
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toTimeString().slice(0, 8);
  };
  
  // Get level color
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return '#ff4444';
      case 'warn': return '#ffaa00';
      default: return '#00ffff';
    }
  };
  
  // Get health dot color
  const getHealthColor = (status: 'ok' | 'issue') => {
    return status === 'ok' ? '#00ff00' : '#ff4444';
  };
  
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        width: 400,
        maxHeight: 500,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        border: '2px solid #00ffff',
        borderRadius: 8,
        padding: 12,
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#00ffff',
        zIndex: 99999,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
      data-testid="debug-overlay"
    >
      {/* Health Status */}
      <div style={{ 
        display: 'flex', 
        gap: 20, 
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid #00ffff44'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: getHealthColor(health.stt)
          }} data-testid="health-stt" />
          <span>STT</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: getHealthColor(health.gate)
          }} data-testid="health-gate" />
          <span>Gate</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: getHealthColor(health.tts)
          }} data-testid="health-tts" />
          <span>TTS</span>
        </div>
      </div>
      
      {/* Event Log */}
      <div style={{ 
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        {events.map((event, index) => (
          <div
            key={`${event.timestamp}-${index}`}
            style={{
              marginBottom: 4,
              fontSize: 10,
              lineHeight: '14px',
              wordBreak: 'break-word'
            }}
            data-testid={`debug-event-${index}`}
          >
            <span style={{ color: '#888' }}>
              {formatTime(event.timestamp)}
            </span>
            {' '}
            <span style={{ color: getLevelColor(event.type) }}>
              [{event.module}]
            </span>
            {' '}
            <span style={{ color: '#fff' }}>
              {event.message}
            </span>
            {event.data && (
              <>
                {' '}
                <span style={{ color: '#999', fontSize: 9 }}>
                  {JSON.stringify(event.data).slice(0, 50)}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
      
      {/* Footer */}
      <div style={{
        marginTop: 8,
        paddingTop: 8,
        borderTop: '1px solid #00ffff44',
        fontSize: 9,
        color: '#666',
        textAlign: 'center'
      }}>
        Debug Monitor v1.0 | Events: {events.length}
      </div>
    </div>
  );
}