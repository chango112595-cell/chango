/**
 * Centralized Error Handler Module
 * =================================
 * 
 * @module lib/error-handler
 * @description Provides consistent error handling patterns across the application
 * 
 * **Purpose:**
 * - Standardize error logging and reporting
 * - Provide error recovery strategies
 * - Centralize error message formatting
 * - Track error metrics for monitoring
 * 
 * **Error Categories:**
 * - Voice: STT/TTS/Wake word errors
 * - Permission: Microphone access errors
 * - Network: API and connection errors
 * - System: Application-level errors
 */

import { debugBus } from '../dev/debugBus';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** Informational, no action needed */
  INFO = 'info',
  
  /** Warning, may need attention */
  WARNING = 'warning',
  
  /** Error requiring recovery */
  ERROR = 'error',
  
  /** Critical error requiring immediate attention */
  CRITICAL = 'critical',
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  VOICE = 'voice',
  PERMISSION = 'permission',
  NETWORK = 'network',
  SYSTEM = 'system',
  USER_INPUT = 'user_input',
}

/**
 * Standard error structure
 */
export interface ApplicationError {
  /** Unique error code */
  code: string;
  
  /** Human-readable message */
  message: string;
  
  /** Error category */
  category: ErrorCategory;
  
  /** Severity level */
  severity: ErrorSeverity;
  
  /** Additional context */
  context?: Record<string, any>;
  
  /** Original error if wrapped */
  originalError?: Error;
  
  /** Timestamp */
  timestamp: number;
  
  /** Recovery suggestions */
  recovery?: string[];
}

/**
 * Error recovery strategies
 */
export interface RecoveryStrategy {
  /** Whether to retry automatically */
  shouldRetry: boolean;
  
  /** Retry delay in milliseconds */
  retryDelay?: number;
  
  /** Maximum retry attempts */
  maxRetries?: number;
  
  /** Fallback action */
  fallback?: () => void;
  
  /** User notification required */
  notifyUser?: boolean;
}

