/**
 * Health Monitor with Auto-Heal
 * Monitors system health and automatically heals common issues
 */

import { FEATURES } from '../../config/featureFlags';
import { debugBus } from '../debugBus';
import { voiceBus } from '../../voice/voiceBus';

interface HealthState {
  lastSttHeartbeat: number;
  lastGateHeartbeat: number;
  lastTtsHeartbeat: number;
  lastOrchestratorHeartbeat: number;
  lastVoiceprintHeartbeat: number;
  lastVadHeartbeat: number;
  ttsStartTime: number | null;
  isTtsSpeaking: boolean;
  isMonitoring: boolean;
  consecutiveSttStuckChecks: number;
  lastRecoveryAttempt: number;
  sttErrorCount: number;
}

class HealthMonitor {
  private state: HealthState = {
    lastSttHeartbeat: Date.now(),
    lastGateHeartbeat: Date.now(),
    lastTtsHeartbeat: Date.now(),
    lastOrchestratorHeartbeat: Date.now(),
    lastVoiceprintHeartbeat: Date.now(),
    lastVadHeartbeat: Date.now(),
    ttsStartTime: null,
    isTtsSpeaking: false,
    isMonitoring: false,
    consecutiveSttStuckChecks: 0,
    lastRecoveryAttempt: 0,
    sttErrorCount: 0
  };
  
  private readonly MIN_RECOVERY_INTERVAL = 30000; // 30 seconds between recovery attempts
  private readonly MAX_STT_STUCK_CHECKS = 3; // Try 3 times before manual recovery
  
  private monitorInterval: NodeJS.Timeout | null = null;
  
  /**
   * Update heartbeat for a specific system
   */
  beat(system: 'stt' | 'gate' | 'tts' | 'orchestrator' | 'voiceprint' | 'vad', data?: any): void {
    try {
      const now = Date.now();
      
      switch (system) {
        case 'stt':
          this.state.lastSttHeartbeat = now;
          if (FEATURES.DEBUG_BUS) {
            debugBus.info('Health', 'stt_heartbeat', data);
          }
          break;
          
        case 'gate':
          this.state.lastGateHeartbeat = now;
          if (FEATURES.DEBUG_BUS) {
            debugBus.info('Health', 'gate_heartbeat', data);
          }
          break;
          
        case 'tts':
          this.state.lastTtsHeartbeat = now;
          // Track TTS speaking state
          if (data?.speaking === true) {
            this.state.isTtsSpeaking = true;
            this.state.ttsStartTime = now;
          } else if (data?.speaking === false) {
            this.state.isTtsSpeaking = false;
            this.state.ttsStartTime = null;
          }
          if (FEATURES.DEBUG_BUS) {
            debugBus.info('Health', 'tts_heartbeat', data);
          }
          break;
          
        case 'orchestrator':
          this.state.lastOrchestratorHeartbeat = now;
          if (FEATURES.DEBUG_BUS) {
            debugBus.info('Health', 'orchestrator_heartbeat', data);
          }
          break;
          
        case 'voiceprint':
          this.state.lastVoiceprintHeartbeat = now;
          if (FEATURES.DEBUG_BUS) {
            debugBus.info('Health', 'voiceprint_heartbeat', data);
          }
          break;
          
        case 'vad':
          this.state.lastVadHeartbeat = now;
          if (FEATURES.DEBUG_BUS) {
            debugBus.info('Health', 'vad_heartbeat', data);
          }
          break;
      }
    } catch (error) {
      console.error('[HealthMonitor] Error updating heartbeat:', error);
    }
  }
  
