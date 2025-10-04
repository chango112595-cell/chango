/**
 * Module Registry System
 * ======================
 * Comprehensive module discovery and tracking system for real-time monitoring
 * 
 * @module dev/moduleRegistry
 * @description Automatically discovers, registers and tracks all active modules in the application
 */

import { debugBus } from './debugBus';
import { errorHandler } from '../lib/error-handler';
import { FEATURES } from '../config/featureFlags';

/**
 * Module types in the application
 */
export enum ModuleType {
  VOICE = 'voice',
  UI = 'ui',
  SERVICE = 'service',
  CORE = 'core',
  DIAGNOSTIC = 'diagnostic',
  INTEGRATION = 'integration',
}

/**
 * Module status states
 */
export enum ModuleStatus {
  NOT_INITIALIZED = 'not_initialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  ACTIVE = 'active',
  ERROR = 'error',
  DEGRADED = 'degraded',
  DISABLED = 'disabled',
  RECOVERING = 'recovering',
}

/**
 * Module health status
 */
export enum ModuleHealth {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown',
}

/**
 * Module dependency information
 */
export interface ModuleDependency {
  moduleId: string;
  required: boolean;
  status: 'met' | 'unmet' | 'optional';
}

/**
 * Module metadata
 */
export interface ModuleMetadata {
  id: string;
  name: string;
  type: ModuleType;
  description: string;
  version?: string;
  path?: string;
  critical: boolean; // Is this module critical for app functionality
  dependencies?: ModuleDependency[];
  capabilities?: string[];
  config?: Record<string, any>;
}

/**
 * Module runtime statistics
 */
export interface ModuleStats {
  initTime?: number;
  lastActivity: number;
  errorCount: number;
  warningCount: number;
  apiCalls?: number;
  memoryUsage?: number;
  responseTime?: number;
  uptime?: number;
  restarts?: number;
}

/**
 * Module instance information
 */
export interface ModuleInstance {
  metadata: ModuleMetadata;
  status: ModuleStatus;
  health: ModuleHealth;
  stats: ModuleStats;
  lastHeartbeat: number;
  errors: Error[];
  warnings: string[];
  instance?: any; // Reference to actual module instance
  healthCheck?: () => Promise<ModuleHealthReport>;
  initialize?: () => Promise<boolean>;
  shutdown?: () => Promise<void>;
}

/**
 * Module health report
 */
export interface ModuleHealthReport {
  healthy: boolean;
  health: ModuleHealth;
  message?: string;
  metrics?: Record<string, any>;
  suggestions?: string[];
}

/**
 * Module Registry Class
 */
class ModuleRegistry {
  private static instance: ModuleRegistry;
  private modules: Map<string, ModuleInstance> = new Map();
  private discoveryCallbacks: Set<(module: ModuleInstance) => void> = new Set();
  private healthCheckInterval?: NodeJS.Timeout;
  private scanInterval?: NodeJS.Timeout;
  
