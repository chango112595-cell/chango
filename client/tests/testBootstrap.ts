/**
 * Test script to verify bootstrap functionality
 */

import { bootstrapLolo, shutdownLolo, getLoloStatus, resetBootstrap } from './app/bootstrap';

// Expose test functions to window for manual testing
if (typeof window !== 'undefined') {
  (window as any).testBootstrap = {
    // Test bootstrap initialization
    async testInit() {
      console.log('=== Testing Bootstrap Initialization ===');
      
      // Check initial status
      console.log('Initial status:', getLoloStatus());
      
      // Bootstrap with default options
      await bootstrapLolo();
      
      // Check status after bootstrap
      console.log('Status after bootstrap:', getLoloStatus());
      
      console.log('=== Test Complete ===');
    },
    
    // Test idempotency
    async testIdempotency() {
      console.log('=== Testing Bootstrap Idempotency ===');
      
      // First bootstrap
      console.log('First bootstrap call:');
      await bootstrapLolo();
      
      // Second bootstrap (should skip)
      console.log('Second bootstrap call (should skip):');
      await bootstrapLolo();
      
      // Third bootstrap (should still skip)
      console.log('Third bootstrap call (should skip):');
      await bootstrapLolo();
      
      console.log('Final status:', getLoloStatus());
      console.log('=== Test Complete ===');
    },
    
    // Test shutdown and re-init
    async testShutdownReInit() {
      console.log('=== Testing Shutdown and Re-initialization ===');
      
      // Bootstrap
      console.log('Bootstrapping...');
      await bootstrapLolo();
      console.log('Status after bootstrap:', getLoloStatus());
      
      // Shutdown
      console.log('Shutting down...');
      shutdownLolo();
      console.log('Status after shutdown:', getLoloStatus());
      
      // Re-bootstrap
      console.log('Re-bootstrapping...');
      await bootstrapLolo();
      console.log('Status after re-bootstrap:', getLoloStatus());
      
      console.log('=== Test Complete ===');
    },
    
    // Get current status
    getStatus() {
      return getLoloStatus();
    },
    
    // Manual bootstrap
    bootstrap: bootstrapLolo,
    
    // Manual shutdown
    shutdown: shutdownLolo,
    
    // Reset for testing
    reset: resetBootstrap
  };
  
  console.log('[Bootstrap Test] Test functions loaded. Available commands:');
  console.log('- window.testBootstrap.testInit() - Test initial bootstrap');
  console.log('- window.testBootstrap.testIdempotency() - Test idempotent behavior');
  console.log('- window.testBootstrap.testShutdownReInit() - Test shutdown and re-initialization');
  console.log('- window.testBootstrap.getStatus() - Get current system status');
  console.log('- window.testBootstrap.bootstrap() - Manually bootstrap');
  console.log('- window.testBootstrap.shutdown() - Manually shutdown');
  console.log('- window.testBootstrap.reset() - Reset bootstrap state');
}