  /**
   * Start health monitoring
   */
  startHealthWatch(): void {
    try {
      // Don't start if already monitoring or auto-heal is disabled
      if (this.state.isMonitoring || !FEATURES.AUTO_HEAL) {
        console.log('[HealthMonitor] Not starting:', {
          isMonitoring: this.state.isMonitoring,
          autoHealEnabled: FEATURES.AUTO_HEAL
        });
        return;
      }
      
      this.state.isMonitoring = true;
      console.log('[HealthMonitor] Starting health watch...');
      
      // Monitor health every 3 seconds
      this.monitorInterval = setInterval(() => {
        this.checkHealth();
      }, 3000);
      
      // Initial check
      this.checkHealth();
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('Health', 'monitor_started', {
          sttTimeout: 12000,
          ttsTimeout: 10000,
          checkInterval: 3000
        });
      }
    } catch (error) {
      console.error('[HealthMonitor] Error starting health watch:', error);
    }
  }
  
  /**
   * Stop health monitoring
   */
  stopHealthWatch(): void {
    try {
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = null;
      }
      
      this.state.isMonitoring = false;
      console.log('[HealthMonitor] Health watch stopped');
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('Health', 'monitor_stopped');
      }
    } catch (error) {
      console.error('[HealthMonitor] Error stopping health watch:', error);
    }
  }
  
  /**
   * Check system health and apply auto-heal if needed
   */
  private checkHealth(): void {
    try {
      const now = Date.now();
      
      // Check STT health (12 second timeout)
      const sttAge = now - this.state.lastSttHeartbeat;
      
      // Import alwaysListen dynamically to avoid circular dependency
      const alwaysListen = (window as any).alwaysListen;
      
      // Get STT status if available
      const sttStatus = alwaysListen?.getStatus?.() || {};
      
      // Check if STT is stuck or in error state
      const sttStuck = sttAge > 12000;
      const sttError = sttStatus.state === 'error';
      const sttPaused = sttStatus.isPausedForRecovery;
      
      if (sttStuck || sttError) {
        // Check if we're already paused for recovery
        if (sttPaused) {
          console.log('[HealthMonitor] STT paused for manual recovery, skipping auto-restart');
          this.state.consecutiveSttStuckChecks = 0; // Reset counter
          return;
        }
        
        // Increment consecutive stuck checks
        this.state.consecutiveSttStuckChecks++;
        
        // Check if we've reached max attempts
        if (this.state.consecutiveSttStuckChecks >= this.MAX_STT_STUCK_CHECKS) {
          console.error('[HealthMonitor] Max STT stuck checks reached, manual recovery needed');
          
          if (FEATURES.DEBUG_BUS) {
            debugBus.error('Health', 'stt_max_recovery_attempts', {
              consecutiveChecks: this.state.consecutiveSttStuckChecks,
              sttAge,
              sttError: sttStatus.errorMessage
            });
          }
          
          // Force pause for manual recovery
          if (alwaysListen?.forceRestart) {
            console.log('[HealthMonitor] Attempting force restart as last resort');
            alwaysListen.forceRestart();
          }
          
          this.state.consecutiveSttStuckChecks = 0; // Reset counter after forced restart
          this.state.lastRecoveryAttempt = now;
          return;
        }
        
        // Check if enough time has passed since last recovery attempt
        if (now - this.state.lastRecoveryAttempt < this.MIN_RECOVERY_INTERVAL) {
          console.log('[HealthMonitor] Too soon since last recovery, waiting...');
          return;
        }
        
        console.warn('[HealthMonitor] STT appears stuck, attempting restart...', {
          sttAge,
          sttError,
          attempt: this.state.consecutiveSttStuckChecks
        });
        
        this.restartStt();
        this.state.lastRecoveryAttempt = now;
      } else {
        // STT is healthy, reset counter
        if (this.state.consecutiveSttStuckChecks > 0) {
          console.log('[HealthMonitor] STT recovered, resetting counter');
          this.state.consecutiveSttStuckChecks = 0;
        }
      }
      
      // Check TTS health (10 second stuck timeout)
      if (this.state.isTtsSpeaking && this.state.ttsStartTime) {
        const ttsDuration = now - this.state.ttsStartTime;
        if (ttsDuration > 10000) {
          console.warn('[HealthMonitor] TTS appears stuck, attempting cancel...');
          this.cancelStuckTts();
        }
      }
      
      // Log health check
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('Health', 'check', {
          sttAge,
          gateAge: now - this.state.lastGateHeartbeat,
          ttsAge: now - this.state.lastTtsHeartbeat,
          orchestratorAge: now - this.state.lastOrchestratorHeartbeat,
          ttsSpeaking: this.state.isTtsSpeaking
        });
      }
    } catch (error) {
      console.error('[HealthMonitor] Error checking health:', error);
    }
  }
  
  /**
   * Restart STT (Speech-to-Text)
   */
  private restartStt(): void {
    try {
      // Check if microphone permission exists first
      // If no permission, don't try to restart as it will fail
      const hasPermission = (window as any).alwaysListen?.getStatus?.()?.hasPermission;
      
      if (hasPermission === false) {
        console.log('[HealthMonitor] Skipping STT restart - no microphone permission');
        // Reset heartbeat to prevent repeated restart attempts
        this.state.lastSttHeartbeat = Date.now();
        return;
      }
      
      console.log('[HealthMonitor] Restarting STT...');
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.warn('Health', 'auto_restart_stt', {
          lastHeartbeat: this.state.lastSttHeartbeat
        });
      }
      
      // Restart STT by toggling power
      if (voiceBus) {
        const currentPower = voiceBus.getState().power;
        if (currentPower) {
          // Turn off and on again
          voiceBus.setPower(false);
          setTimeout(() => {
            voiceBus.setPower(true);
            console.log('[HealthMonitor] STT restart completed');
          }, 500);
        }
      }
      
      // Reset heartbeat to prevent repeated restarts
      this.state.lastSttHeartbeat = Date.now();
    } catch (error) {
      console.error('[HealthMonitor] Error restarting STT:', error);
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('Health', 'auto_restart_stt_failed', { error: (error as any).message });
      }
    }
  }
  
  /**
   * Cancel stuck TTS (Text-to-Speech)
   */
  private cancelStuckTts(): void {
    try {
      console.log('[HealthMonitor] Cancelling stuck TTS...');
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.warn('Health', 'auto_cancel_tts', {
          startTime: this.state.ttsStartTime,
          duration: Date.now() - (this.state.ttsStartTime || 0)
        });
      }
      
      // Cancel TTS
      if (voiceBus) {
        voiceBus.cancelSpeak('system');
      }
      
      // Reset TTS state
      this.state.isTtsSpeaking = false;
      this.state.ttsStartTime = null;
      this.state.lastTtsHeartbeat = Date.now();
      
      console.log('[HealthMonitor] TTS cancel completed');
    } catch (error) {
      console.error('[HealthMonitor] Error cancelling TTS:', error);
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('Health', 'auto_cancel_tts_failed', { error: (error as any).message });
      }
    }
  }
  
  /**
   * Get current health state (for debugging)
   */
  getState(): HealthState {
    return { ...this.state };
  }
}

// Create singleton instance
const healthMonitor = new HealthMonitor();

// Export functions
export const beat = healthMonitor.beat.bind(healthMonitor);
export const startHealthWatch = healthMonitor.startHealthWatch.bind(healthMonitor);
export const stopHealthWatch = healthMonitor.stopHealthWatch.bind(healthMonitor);

// Expose to window in dev mode
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__CH_HEALTH__ = {
    beat,
    startHealthWatch,
    stopHealthWatch,
    getState: healthMonitor.getState.bind(healthMonitor)
  };
  console.log('[HealthMonitor] Exposed to window.__CH_HEALTH__');
  
  // Auto-start health monitoring if AUTO_HEAL is enabled
  if (FEATURES.AUTO_HEAL) {
    console.log('[HealthMonitor] AUTO_HEAL is enabled, starting health watch...');
    startHealthWatch();
  } else {
    console.log('[HealthMonitor] AUTO_HEAL is disabled, health watch not started');
  }
}