/**
 * Centralized error handler class
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ApplicationError[] = [];
  private readonly maxLogSize = 100;
  
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  /**
   * Handle an error with consistent logging and recovery
   */
  handle(
    error: Error | ApplicationError | unknown,
    context?: {
      module?: string;
      action?: string;
      category?: ErrorCategory;
      severity?: ErrorSeverity;
    }
  ): ApplicationError {
    const appError = this.normalizeError(error, context);
    
    // Log to debug bus
    this.logError(appError);
    
    // Store in error log
    this.storeError(appError);
    
    // Apply recovery strategy
    this.applyRecovery(appError);
    
    return appError;
  }
  
  /**
   * Convert various error types to ApplicationError
   */
  private normalizeError(
    error: Error | ApplicationError | unknown,
    context?: any
  ): ApplicationError {
    if (this.isApplicationError(error)) {
      return error;
    }
    
    const timestamp = Date.now();
    const module = context?.module || 'unknown';
    const action = context?.action || 'unknown';
    
    if (error instanceof Error) {
      // Map specific error types to categories
      const category = this.categorizeError(error, context);
      const severity = this.assessSeverity(error, category);
      
      return {
        code: `${category.toUpperCase()}_${action.toUpperCase()}_ERROR`,
        message: error.message,
        category,
        severity,
        context: { module, action, ...context },
        originalError: error,
        timestamp,
        recovery: this.suggestRecovery(category, error),
      };
    }
    
    // Unknown error type
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.WARNING,
      context: { module, action, error, ...context },
      timestamp,
    };
  }
  
  /**
   * Type guard for ApplicationError
   */
  private isApplicationError(error: any): error is ApplicationError {
    return error &&
           typeof error === 'object' &&
           'code' in error &&
           'message' in error &&
           'category' in error;
  }
  
  /**
   * Categorize errors based on type and context
   */
  private categorizeError(error: Error, context?: any): ErrorCategory {
    const message = error.message.toLowerCase();
    
    // Voice-related errors
    if (message.includes('speech') || 
        message.includes('recognition') || 
        message.includes('synthesis') ||
        context?.category === ErrorCategory.VOICE) {
      return ErrorCategory.VOICE;
    }
    
    // Permission errors
    if (message.includes('permission') || 
        message.includes('denied') ||
        message.includes('notallowed')) {
      return ErrorCategory.PERMISSION;
    }
    
    // Network errors
    if (message.includes('fetch') || 
        message.includes('network') ||
        message.includes('timeout')) {
      return ErrorCategory.NETWORK;
    }
    
    // User input errors
    if (message.includes('invalid') || 
        message.includes('validation')) {
      return ErrorCategory.USER_INPUT;
    }
    
    return ErrorCategory.SYSTEM;
  }
  
  /**
   * Assess error severity
   */
  private assessSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    // Permission errors are critical
    if (category === ErrorCategory.PERMISSION) {
      return ErrorSeverity.CRITICAL;
    }
    
    // Network errors are usually recoverable
    if (category === ErrorCategory.NETWORK) {
      return ErrorSeverity.WARNING;
    }
    
    // Voice errors depend on specific issue
    if (category === ErrorCategory.VOICE) {
      if (error.message.includes('not supported')) {
        return ErrorSeverity.CRITICAL;
      }
      return ErrorSeverity.ERROR;
    }
    
    return ErrorSeverity.ERROR;
  }
  
  /**
   * Suggest recovery actions based on error category
   */
  private suggestRecovery(category: ErrorCategory, error: Error): string[] {
    const suggestions: string[] = [];
    
    switch (category) {
      case ErrorCategory.PERMISSION:
        suggestions.push('Check browser settings for microphone permission');
        suggestions.push('Ensure the site is accessed over HTTPS');
        suggestions.push('Try refreshing the page');
        break;
        
      case ErrorCategory.VOICE:
        suggestions.push('Check if microphone is connected');
        suggestions.push('Try using a different browser');
        suggestions.push('Restart the voice service');
        break;
        
      case ErrorCategory.NETWORK:
        suggestions.push('Check internet connection');
        suggestions.push('Retry the operation');
        suggestions.push('Check if the service is available');
        break;
        
      case ErrorCategory.USER_INPUT:
        suggestions.push('Check input format');
        suggestions.push('Provide valid values');
        break;
        
      default:
        suggestions.push('Refresh the application');
        suggestions.push('Contact support if issue persists');
    }
    
    return suggestions;
  }
  
  /**
   * Log error to debug bus
   */
  private logError(error: ApplicationError): void {
    const logFn = this.getLogFunction(error.severity);
    
    logFn(
      'ErrorHandler',
      `${error.category}_error`,
      {
        code: error.code,
        message: error.message,
        severity: error.severity,
        context: error.context,
      }
    );
  }
  
  /**
   * Get appropriate log function based on severity
   */
  private getLogFunction(severity: ErrorSeverity) {
    switch (severity) {
      case ErrorSeverity.INFO:
        return debugBus.info.bind(debugBus);
      case ErrorSeverity.WARNING:
        return debugBus.warn.bind(debugBus);
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
        return debugBus.error.bind(debugBus);
      default:
        return debugBus.info.bind(debugBus);
    }
  }
  
  /**
   * Store error in log with size limit
   */
  private storeError(error: ApplicationError): void {
    this.errorLog.push(error);
    
    // Maintain size limit
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }
  }
  
  /**
   * Apply recovery strategy for error
   */
  private applyRecovery(error: ApplicationError): void {
    const strategy = this.getRecoveryStrategy(error);
    
    if (strategy.notifyUser) {
      // Emit event for UI notification
      debugBus.error('ErrorHandler', 'user_notification_required', {
        message: error.message,
        recovery: error.recovery,
      });
    }
    
    if (strategy.shouldRetry && strategy.retryDelay) {
      setTimeout(() => {
        debugBus.info('ErrorHandler', 'retry_attempt', {
          code: error.code,
          category: error.category,
        });
      }, strategy.retryDelay);
    }
    
    if (strategy.fallback) {
      strategy.fallback();
    }
  }
  
  /**
   * Get recovery strategy for error type
   */
  private getRecoveryStrategy(error: ApplicationError): RecoveryStrategy {
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return {
          shouldRetry: true,
          retryDelay: 5000,
          maxRetries: 3,
          notifyUser: false,
        };
        
      case ErrorCategory.PERMISSION:
        return {
          shouldRetry: false,
          notifyUser: true,
        };
        
      case ErrorCategory.VOICE:
        return {
          shouldRetry: true,
          retryDelay: 2000,
          maxRetries: 1,
          notifyUser: error.severity === ErrorSeverity.CRITICAL,
        };
        
      default:
        return {
          shouldRetry: false,
          notifyUser: error.severity >= ErrorSeverity.ERROR,
        };
    }
  }
  
  /**
   * Get recent errors for debugging
   */
  getRecentErrors(count = 10): ApplicationError[] {
    return this.errorLog.slice(-count);
  }
  
  /**
   * Clear error log
   */
  clearErrors(): void {
    this.errorLog = [];
  }
  
  /**
   * Get error statistics
   */
  getStatistics() {
    const stats: Record<ErrorCategory, number> = {
      [ErrorCategory.VOICE]: 0,
      [ErrorCategory.PERMISSION]: 0,
      [ErrorCategory.NETWORK]: 0,
      [ErrorCategory.SYSTEM]: 0,
      [ErrorCategory.USER_INPUT]: 0,
    };
    
    this.errorLog.forEach(error => {
      stats[error.category]++;
    });
    
    return {
      total: this.errorLog.length,
      byCategory: stats,
      criticalCount: this.errorLog.filter(
        e => e.severity === ErrorSeverity.CRITICAL
      ).length,
    };
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Export convenience functions
export const handleError = (error: any, context?: any) => 
  errorHandler.handle(error, context);

export const getErrorStats = () => errorHandler.getStatistics();

export const clearErrors = () => errorHandler.clearErrors();