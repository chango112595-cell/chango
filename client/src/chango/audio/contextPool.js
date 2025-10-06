/**
 * AudioContextPool - Manages a single AudioContext instance
 * Handles audio context lifecycle, unlock for mobile, and master gain control
 */
class AudioContextPool {
  constructor() {
    this.context = null;
    this.masterGainNode = null;
    this.isUnlocked = false;
  }

  /**
   * Get or create the AudioContext
   * @returns {AudioContext} The audio context instance
   */
  getContext() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContextClass({
        sampleRate: 48000
      });
      
      // Create master gain node and connect to destination
      this.masterGainNode = this.context.createGain();
      this.masterGainNode.connect(this.context.destination);
    }
    
    return this.context;
  }

  /**
   * Get the master gain node
   * @returns {GainNode} The master gain node
   */
  getMasterGain() {
    if (!this.masterGainNode) {
      this.getContext(); // Ensures context and gain node are created
    }
    return this.masterGainNode;
  }

  /**
   * Unlock audio context for iOS/mobile compatibility
   * Must be called from a user gesture event
   * @returns {Promise<void>}
   */
  async unlock() {
    if (this.isUnlocked) {
      return;
    }

    const ctx = this.getContext();
    
    if (ctx.state === 'suspended') {
      try {
        // Create a silent buffer to play
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        
        // Play the silent buffer
        source.start(0);
        
        // Resume the context
        await ctx.resume();
        
        this.isUnlocked = true;
        console.log('[AudioContextPool] Audio context unlocked');
      } catch (error) {
        console.error('[AudioContextPool] Failed to unlock audio context:', error);
        throw error;
      }
    } else {
      this.isUnlocked = true;
    }
  }

  /**
   * Get the current state of the audio context
   * @returns {string|null} The audio context state or null if not created
   */
  getState() {
    return this.context ? this.context.state : null;
  }

  /**
   * Resume a suspended audio context
   * @returns {Promise<void>}
   */
  async resume() {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }
}

// Export singleton instance
export const audioContextPool = new AudioContextPool();