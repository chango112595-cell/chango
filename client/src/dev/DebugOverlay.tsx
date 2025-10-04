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
  voiceprint: 'ok' | 'issue' | 'inactive';
  vad: 'ok' | 'issue' | 'inactive';
  orchestrator: 'ok' | 'issue';
  lastSttActivity: number;
  lastGatePass: number;
  lastTtsSpeech: number;
  lastVoiceprintActivity: number;
  lastVadActivity: number;
  lastOrchestratorActivity: number;
  ttsSpeakingStartTime: number | null;
  // Additional security states
  voiceprintEnrolled: boolean;
  voiceprintVerified: boolean;
  vadMonitoring: boolean;
  vadSpeechDetected: boolean;
  vadEnergy: number;
  vadFlux: number;
  orchestratorStreamActive: boolean;
  orchestratorBargeInEnabled: boolean;
  gateEnabled: boolean;
  securityThreshold: number;
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
    voiceprint: 'inactive',
    vad: 'inactive',
    orchestrator: 'ok',
    lastSttActivity: Date.now(),
    lastGatePass: Date.now(),
    lastTtsSpeech: Date.now(),
    lastVoiceprintActivity: Date.now(),
    lastVadActivity: Date.now(),
    lastOrchestratorActivity: Date.now(),
    ttsSpeakingStartTime: null,
    voiceprintEnrolled: false,
    voiceprintVerified: false,
    vadMonitoring: false,
    vadSpeechDetected: false,
    vadEnergy: -100,
    vadFlux: 0,
    orchestratorStreamActive: false,
    orchestratorBargeInEnabled: true,
    gateEnabled: true,
    securityThreshold: 0.85
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
        
        // STT events (both STT and AlwaysListen modules)
        if (event.module === 'STT' || event.module === 'AlwaysListen') {
          // Only mark as OK if it's a success event
          if (event.message === 'Recognition started' || 
              event.message === 'Speech detected' ||
              event.message.includes('transcript')) {
            newHealth.lastSttActivity = now;
            newHealth.stt = 'ok';
          }
          
          // Mark as issue on errors or permission problems
          if (event.type === 'error' || 
              event.message === 'Permission denied' ||
              event.message.includes('Cannot start') ||
              event.message.includes('muted')) {
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
          } else if (event.message === 'voiceprint_heartbeat') {
            newHealth.lastVoiceprintActivity = now;
            newHealth.voiceprint = 'ok';
          } else if (event.message === 'vad_heartbeat') {
            newHealth.lastVadActivity = now;
            newHealth.vad = 'ok';
          } else if (event.message === 'orchestrator_heartbeat') {
            newHealth.lastOrchestratorActivity = now;
            newHealth.orchestrator = 'ok';
          }
        }
        
        // Voiceprint events
        if (event.module === 'Voiceprint') {
          newHealth.lastVoiceprintActivity = now;
          if (event.message === 'enrolled' || event.message === 'enrollment_success') {
            newHealth.voiceprintEnrolled = true;
            newHealth.voiceprint = 'ok';
          } else if (event.message === 'verification_success') {
            newHealth.voiceprintVerified = true;
            newHealth.voiceprint = 'ok';
          } else if (event.message === 'verification_failed') {
            newHealth.voiceprintVerified = false;
            newHealth.voiceprint = 'issue';
          } else if (event.message === 'threshold_changed' && event.data?.threshold) {
            newHealth.securityThreshold = event.data.threshold;
          } else if (event.type === 'error') {
            newHealth.voiceprint = 'issue';
          }
        }
        
        // VAD events
        if (event.module === 'VAD') {
          newHealth.lastVadActivity = now;
          if (event.message === 'Started monitoring') {
            newHealth.vadMonitoring = true;
            newHealth.vad = 'ok';
          } else if (event.message === 'Stopped monitoring') {
            newHealth.vadMonitoring = false;
            newHealth.vad = 'inactive';
          } else if (event.message === 'speech_start') {
            newHealth.vadSpeechDetected = true;
            newHealth.vad = 'ok';
          } else if (event.message === 'speech_end') {
            newHealth.vadSpeechDetected = false;
            newHealth.vad = 'ok';
          } else if (event.message === 'energy_update' && event.data) {
            if (event.data.energy !== undefined) newHealth.vadEnergy = event.data.energy;
            if (event.data.flux !== undefined) newHealth.vadFlux = event.data.flux;
          } else if (event.type === 'error') {
            newHealth.vad = 'issue';
          }
        }
        
        // VoiceOrchestrator events
        if (event.module === 'VoiceOrchestrator') {
          newHealth.lastOrchestratorActivity = now;
          if (event.message === 'stream_obtained' || event.message === 'Successfully obtained audio stream') {
            newHealth.orchestratorStreamActive = true;
            newHealth.orchestrator = 'ok';
          } else if (event.message === 'Barge-in activated') {
            newHealth.orchestratorBargeInEnabled = true;
          } else if (event.message === 'Voice verified' && event.data?.similarity) {
            newHealth.voiceprintVerified = true;
            newHealth.voiceprint = 'ok';
          } else if (event.message === 'Voice verification failed') {
            newHealth.voiceprintVerified = false;
            newHealth.voiceprint = 'issue';
          } else if (event.type === 'error') {
            newHealth.orchestrator = 'issue';
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
        
        // Check Voiceprint health (30s timeout, only if enrolled)
        if (prev.voiceprintEnrolled && now - prev.lastVoiceprintActivity > 30000) {
          newHealth.voiceprint = 'issue';
        }
        
        // Check VAD health (15s timeout, only if monitoring)
        if (prev.vadMonitoring && now - prev.lastVadActivity > 15000) {
          newHealth.vad = 'issue';
        }
        
        // Check Orchestrator health (20s timeout)
        if (now - prev.lastOrchestratorActivity > 20000) {
          newHealth.orchestrator = 'issue';
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
  const getHealthColor = (status: 'ok' | 'issue' | 'inactive') => {
    switch (status) {
      case 'ok': return '#00ff00';
      case 'issue': return '#ff4444';
      case 'inactive': return '#888888';
      default: return '#888888';
    }
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
        left: viewport === 'mobile' ? 20 : 30,
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
            flexDirection: 'column',
            gap: 8,
            marginBottom: 8,
            paddingBottom: 8,
            borderBottom: '1px solid #00ffff44'
          }}>
            {/* Health Status */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap',
              gap: viewport === 'mobile' ? 4 : 8,
              flex: 1,
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.stt),
                  boxShadow: health.stt === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : 
                             health.stt === 'issue' ? '0 0 8px rgba(255, 68, 68, 0.5)' : 'none',
                }} data-testid="health-stt" />
                <span style={{ fontSize: viewport === 'mobile' ? 9 : 10 }}>🎤STT</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.gate),
                  boxShadow: health.gate === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : 
                             health.gate === 'issue' ? '0 0 8px rgba(255, 68, 68, 0.5)' : 'none',
                }} data-testid="health-gate" />
                <span style={{ fontSize: viewport === 'mobile' ? 9 : 10 }}>🚪Gate</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.tts),
                  boxShadow: health.tts === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : 
                             health.tts === 'issue' ? '0 0 8px rgba(255, 68, 68, 0.5)' : 'none',
                }} data-testid="health-tts" />
                <span style={{ fontSize: viewport === 'mobile' ? 9 : 10 }}>🔊TTS</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.voiceprint),
                  boxShadow: health.voiceprint === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : 
                             health.voiceprint === 'issue' ? '0 0 8px rgba(255, 68, 68, 0.5)' : 'none',
                }} data-testid="health-voiceprint" />
                <span style={{ fontSize: viewport === 'mobile' ? 9 : 10 }}>
                  🔐VP
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.vad),
                  boxShadow: health.vad === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : 
                             health.vad === 'issue' ? '0 0 8px rgba(255, 68, 68, 0.5)' : 'none',
                }} data-testid="health-vad" />
                <span style={{ fontSize: viewport === 'mobile' ? 9 : 10 }}>
                  👂VAD
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.orchestrator),
                  boxShadow: health.orchestrator === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : 
                             health.orchestrator === 'issue' ? '0 0 8px rgba(255, 68, 68, 0.5)' : 'none',
                }} data-testid="health-orchestrator" />
                <span style={{ fontSize: viewport === 'mobile' ? 9 : 10 }}>🎭Orch</span>
              </div>
            </div>
            
            {/* Control buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
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