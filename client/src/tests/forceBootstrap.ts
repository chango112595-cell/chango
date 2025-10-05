/**
 * Force bootstrap the conversation engine
 * This ensures Chango is properly initialized on app load
 */

import { bootstrapChango } from '@/app/bootstrap';

// Force reset the bootstrap flags and initialize
export async function forceBootstrap() {
  console.log('[ForceBootstrap] Starting forced bootstrap...');
  
  // Clear any stored bootstrap state
  (window as any).__bootstrapped = false;
  
  try {
    // Call bootstrap with proper options
    await bootstrapChango({
      autoStartListening: false, // Don't auto-start mic
      enableTTS: true,
      pauseOnHidden: true
    });
    
    console.log('[ForceBootstrap] ✅ Bootstrap complete!');
    
    // Verify conversation engine is initialized
    if ((window as any).conversationEngine) {
      const isInit = (window as any).conversationEngine.isInitialized();
      console.log('[ForceBootstrap] Conversation engine initialized:', isInit);
      
      if (!isInit) {
        console.error('[ForceBootstrap] Conversation engine not initialized after bootstrap!');
      }
    }
    
    return true;
  } catch (error) {
    console.error('[ForceBootstrap] Bootstrap failed:', error);
    return false;
  }
}

// Auto-run on import in development
if (import.meta.env.DEV) {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => forceBootstrap(), 100);
    });
  } else {
    // DOM is already ready, run after a small delay to let other components initialize
    setTimeout(() => forceBootstrap(), 100);
  }
}