  private constructor() {
    this.initializeRegistry();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }
    return ModuleRegistry.instance;
  }
  
  /**
   * Initialize the registry
   */
  private initializeRegistry() {
    // Register core modules
    this.registerCoreModules();
    
    // Start module scanning
    this.startModuleScanning();
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('ModuleRegistry', 'initialized', {
        moduleCount: this.modules.size
      });
    }
  }
  
  /**
   * Register core modules that always exist
   */
  private registerCoreModules() {
    // Voice modules
    this.registerModule({
      metadata: {
        id: 'voice.stt',
        name: 'Speech-to-Text',
        type: ModuleType.VOICE,
        description: 'Handles speech recognition and transcription',
        critical: true,
        capabilities: ['speech-recognition', 'transcription'],
        path: 'client/src/voice/always_listen.ts',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    this.registerModule({
      metadata: {
        id: 'voice.tts',
        name: 'Text-to-Speech',
        type: ModuleType.VOICE,
        description: 'Handles voice synthesis and audio output',
        critical: true,
        capabilities: ['speech-synthesis', 'audio-output'],
        path: 'client/src/voice/tts/orchestrator.ts',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    this.registerModule({
      metadata: {
        id: 'voice.wakeword',
        name: 'Wake Word Detection',
        type: ModuleType.VOICE,
        description: 'Detects activation phrases',
        critical: false,
        capabilities: ['wake-detection', 'activation'],
        path: 'client/src/voice/wakeWord.ts',
        dependencies: [
          { moduleId: 'voice.stt', required: true, status: 'unmet' }
        ],
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    this.registerModule({
      metadata: {
        id: 'voice.gate',
        name: 'Voice Gate',
        type: ModuleType.VOICE,
        description: 'Controls voice interaction permissions',
        critical: true,
        capabilities: ['permission-control', 'access-control'],
        path: 'client/src/core/gate.ts',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    this.registerModule({
      metadata: {
        id: 'voice.vad',
        name: 'Voice Activity Detection',
        type: ModuleType.VOICE,
        description: 'Detects when user is speaking',
        critical: false,
        capabilities: ['activity-detection', 'speech-boundaries'],
        path: 'client/src/voice/vad.ts',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    this.registerModule({
      metadata: {
        id: 'voice.voiceprint',
        name: 'Voiceprint Security',
        type: ModuleType.VOICE,
        description: 'Voice authentication and security',
        critical: false,
        capabilities: ['voice-authentication', 'speaker-verification'],
        path: 'client/src/voice/security/voiceprint.ts',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    // UI modules
    this.registerModule({
      metadata: {
        id: 'ui.chat',
        name: 'Chat Interface',
        type: ModuleType.UI,
        description: 'Main chat conversation interface',
        critical: true,
        capabilities: ['message-display', 'user-input'],
        path: 'client/src/components/Chat.tsx',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    this.registerModule({
      metadata: {
        id: 'ui.hologram',
        name: 'Hologram Display',
        type: ModuleType.UI,
        description: 'Holographic visualization interface',
        critical: false,
        capabilities: ['3d-visualization', 'animation'],
        path: 'client/src/components/HologramSphere.tsx',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    this.registerModule({
      metadata: {
        id: 'ui.controls',
        name: 'Voice Controls',
        type: ModuleType.UI,
        description: 'Voice interaction control panel',
        critical: false,
        capabilities: ['control-panel', 'settings'],
        path: 'client/src/components/VoiceControls.tsx',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    // Service modules
    this.registerModule({
      metadata: {
        id: 'service.responder',
        name: 'Response Service',
        type: ModuleType.SERVICE,
        description: 'Generates AI responses',
        critical: true,
        capabilities: ['response-generation', 'ai-processing'],
        path: 'client/src/services/responder.ts',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    this.registerModule({
      metadata: {
        id: 'service.conversation',
        name: 'Conversation Engine',
        type: ModuleType.SERVICE,
        description: 'Manages conversation flow and context',
        critical: true,
        capabilities: ['context-management', 'conversation-flow'],
        path: 'client/src/modules/conversationEngine/index.ts',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    this.registerModule({
      metadata: {
        id: 'service.curiosity',
        name: 'Curiosity Engine',
        type: ModuleType.SERVICE,
        description: 'Proactive conversation features',
        critical: false,
        capabilities: ['proactive-engagement', 'suggestions'],
        path: 'client/src/components/CuriosityEngine.tsx',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    // Core modules
    this.registerModule({
      metadata: {
        id: 'core.orchestrator',
        name: 'Voice Orchestrator',
        type: ModuleType.CORE,
        description: 'Coordinates voice interactions',
        critical: true,
        capabilities: ['coordination', 'flow-control'],
        path: 'client/src/core/orchestrator.ts',
        dependencies: [
          { moduleId: 'voice.stt', required: true, status: 'unmet' },
          { moduleId: 'voice.tts', required: true, status: 'unmet' },
          { moduleId: 'voice.gate', required: true, status: 'unmet' },
        ],
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    this.registerModule({
      metadata: {
        id: 'core.permissions',
        name: 'Permission Manager',
        type: ModuleType.CORE,
        description: 'Manages microphone and system permissions',
        critical: true,
        capabilities: ['permission-management', 'access-control'],
        path: 'client/src/core/permissions.ts',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    this.registerModule({
      metadata: {
        id: 'core.voicebus',
        name: 'Voice Event Bus',
        type: ModuleType.CORE,
        description: 'Central event system for voice interactions',
        critical: true,
        capabilities: ['event-management', 'pub-sub'],
        path: 'client/src/core/voice-bus.ts',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    // Diagnostic modules
    this.registerModule({
      metadata: {
        id: 'diagnostic.health',
        name: 'Health Monitor',
        type: ModuleType.DIAGNOSTIC,
        description: 'System health monitoring and auto-recovery',
        critical: false,
        capabilities: ['health-monitoring', 'auto-recovery'],
        path: 'client/src/dev/health/monitor.ts',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
    
    this.registerModule({
      metadata: {
        id: 'diagnostic.error',
        name: 'Error Handler',
        type: ModuleType.DIAGNOSTIC,
        description: 'Centralized error handling and recovery',
        critical: false,
        capabilities: ['error-handling', 'recovery-strategies'],
        path: 'client/src/lib/error-handler.ts',
      },
      status: ModuleStatus.NOT_INITIALIZED,
      health: ModuleHealth.UNKNOWN,
      stats: {
        lastActivity: Date.now(),
        errorCount: 0,
        warningCount: 0,
      },
      lastHeartbeat: Date.now(),
      errors: [],
      warnings: [],
    });
  }
  
  /**
   * Register a module
   */
  registerModule(module: ModuleInstance): void {
    this.modules.set(module.metadata.id, module);
    
    // Notify discovery callbacks
    this.discoveryCallbacks.forEach(cb => cb(module));
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('ModuleRegistry', 'module_registered', {
        id: module.metadata.id,
        name: module.metadata.name,
        type: module.metadata.type,
      });
    }
  }
  
  /**
   * Update module status
   */
  updateModuleStatus(moduleId: string, status: ModuleStatus): void {
    const module = this.modules.get(moduleId);
    if (!module) return;
    
    const previousStatus = module.status;
    module.status = status;
    module.lastHeartbeat = Date.now();
    
    // Update health based on status
    if (status === ModuleStatus.ERROR) {
      module.health = ModuleHealth.CRITICAL;
    } else if (status === ModuleStatus.DEGRADED || status === ModuleStatus.RECOVERING) {
      module.health = ModuleHealth.WARNING;
    } else if (status === ModuleStatus.READY || status === ModuleStatus.ACTIVE) {
      module.health = ModuleHealth.HEALTHY;
    }
    
    // Update dependencies
    this.updateDependencies(moduleId);
    
    if (FEATURES.DEBUG_BUS && previousStatus !== status) {
      debugBus.info('ModuleRegistry', 'module_status_changed', {
        id: moduleId,
        previousStatus,
        newStatus: status,
      });
    }
  }
  
  /**
   * Update module health
   */
  updateModuleHealth(moduleId: string, health: ModuleHealth, message?: string): void {
    const module = this.modules.get(moduleId);
    if (!module) return;
    
    module.health = health;
    module.lastHeartbeat = Date.now();
    
    if (message) {
      if (health === ModuleHealth.CRITICAL) {
        module.errors.push(new Error(message));
        module.stats.errorCount++;
      } else if (health === ModuleHealth.WARNING) {
        module.warnings.push(message);
        module.stats.warningCount++;
      }
    }
    
    // Keep only recent errors/warnings
    module.errors = module.errors.slice(-10);
    module.warnings = module.warnings.slice(-10);
  }
  
  /**
   * Update dependencies status
   */
  private updateDependencies(moduleId: string): void {
    // Update modules that depend on this one
    this.modules.forEach(module => {
      if (module.metadata.dependencies) {
        module.metadata.dependencies.forEach(dep => {
          if (dep.moduleId === moduleId) {
            const depModule = this.modules.get(moduleId);
            if (depModule) {
              dep.status = 
                depModule.status === ModuleStatus.READY || 
                depModule.status === ModuleStatus.ACTIVE 
                  ? 'met' 
                  : 'unmet';
            }
          }
        });
      }
    });
  }
  
  /**
   * Start module scanning
   */
  private startModuleScanning(): void {
    // Scan for active modules periodically
    this.scanInterval = setInterval(() => {
      this.scanActiveModules();
    }, 5000); // Every 5 seconds
    
    // Initial scan
    this.scanActiveModules();
  }
  
  /**
   * Scan for active modules
   */
  private scanActiveModules(): void {
    // Check window objects for module instances
    const windowObj = window as any;
    
    // Check for voice modules
    if (windowObj.alwaysListen) {
      this.updateModuleStatus('voice.stt', ModuleStatus.ACTIVE);
    }
    
    // Check for TTS
    if (windowObj.speechSynthesis) {
      this.updateModuleStatus('voice.tts', 
        windowObj.speechSynthesis.speaking ? ModuleStatus.ACTIVE : ModuleStatus.READY
      );
    }
    
    // Check for voice gate
    if (windowObj.voiceGate || (window as any).__VOICE_GATE__) {
      this.updateModuleStatus('voice.gate', ModuleStatus.READY);
    }
    
    // Check for health monitor
    if (windowObj.__CH_HEALTH__) {
      this.updateModuleStatus('diagnostic.health', ModuleStatus.ACTIVE);
    }
    
    // Scan DOM for UI components
    this.scanUIComponents();
  }
  
  /**
   * Scan for active UI components
   */
  private scanUIComponents(): void {
    // Check for chat component
    if (document.querySelector('[data-testid*="chat"]')) {
      this.updateModuleStatus('ui.chat', ModuleStatus.ACTIVE);
    }
    
    // Check for hologram
    if (document.querySelector('.hologram-sphere, .hologram-canvas')) {
      this.updateModuleStatus('ui.hologram', ModuleStatus.ACTIVE);
    }
    
    // Check for voice controls
    if (document.querySelector('[data-testid*="voice-control"]')) {
      this.updateModuleStatus('ui.controls', ModuleStatus.ACTIVE);
    }
  }
  
  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.checkModulesHealth();
    }, 3000); // Every 3 seconds
  }
  
  /**
   * Check health of all modules
   */
  private async checkModulesHealth(): Promise<void> {
    for (const [id, module] of this.modules) {
      try {
        // Check heartbeat timeout
        const heartbeatAge = Date.now() - module.lastHeartbeat;
        const timeout = module.metadata.critical ? 15000 : 30000;
        
        if (heartbeatAge > timeout && module.status === ModuleStatus.ACTIVE) {
          this.updateModuleHealth(id, ModuleHealth.WARNING, 'Module appears inactive');
        }
        
        // Run custom health check if available
        if (module.healthCheck) {
          const report = await module.healthCheck();
          this.updateModuleHealth(
            id, 
            report.health, 
            report.message
          );
        }
      } catch (error) {
        errorHandler.handle(error, {
          module: 'ModuleRegistry',
          action: 'health_check',
        });
      }
    }
  }
  
  /**
   * Get module by ID
   */
  getModule(moduleId: string): ModuleInstance | undefined {
    return this.modules.get(moduleId);
  }
  
  /**
   * Get all modules
   */
  getAllModules(): ModuleInstance[] {
    return Array.from(this.modules.values());
  }
  
  /**
   * Get modules by type
   */
  getModulesByType(type: ModuleType): ModuleInstance[] {
    return Array.from(this.modules.values()).filter(m => m.metadata.type === type);
  }
  
  /**
   * Get modules by status
   */
  getModulesByStatus(status: ModuleStatus): ModuleInstance[] {
    return Array.from(this.modules.values()).filter(m => m.status === status);
  }
  
  /**
   * Get modules by health
   */
  getModulesByHealth(health: ModuleHealth): ModuleInstance[] {
    return Array.from(this.modules.values()).filter(m => m.health === health);
  }
  
  /**
   * Get critical modules
   */
  getCriticalModules(): ModuleInstance[] {
    return Array.from(this.modules.values()).filter(m => m.metadata.critical);
  }
  
  /**
   * Get module statistics
   */
  getStatistics() {
    const modules = Array.from(this.modules.values());
    
    return {
      total: modules.length,
      byType: {
        voice: modules.filter(m => m.metadata.type === ModuleType.VOICE).length,
        ui: modules.filter(m => m.metadata.type === ModuleType.UI).length,
        service: modules.filter(m => m.metadata.type === ModuleType.SERVICE).length,
        core: modules.filter(m => m.metadata.type === ModuleType.CORE).length,
        diagnostic: modules.filter(m => m.metadata.type === ModuleType.DIAGNOSTIC).length,
      },
      byStatus: {
        notInitialized: modules.filter(m => m.status === ModuleStatus.NOT_INITIALIZED).length,
        initializing: modules.filter(m => m.status === ModuleStatus.INITIALIZING).length,
        ready: modules.filter(m => m.status === ModuleStatus.READY).length,
        active: modules.filter(m => m.status === ModuleStatus.ACTIVE).length,
        error: modules.filter(m => m.status === ModuleStatus.ERROR).length,
        degraded: modules.filter(m => m.status === ModuleStatus.DEGRADED).length,
      },
      byHealth: {
        healthy: modules.filter(m => m.health === ModuleHealth.HEALTHY).length,
        warning: modules.filter(m => m.health === ModuleHealth.WARNING).length,
        critical: modules.filter(m => m.health === ModuleHealth.CRITICAL).length,
        unknown: modules.filter(m => m.health === ModuleHealth.UNKNOWN).length,
      },
      criticalModules: {
        total: modules.filter(m => m.metadata.critical).length,
        healthy: modules.filter(m => m.metadata.critical && m.health === ModuleHealth.HEALTHY).length,
      },
      totalErrors: modules.reduce((sum, m) => sum + m.stats.errorCount, 0),
      totalWarnings: modules.reduce((sum, m) => sum + m.stats.warningCount, 0),
    };
  }
  
  /**
   * Generate diagnostic report
   */
  generateDiagnosticReport(): string {
    const stats = this.getStatistics();
    const modules = Array.from(this.modules.values());
    
    let report = '=== MODULE DIAGNOSTIC REPORT ===\n\n';
    report += `Timestamp: ${new Date().toISOString()}\n\n`;
    
    // Summary
    report += '--- SUMMARY ---\n';
    report += `Total Modules: ${stats.total}\n`;
    report += `Critical Modules: ${stats.criticalModules.total} (${stats.criticalModules.healthy} healthy)\n`;
    report += `Errors: ${stats.totalErrors} | Warnings: ${stats.totalWarnings}\n\n`;
    
    // Health Overview
    report += '--- HEALTH OVERVIEW ---\n';
    report += `Healthy: ${stats.byHealth.healthy}\n`;
    report += `Warning: ${stats.byHealth.warning}\n`;
    report += `Critical: ${stats.byHealth.critical}\n`;
    report += `Unknown: ${stats.byHealth.unknown}\n\n`;
    
    // Critical Issues
    const criticalModules = modules.filter(m => m.health === ModuleHealth.CRITICAL);
    if (criticalModules.length > 0) {
      report += '--- CRITICAL ISSUES ---\n';
      criticalModules.forEach(m => {
        report += `[${m.metadata.id}] ${m.metadata.name}\n`;
        if (m.errors.length > 0) {
          report += `  Last Error: ${m.errors[m.errors.length - 1].message}\n`;
        }
      });
      report += '\n';
    }
    
    // Module Details
    report += '--- MODULE DETAILS ---\n';
    Object.values(ModuleType).forEach(type => {
      const typeModules = modules.filter(m => m.metadata.type === type);
      if (typeModules.length > 0) {
        report += `\n[${type.toUpperCase()}]\n`;
        typeModules.forEach(m => {
          const healthSymbol = 
            m.health === ModuleHealth.HEALTHY ? '✓' :
            m.health === ModuleHealth.WARNING ? '⚠' :
            m.health === ModuleHealth.CRITICAL ? '✗' : '?';
          
          report += `  ${healthSymbol} ${m.metadata.name} (${m.metadata.id})\n`;
          report += `     Status: ${m.status} | Health: ${m.health}\n`;
          report += `     Errors: ${m.stats.errorCount} | Warnings: ${m.stats.warningCount}\n`;
          
          if (m.metadata.dependencies && m.metadata.dependencies.length > 0) {
            const unmetDeps = m.metadata.dependencies.filter(d => d.status === 'unmet');
            if (unmetDeps.length > 0) {
              report += `     Unmet Dependencies: ${unmetDeps.map(d => d.moduleId).join(', ')}\n`;
            }
          }
        });
      }
    });
    
    return report;
  }
  
  /**
   * Subscribe to module discovery
   */
  onModuleDiscovered(callback: (module: ModuleInstance) => void): () => void {
    this.discoveryCallbacks.add(callback);
    return () => this.discoveryCallbacks.delete(callback);
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    this.modules.clear();
    this.discoveryCallbacks.clear();
  }
}

// Create singleton instance
export const moduleRegistry = ModuleRegistry.getInstance();

// Export convenience functions
export const registerModule = (module: ModuleInstance) => moduleRegistry.registerModule(module);
export const updateModuleStatus = (id: string, status: ModuleStatus) => moduleRegistry.updateModuleStatus(id, status);
export const updateModuleHealth = (id: string, health: ModuleHealth, message?: string) => 
  moduleRegistry.updateModuleHealth(id, health, message);
export const getModule = (id: string) => moduleRegistry.getModule(id);
export const getAllModules = () => moduleRegistry.getAllModules();
export const getModuleStats = () => moduleRegistry.getStatistics();
export const generateDiagnosticReport = () => moduleRegistry.generateDiagnosticReport();

// Expose to window in dev mode
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__MODULE_REGISTRY__ = {
    moduleRegistry,
    getStats: getModuleStats,
    getReport: generateDiagnosticReport,
    getAllModules,
    ModuleType,
    ModuleStatus,
    ModuleHealth,
  };
  console.log('[ModuleRegistry] Exposed to window.__MODULE_REGISTRY__');
}