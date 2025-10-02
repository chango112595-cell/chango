/**
 * Debug Overlay Component
 * Responsive, non-intrusive debug monitoring interface with health status indicators
 */

import { useEffect, useState, useRef } from 'react';
import { debugBus, DebugEvent } from './debugBus';
import { FEATURES } from '../config/featureFlags';
import { X, Bug, ChevronUp, ChevronDown } from 'lucide-react';

interface HealthStatus {
  stt: 'ok' | 'issue';
  gate: 'ok' | 'issue'; 
  tts: 'ok' | 'issue';
  lastSttActivity: number;
  lastGatePass: number;
  lastTtsSpeech: number;
  ttsSpeakingStartTime: number | null;
}

const STORAGE_KEY = 'debug-overlay-state';

export function DebugOverlay() {
  // Don't render if feature flag is disabled
  if (!FEATURES.DEBUG_OVERLAY) {
    return null;
  }
  
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).visible ?? false : false;
  });
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).expanded ?? true : true;
  });
  const [health, setHealth] = useState<HealthStatus>({
    stt: 'ok',
    gate: 'ok',
    tts: 'ok',
    lastSttActivity: Date.now(),
    lastGatePass: Date.now(),
    lastTtsSpeech: Date.now(),
    ttsSpeakingStartTime: null
  });
  
  // Determine viewport size for responsive design
  const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setViewport('mobile');
      } else if (width < 1024) {
        setViewport('tablet');
      } else {
        setViewport('desktop');
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      visible: isVisible,
      expanded: isExpanded
    }));
  }, [isVisible, isExpanded]);
  
  // Get max events based on viewport
  const getMaxEvents = () => {
    if (!isExpanded) return 0;
    switch (viewport) {
      case 'mobile': return 6;
      case 'tablet': return 10;
      default: return 14;
    }
  };
  
  useEffect(() => {
    // Subscribe to debug events
    const unsubscribe = debugBus.subscribe((event) => {
      const maxEvents = getMaxEvents();
      if (maxEvents > 0) {
        setEvents(prev => {
          const newEvents = [event, ...prev].slice(0, maxEvents);
          return newEvents;
        });
      }
      
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
    const maxEvents = getMaxEvents();
    if (maxEvents > 0) {
      setEvents(debugBus.getHistory().slice(0, maxEvents));
    }
    
    return () => {
      unsubscribe();
      clearInterval(healthInterval);
    };
  }, [viewport, isExpanded]);
  
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
  
  // Get overlay styles based on viewport
  const getOverlayStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: 'fixed',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      border: '2px solid #00ffff',
      borderRadius: 8,
      fontFamily: 'monospace',
      color: '#00ffff',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.3s ease-in-out',
      pointerEvents: 'auto',
    };
    
    switch (viewport) {
      case 'mobile':
        return {
          ...baseStyles,
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          maxHeight: isExpanded ? '30vh' : 'auto',
          fontSize: 10,
          padding: 8,
          borderRadius: '8px 8px 0 0',
        };
      case 'tablet':
        return {
          ...baseStyles,
          bottom: 20,
          left: 20,
          width: 350,
          maxHeight: isExpanded ? 400 : 'auto',
          fontSize: 11,
          padding: 10,
        };
      default:
        return {
          ...baseStyles,
          bottom: 20,
          left: 20,
          width: 400,
          maxHeight: isExpanded ? 500 : 'auto',
          fontSize: 11,
          padding: 12,
        };
    }
  };
  
  // Toggle Button Component
  const ToggleButton = () => (
    <button
      onClick={() => setIsVisible(!isVisible)}
      style={{
        position: 'fixed',
        bottom: viewport === 'mobile' ? 20 : 30,
        right: viewport === 'mobile' ? 20 : 30,
        width: viewport === 'mobile' ? 48 : 56,
        height: viewport === 'mobile' ? 48 : 56,
        borderRadius: '50%',
        backgroundColor: isVisible ? 'rgba(0, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.8)',
        border: '2px solid #00ffff',
        color: '#00ffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 99999,
        transition: 'all 0.3s ease-in-out',
        pointerEvents: 'auto',
        boxShadow: '0 4px 12px rgba(0, 255, 255, 0.3)',
      }}
      data-testid="debug-toggle-button"
      aria-label="Toggle debug overlay"
    >
      <Bug size={viewport === 'mobile' ? 20 : 24} />
    </button>
  );
  
  if (!isVisible) {
    return <ToggleButton />;
  }
  
  return (
    <>
      <ToggleButton />
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 99998,
        }}
      >
        <div
          style={getOverlayStyles()}
          data-testid="debug-overlay"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with controls */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
            paddingBottom: 8,
            borderBottom: '1px solid #00ffff44'
          }}>
            {/* Health Status */}
            <div style={{ 
              display: 'flex', 
              gap: viewport === 'mobile' ? 12 : 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.stt),
                  boxShadow: health.stt === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : '0 0 8px rgba(255, 68, 68, 0.5)',
                }} data-testid="health-stt" />
                <span style={{ fontSize: viewport === 'mobile' ? 10 : 11 }}>STT</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.gate),
                  boxShadow: health.gate === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : '0 0 8px rgba(255, 68, 68, 0.5)',
                }} data-testid="health-gate" />
                <span style={{ fontSize: viewport === 'mobile' ? 10 : 11 }}>Gate</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.tts),
                  boxShadow: health.tts === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : '0 0 8px rgba(255, 68, 68, 0.5)',
                }} data-testid="health-tts" />
                <span style={{ fontSize: viewport === 'mobile' ? 10 : 11 }}>TTS</span>
              </div>
            </div>
            
            {/* Control buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#00ffff',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                data-testid="debug-expand-toggle"
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? 
                  <ChevronDown size={viewport === 'mobile' ? 16 : 18} /> : 
                  <ChevronUp size={viewport === 'mobile' ? 16 : 18} />
                }
              </button>
              <button
                onClick={() => setIsVisible(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#00ffff',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                data-testid="debug-close"
                aria-label="Close"
              >
                <X size={viewport === 'mobile' ? 16 : 18} />
              </button>
            </div>
          </div>
          
          {/* Event Log (only when expanded) */}
          {isExpanded && (
            <>
              <div style={{ 
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                minHeight: viewport === 'mobile' ? 100 : 200,
              }}>
                {events.map((event, index) => (
                  <div
                    key={`${event.timestamp}-${index}`}
                    style={{
                      marginBottom: 4,
                      fontSize: viewport === 'mobile' ? 9 : 10,
                      lineHeight: viewport === 'mobile' ? '12px' : '14px',
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
                    {event.data && viewport !== 'mobile' && (
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
                fontSize: viewport === 'mobile' ? 8 : 9,
                color: '#666',
                textAlign: 'center'
              }}>
                Debug Monitor v2.0 | Events: {events.length} | {viewport}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}