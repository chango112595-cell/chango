/**
 * HeaderBar Component
 * Futuristic compact header for Jarvis Mode
 */

import { useEffect, useState } from 'react';
import { Activity, Cpu, Mic, MicOff, Power, Radio, Zap, Globe, Settings } from 'lucide-react';
import { voiceBus } from '../voice/voiceBus';
import { FEATURES } from '../config/featureFlags';
import { SettingsModal } from './SettingsModal';

interface HeaderBarProps {
  className?: string;
}

export function HeaderBar({ className = '' }: HeaderBarProps) {
  const [systemStatus, setSystemStatus] = useState({
    powered: true,
    listening: !voiceBus.isMuted(),
    speaking: false,
    processing: false,
  });
  
  const [metrics, setMetrics] = useState({
    latency: 0,
    activeConnections: 1,
    cpuLoad: 0,
  });
  
  const [time, setTime] = useState(new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to voice bus events
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(
      voiceBus.on('muteChange', (event) => {
        setSystemStatus(prev => ({ ...prev, listening: !event.muted }));
      })
    );

    unsubscribers.push(
      voiceBus.on('speakingChange', (event) => {
        setSystemStatus(prev => ({ ...prev, speaking: event.speaking || false }));
      })
    );

    unsubscribers.push(
      voiceBus.on('powerChange', (event) => {
        setSystemStatus(prev => ({ ...prev, powered: event.powered || false }));
      })
    );

    // Simulate metrics updates
    const metricsTimer = setInterval(() => {
      setMetrics({
        latency: Math.floor(Math.random() * 50) + 10,
        activeConnections: 1,
        cpuLoad: Math.floor(Math.random() * 30) + 5,
      });
    }, 3000);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      clearInterval(metricsTimer);
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Don't render if feature is disabled
  if (!FEATURES.SHOW_HEADER_BAR) {
    return null;
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 backdrop-blur-lg bg-gradient-to-r from-blue-600/20 to-cyan-500/20 border-b border-cyan-500/20 ${className}`}
    >
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Left Section - Identity & Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {/* Animated logo/icon */}
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/50 blur-lg animate-pulse" />
                <Zap className="relative w-6 h-6 text-cyan-400" />
              </div>
              
              <div className="flex flex-col">
                <span className="text-xs font-bold text-cyan-400 tracking-wider">
                  CHANGO AI
                </span>
                <span className="text-[10px] text-cyan-600/80">
                  JARVIS MODE
                </span>
              </div>
            </div>

            {/* System Status Indicators */}
            <div className="flex items-center gap-3 ml-6 text-xs">
              <div
                className={`flex items-center gap-1 ${
                  systemStatus.powered ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                <div className="relative inline-flex items-center gap-1">
                  {systemStatus.powered && (
                    <div className="absolute -left-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    </div>
                  )}
                  <span className="ml-3">{systemStatus.powered ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
              </div>

              <div
                className={`flex items-center gap-1 ${
                  systemStatus.listening ? 'text-blue-400' : 'text-gray-500'
                }`}
              >
                {systemStatus.listening ? (
                  <Mic className="w-3 h-3" />
                ) : (
                  <MicOff className="w-3 h-3" />
                )}
                <span>{systemStatus.listening ? 'LISTENING' : 'MUTED'}</span>
              </div>

              {systemStatus.speaking && (
                <div className="flex items-center gap-1 text-yellow-400 animate-pulse">
                  <Radio className="w-3 h-3" />
                  <span>SPEAKING</span>
                </div>
              )}
            </div>
          </div>

          {/* Center Section - Time & Date */}
          <div className="flex flex-col items-center">
            <div className="text-lg font-mono text-cyan-300 tracking-wider">
              {formatTime(time)}
            </div>
            <div className="text-[10px] text-cyan-600/80 uppercase">
              {formatDate(time)}
            </div>
          </div>

          {/* Right Section - Metrics */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1 text-gray-400">
              <Activity className="w-3 h-3" />
              <span>{metrics.latency}ms</span>
            </div>

            <div className="flex items-center gap-1 text-gray-400">
              <Cpu className="w-3 h-3" />
              <span>{metrics.cpuLoad}%</span>
            </div>

            <div className="flex items-center gap-1 text-gray-400">
              <Globe className="w-3 h-3" />
              <span>{metrics.activeConnections}</span>
            </div>

            {/* Settings Button */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-cyan-500/10 transition-colors"
              title="Open settings"
              data-testid="button-open-settings-header"
            >
              <Settings className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline text-cyan-400">Settings</span>
            </button>

            {/* Status light */}
            <div className="relative">
              <div
                className={`w-2 h-2 rounded-full ${
                  systemStatus.powered
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              {systemStatus.powered && (
                <div className="absolute inset-0 bg-emerald-400/50 rounded-full blur animate-ping" />
              )}
            </div>
          </div>
        </div>

        {/* Progress bar for processing */}
        {systemStatus.processing && (
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-cyan-500/20">
            <div className="h-full bg-cyan-400 animate-pulse" style={{ width: '100%' }} />
          </div>
        )}
      </div>
      
      {/* Settings Modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}

// Minimal version for embedding
export function HeaderBarMinimal({ className = '' }: { className?: string }) {
  const [muted, setMuted] = useState(false);
  const [powered] = useState(true);

  useEffect(() => {
    const unsub = voiceBus.on('muteChange', (event) => {
      setMuted(event.muted || false);
    });
    return unsub;
  }, []);

  if (!FEATURES.SHOW_HEADER_BAR) return null;

  return (
    <div className={`flex items-center justify-between p-2 bg-gradient-to-r from-blue-600/20 to-cyan-500/20 backdrop-blur-sm border-b border-cyan-500/20 ${className}`}>
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-bold text-cyan-400">LOLO AI</span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        {/* Status indicator */}
        <div className="flex items-center gap-1">
          {powered && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
          <span className="text-emerald-400">ONLINE</span>
        </div>
        {/* Mic status */}
        <div className="flex items-center gap-1">
          {muted ? (
            <MicOff className="w-3 h-3 text-gray-500" />
          ) : (
            <Mic className="w-3 h-3 text-blue-400" />
          )}
          <span className={muted ? "text-gray-500" : "text-blue-400"}>
            {muted ? 'MUTED' : 'LISTENING'}
          </span>
        </div>
      </div>
    </div>
  );
}