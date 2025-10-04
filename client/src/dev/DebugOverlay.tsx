/**
 * Debug Overlay Component
 * Responsive, non-intrusive debug monitoring interface with health status indicators
 */

import { useEffect, useState, useRef } from 'react';
import { debugBus, DebugEvent } from './debugBus';
import { FEATURES } from '../config/featureFlags';
import { X, Bug, ChevronUp, ChevronDown, Activity, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { moduleRegistry, ModuleHealth, ModuleStatus, ModuleType, ModuleInstance } from './moduleRegistry';

interface HealthStatus {
  stt: 'ok' | 'issue';
  gate: 'ok' | 'issue' | 'closed'; 
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
  // Gate state tracking
  gateOpen: boolean;
  gatePermission: boolean;
  gateReason?: string;
  lastGateActivity: number;
}

const STORAGE_KEY = 'debug-overlay-state';

export function DebugOverlay() {
  // Don't render if feature flag is disabled
  if (!FEATURES.DEBUG_OVERLAY) {
    return null;
  }
  
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [modules, setModules] = useState<ModuleInstance[]>([]);
  const [showModules, setShowModules] = useState(false);
  const [activeModuleType, setActiveModuleType] = useState<ModuleType | 'all'>('all');
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
    gate: 'closed',
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
    securityThreshold: 0.85,
    gateOpen: false,
    gatePermission: false,
    gateReason: 'initial',
    lastGateActivity: Date.now()
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
        if (event.module === 'Gate') {
          newHealth.lastGateActivity = now;
          
          if (event.message === 'pass') {
            newHealth.lastGatePass = now;
            const allowed = event.data?.allowed;
            if (allowed) {
              newHealth.gate = 'ok';
              newHealth.gateOpen = true;
            } else {
              newHealth.gate = 'closed';
              newHealth.gateOpen = false;
            }
          } else if (event.message === 'opened') {
            newHealth.gateOpen = true;
            newHealth.gate = 'ok';
            newHealth.gateReason = event.data?.source || 'unknown';
          } else if (event.message === 'closed') {
            newHealth.gateOpen = false;
            newHealth.gate = 'closed';
            newHealth.gateReason = event.data?.reason || 'unknown';
          } else if (event.message === 'permission_check') {
            newHealth.gatePermission = event.data?.granted || false;
          } else if (event.message === 'open_blocked') {
            newHealth.gate = 'issue';
            newHealth.gateReason = event.data?.reason || 'blocked';
          }
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
  
  // Refresh modules periodically
  useEffect(() => {
    const refreshModules = () => {
      const allModules = moduleRegistry.getAllModules();
      setModules(allModules);
    };
    
    // Initial refresh
    refreshModules();
    
    // Refresh every 2 seconds
    const moduleInterval = setInterval(refreshModules, 2000);
    
    // Subscribe to module discovery
    const unsubscribe = moduleRegistry.onModuleDiscovered(() => {
      refreshModules();
    });
    
    return () => {
      clearInterval(moduleInterval);
      unsubscribe();
    };
  }, []);
  
  // Get module health icon
  const getModuleHealthIcon = (health: ModuleHealth) => {
    switch (health) {
      case ModuleHealth.HEALTHY:
        return <CheckCircle size={14} style={{ color: '#00ff00' }} />;
      case ModuleHealth.WARNING:
        return <AlertCircle size={14} style={{ color: '#ffaa00' }} />;
      case ModuleHealth.CRITICAL:
        return <XCircle size={14} style={{ color: '#ff4444' }} />;
      default:
        return <Activity size={14} style={{ color: '#888888' }} />;
    }
  };
  
  // Get module status color
  const getModuleStatusColor = (status: ModuleStatus): string => {
    switch (status) {
      case ModuleStatus.ACTIVE:
        return '#00ff00';
      case ModuleStatus.READY:
        return '#00ffff';
      case ModuleStatus.ERROR:
        return '#ff4444';
      case ModuleStatus.DEGRADED:
        return '#ffaa00';
      case ModuleStatus.RECOVERING:
        return '#ffff00';
      case ModuleStatus.DISABLED:
        return '#666666';
      case ModuleStatus.INITIALIZING:
        return '#00aaff';
      default:
        return '#888888';
    }
  };
  
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
  const getHealthColor = (status: 'ok' | 'issue' | 'inactive' | 'closed') => {
    switch (status) {
      case 'ok': return '#00ff00';
      case 'issue': return '#ff4444';
      case 'inactive': return '#888888';
      case 'closed': return '#ffaa00';
      default: return '#888888';
    }
  };
  
  // Get overlay container styles (fixed positioning wrapper)
  const getContainerStyles = (): React.CSSProperties => {
    switch (viewport) {
      case 'mobile':
        return {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          pointerEvents: 'none',
        };
      case 'tablet':
        return {
          position: 'fixed',
          bottom: 20,
          left: 20,
          zIndex: 99999,
          pointerEvents: 'none',
        };
      default:
        return {
          position: 'fixed',
          bottom: 20,
          left: 20,
          zIndex: 99999,
          pointerEvents: 'none',
        };
    }
  };
  
  // Get control panel styles (tabs at bottom)
  const getControlPanelStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      border: '2px solid #00ffff',
      borderRadius: 8,
      fontFamily: 'monospace',
      color: '#00ffff',
      display: 'flex',
      flexDirection: 'column',
      pointerEvents: 'auto',
      position: 'relative',
      transition: 'all 0.3s ease-in-out',
    };
    
    switch (viewport) {
      case 'mobile':
        return {
          ...baseStyles,
          width: '100vw',
          fontSize: 10,
          padding: 8,
          borderRadius: '8px 8px 0 0',
        };
      case 'tablet':
        return {
          ...baseStyles,
          width: 350,
          fontSize: 11,
          padding: 10,
        };
      default:
        return {
          ...baseStyles,
          width: 400,
          fontSize: 11,
          padding: 12,
        };
    }
  };
  
  // Get content area styles (slides up above control panel)
  const getContentStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: 'absolute',
      bottom: '100%',
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      border: '2px solid #00ffff',
      borderBottom: 'none',
      fontFamily: 'monospace',
      color: '#00ffff',
      display: 'flex',
      flexDirection: 'column',
      pointerEvents: 'auto',
      transform: isExpanded ? 'translateY(0)' : 'translateY(100%)',
      opacity: isExpanded ? 1 : 0,
      transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out',
      overflow: 'hidden',
    };
    
    switch (viewport) {
      case 'mobile':
        return {
          ...baseStyles,
          width: '100vw',
          height: '30vh',
          fontSize: 10,
          padding: 8,
          borderRadius: '8px 8px 0 0',
          marginBottom: -2, // Overlap border
        };
      case 'tablet':
        return {
          ...baseStyles,
          width: 350,
          height: 400,
          fontSize: 11,
          padding: 10,
          borderRadius: '8px 8px 8px 8px',
          marginBottom: -2,
        };
      default:
        return {
          ...baseStyles,
          width: 400,
          height: 450,
          fontSize: 11,
          padding: 12,
          borderRadius: '8px 8px 8px 8px',
          marginBottom: -2,
        };
    }
  };
  
  // Toggle Button Component
  const ToggleButton = () => (
    <button
      onClick={() => setIsVisible(!isVisible)}
      style={{
        position: 'fixed',
        bottom: viewport === 'mobile' ? 80 : 90,  // Moved higher to avoid chat input bar
        left: viewport === 'mobile' ? 20 : 30,
        width: viewport === 'mobile' ? 48 : 56,
        height: viewport === 'mobile' ? 48 : 56,
        borderRadius: '50%',
        backgroundColor: isVisible ? 'rgba(0, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.9)',
        border: '2px solid #00ffff',
        color: '#00ffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 9998, // Below chat input bar (9999) to prevent covering mute button
        transition: 'all 0.3s ease-in-out',
        pointerEvents: 'auto',
        boxShadow: '0 4px 12px rgba(0, 255, 255, 0.4)',
      }}
      data-testid="button-debug-overlay-toggle"
      className="debug-overlay-toggle"
      aria-label="Toggle debug overlay"
      title="Toggle Debug Overlay"
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
      <div style={getContainerStyles()}>
        {/* Content area that slides up (rendered first so it appears behind/above control panel) */}
        {isVisible && (
          <div
            style={getContentStyles()}
            data-testid="debug-content"
            onClick={(e) => e.stopPropagation()}
          >
            {isExpanded && (
              <div style={{ 
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {!showModules ? (
                  // Event Log
                  <div style={{ flex: 1, overflowY: 'auto' }}>
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
                ) : (
                  // Modules Display
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {/* Module Type Filter */}
                    <div style={{
                      display: 'flex',
                      gap: 4,
                      marginBottom: 8,
                      flexWrap: 'wrap',
                      fontSize: viewport === 'mobile' ? 9 : 10,
                    }}>
                      <button
                        onClick={() => setActiveModuleType('all')}
                        style={{
                          padding: '2px 6px',
                          background: activeModuleType === 'all' ? 'rgba(0, 255, 255, 0.2)' : 'transparent',
                          border: '1px solid #00ffff',
                          borderRadius: 3,
                          color: '#00ffff',
                          fontSize: viewport === 'mobile' ? 9 : 10,
                          cursor: 'pointer',
                        }}
                      >
                        All
                      </button>
                      {Object.values(ModuleType).map(type => (
                        <button
                          key={type}
                          onClick={() => setActiveModuleType(type)}
                          style={{
                            padding: '2px 6px',
                            background: activeModuleType === type ? 'rgba(0, 255, 255, 0.2)' : 'transparent',
                            border: '1px solid #00ffff',
                            borderRadius: 3,
                            color: '#00ffff',
                            fontSize: viewport === 'mobile' ? 9 : 10,
                            cursor: 'pointer',
                          }}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>
                    
                    {/* Module List */}
                    <div>
                      {modules
                        .filter(m => activeModuleType === 'all' || m.metadata.type === activeModuleType)
                        .sort((a, b) => {
                          const healthOrder = { 
                            [ModuleHealth.CRITICAL]: 0,
                            [ModuleHealth.WARNING]: 1,
                            [ModuleHealth.UNKNOWN]: 2,
                            [ModuleHealth.HEALTHY]: 3,
                          };
                          return healthOrder[a.health] - healthOrder[b.health];
                        })
                        .map(module => (
                          <div
                            key={module.metadata.id}
                            style={{
                              marginBottom: 8,
                              padding: '4px 8px',
                              background: 'rgba(0, 0, 0, 0.4)',
                              border: `1px solid ${
                                module.health === ModuleHealth.CRITICAL ? '#ff4444' :
                                module.health === ModuleHealth.WARNING ? '#ffaa00' :
                                module.health === ModuleHealth.HEALTHY ? '#00ff00' : '#888888'
                              }`,
                              borderRadius: 4,
                              fontSize: viewport === 'mobile' ? 9 : 10,
                            }}
                          >
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              marginBottom: 4,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {getModuleHealthIcon(module.health)}
                                <span style={{ fontWeight: 'bold', color: '#00ffff' }}>
                                  {module.metadata.name}
                                </span>
                              </div>
                              <span style={{
                                fontSize: 8,
                                color: getModuleStatusColor(module.status),
                                padding: '1px 4px',
                                border: `1px solid ${getModuleStatusColor(module.status)}`,
                                borderRadius: 3,
                              }}>
                                {module.status}
                              </span>
                            </div>
                            
                            <div style={{ fontSize: 9, color: '#aaa', marginBottom: 2 }}>
                              {module.metadata.id} • {module.metadata.type}
                            </div>
                            
                            {/* Module stats */}
                            <div style={{ 
                              display: 'flex', 
                              gap: 8, 
                              fontSize: 9, 
                              color: '#888',
                              marginTop: 4,
                            }}>
                              {module.stats.errorCount > 0 && (
                                <span style={{ color: '#ff4444' }}>
                                  Errors: {module.stats.errorCount}
                                </span>
                              )}
                              {module.stats.warningCount > 0 && (
                                <span style={{ color: '#ffaa00' }}>
                                  Warnings: {module.stats.warningCount}
                                </span>
                              )}
                              {module.metadata.critical && (
                                <span style={{ color: '#ff00ff' }}>
                                  CRITICAL
                                </span>
                              )}
                            </div>
                            
                            {/* Show last error if any */}
                            {module.errors.length > 0 && (
                              <div style={{ 
                                marginTop: 4, 
                                fontSize: 9, 
                                color: '#ff4444',
                                padding: '2px 4px',
                                background: 'rgba(255, 68, 68, 0.1)',
                                borderRadius: 3,
                              }}>
                                {module.errors[module.errors.length - 1].message}
                              </div>
                            )}
                            
                            {/* Dependencies */}
                            {module.metadata.dependencies && module.metadata.dependencies.length > 0 && (
                              <div style={{ marginTop: 4, fontSize: 9 }}>
                                <span style={{ color: '#666' }}>Deps: </span>
                                {module.metadata.dependencies.map(dep => (
                                  <span
                                    key={dep.moduleId}
                                    style={{ 
                                      color: dep.status === 'met' ? '#00ff00' : '#ff4444',
                                      marginRight: 4,
                                    }}
                                  >
                                    {dep.moduleId.split('.').pop()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                    
                    {/* Summary Stats */}
                    <div style={{
                      marginTop: 8,
                      padding: '4px 8px',
                      background: 'rgba(0, 255, 255, 0.1)',
                      borderRadius: 4,
                      fontSize: 9,
                      display: 'flex',
                      justifyContent: 'space-around',
                    }}>
                      <span>Total: {modules.length}</span>
                      <span style={{ color: '#00ff00' }}>
                        ✓ {modules.filter(m => m.health === ModuleHealth.HEALTHY).length}
                      </span>
                      <span style={{ color: '#ffaa00' }}>
                        ⚠ {modules.filter(m => m.health === ModuleHealth.WARNING).length}
                      </span>
                      <span style={{ color: '#ff4444' }}>
                        ✗ {modules.filter(m => m.health === ModuleHealth.CRITICAL).length}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Control Panel (tabs at bottom) */}
        {isVisible && (
          <div
            style={getControlPanelStyles()}
            data-testid="debug-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with health status */}
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
                display: 'grid',
                gridTemplateColumns: viewport === 'mobile' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                gap: viewport === 'mobile' ? 6 : 8,
                width: '100%',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.stt),
                  boxShadow: health.stt === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : 
                             health.stt === 'issue' ? '0 0 8px rgba(255, 68, 68, 0.5)' : 'none',
                  flexShrink: 0,
                }} data-testid="health-stt" />
                <span style={{ fontSize: viewport === 'mobile' ? 9 : 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  🎤STT
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.gate),
                  boxShadow: health.gate === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : 
                             health.gate === 'issue' ? '0 0 8px rgba(255, 68, 68, 0.5)' : 'none',
                  flexShrink: 0,
                }} data-testid="health-gate" />
                <span style={{ fontSize: viewport === 'mobile' ? 9 : 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  🚪Gate
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.tts),
                  boxShadow: health.tts === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : 
                             health.tts === 'issue' ? '0 0 8px rgba(255, 68, 68, 0.5)' : 'none',
                  flexShrink: 0,
                }} data-testid="health-tts" />
                <span style={{ fontSize: viewport === 'mobile' ? 9 : 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  🔊TTS
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.voiceprint),
                  boxShadow: health.voiceprint === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : 
                             health.voiceprint === 'issue' ? '0 0 8px rgba(255, 68, 68, 0.5)' : 'none',
                  flexShrink: 0,
                }} data-testid="health-voiceprint" />
                <span style={{ fontSize: viewport === 'mobile' ? 9 : 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {viewport === 'mobile' ? '🔐VPrint' : '🔐Voiceprint'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.vad),
                  boxShadow: health.vad === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : 
                             health.vad === 'issue' ? '0 0 8px rgba(255, 68, 68, 0.5)' : 'none',
                  flexShrink: 0,
                }} data-testid="health-vad" />
                <span style={{ fontSize: viewport === 'mobile' ? 9 : 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  👂VAD
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                <div style={{
                  width: viewport === 'mobile' ? 8 : 10,
                  height: viewport === 'mobile' ? 8 : 10,
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(health.orchestrator),
                  boxShadow: health.orchestrator === 'ok' ? '0 0 8px rgba(0, 255, 0, 0.5)' : 
                             health.orchestrator === 'issue' ? '0 0 8px rgba(255, 68, 68, 0.5)' : 'none',
                  flexShrink: 0,
                }} data-testid="health-orchestrator" />
                <span style={{ fontSize: viewport === 'mobile' ? 9 : 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {viewport === 'mobile' ? '🎭Orch' : '🎭Orchestrator'}
                </span>
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
            
            {/* View toggle buttons - now in control panel */}
            <div style={{
              display: 'flex',
              gap: 8,
              marginTop: 8,
            }}>
              <button
                  onClick={() => {
                    setShowModules(false);
                    setIsExpanded(true);
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    background: !showModules && isExpanded ? 'rgba(0, 255, 255, 0.2)' : 'transparent',
                    border: '1px solid #00ffff',
                    borderRadius: 4,
                    color: '#00ffff',
                    fontSize: viewport === 'mobile' ? 10 : 11,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                  }}
                  data-testid="debug-view-events"
                >
                  📜 Events
                </button>
                <button
                  onClick={() => {
                    setShowModules(true);
                    setIsExpanded(true);
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    background: showModules && isExpanded ? 'rgba(0, 255, 255, 0.2)' : 'transparent',
                    border: '1px solid #00ffff',
                    borderRadius: 4,
                    color: '#00ffff',
                    fontSize: viewport === 'mobile' ? 10 : 11,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                  }}
                  data-testid="debug-view-modules"
                >
                  📊 Modules ({modules.filter(m => m.health === ModuleHealth.CRITICAL).length}/{modules.length})
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}