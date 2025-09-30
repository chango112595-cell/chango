/**
 * Voice Controller Singleton
 * Centralized management of all voice-related resources
 * Prevents duplicate getUserMedia calls and stack overflow issues
 */

type VoiceMode = 'ACTIVE' | 'MUTED' | 'KILLED' | 'WAKE';

interface VoiceControllerState {
  mode: VoiceMode;
  isListening: boolean;
  isSpeaking: boolean;
}

class VoiceController {
  private mode: VoiceMode = 'WAKE';  // Default to WAKE mode
  private mediaStream: MediaStream | null = null;
  private isListeningFlag = false;
  private isSpeakingFlag = false;
  private speakingNow = false;  // Hard-gate flag for TTS speaking
  private rearmTimer: NodeJS.Timeout | null = null;  // Timer for re-enabling after TTS
  private wakeWindowUntil = 0;  // Timestamp for when ACTIVE window expires
  private killPassphrase = '';
  private recognizer: any = null;
  private listeners: Set<(state: VoiceControllerState) => void> = new Set();
  private initPromise: Promise<void> | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  constructor() {
    // Bind methods to ensure correct context
    this.startListening = this.startListening.bind(this);
    this.stopListening = this.stopListening.bind(this);
    this.speaking = this.speaking.bind(this);
    this.toggleMute = this.toggleMute.bind(this);
    this.kill = this.kill.bind(this);
    this.revive = this.revive.bind(this);
    
    // Log initialization
    this.log('Voice Controller initialized');
  }

  /**
   * Start listening - manages single media stream
   * Prevents duplicate getUserMedia calls
   */
  async startListening(): Promise<void> {
    // Prevent duplicate calls
    if (this.mediaStream || this.mode === 'KILLED' || this.mode === 'MUTED') {
      this.log(`startListening blocked: stream=${!!this.mediaStream}, mode=${this.mode}`);
      return;
    }

    // If already initializing, wait for it
    if (this.initPromise) {
      this.log('startListening waiting for existing init');
      await this.initPromise;
      return;
    }

    // Start initialization
    this.initPromise = this._initializeListening();
    
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async _initializeListening(): Promise<void> {
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        this.log(`Requesting microphone access... (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Request microphone with optimized settings
        // Start with simpler constraints and then try more advanced ones
        const constraints = retryCount === 0 ? {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000
          }
        } : {
          audio: true // Fallback to simplest constraint
        };
        
        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Verify stream has audio tracks
        const audioTracks = this.mediaStream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error('No audio tracks in stream');
        }
        
        this.isListeningFlag = true;
        this.log(`Microphone access granted, stream active with ${audioTracks.length} audio track(s)`);
        
        // Set up audio analysis (but make it optional - don't fail if it can't be created)
        try {
          if (!this.audioContext) {
            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
          }
          
          const source = this.audioContext.createMediaStreamSource(this.mediaStream);
          source.connect(this.analyser!);
        } catch (audioCtxError) {
          this.log(`Audio context setup failed (non-critical): ${audioCtxError}`, 'warn');
          // Continue anyway - the basic stream is working
        }
        
        // Notify listeners
        this.notifyListeners();
        
        // Send audit log
        await this.audit('LISTENING_STARTED', { mode: this.mode });
        
        // Success - exit the retry loop
        return;
        
      } catch (error: any) {
        retryCount++;
        this.log(`Failed to start listening (attempt ${retryCount}/${maxRetries}): ${error}`, 'error');
        
        // Clean up any partial state
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop());
          this.mediaStream = null;
        }
        this.isListeningFlag = false;
        
        // Check specific error types
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          this.log('Microphone permission denied by user', 'error');
          this.notifyListeners();
          throw new Error('Microphone permission denied. Please allow microphone access and try again.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          this.log('No microphone found', 'error');
          this.notifyListeners();
          throw new Error('No microphone found. Please connect a microphone and try again.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          this.log('Microphone is in use or blocked', 'warn');
          // Wait a bit before retrying
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        
        // If we've exhausted retries, throw the error
        if (retryCount >= maxRetries) {
          this.notifyListeners();
          throw error;
        }
      }
    }
  }

  /**
   * Stop listening and release resources
   */
  stopListening(): void {
    if (!this.mediaStream) {
      this.log('stopListening: no active stream');
      return;
    }

    this.log('Stopping listening, releasing resources');
    
    // Stop all tracks
    this.mediaStream.getTracks().forEach(track => {
      track.stop();
      this.log(`Stopped track: ${track.kind}`);
    });
    
    this.mediaStream = null;
    this.isListeningFlag = false;
    
    // Notify listeners
    this.notifyListeners();
    
    // Send audit log
    this.audit('LISTENING_STOPPED', { mode: this.mode });
  }

  /**
   * Update speaking state
   * Manages coordination between speaking and listening
   */
  speaking(isSpeaking: boolean): void {
    const wasListening = this.isListeningFlag;
    
    this.isSpeakingFlag = isSpeaking;
    this.log(`Speaking state: ${isSpeaking}, mode: ${this.mode}`);
    
    if (isSpeaking) {
      // Set speakingNow flag immediately when speaking starts
      this.speakingNow = true;
      
      // Clear any pending rearm timer
      if (this.rearmTimer) {
        clearTimeout(this.rearmTimer);
        this.rearmTimer = null;
      }
      
      // Stop listening while speaking to prevent feedback
      if (this.isListeningFlag) {
        this.log('Stopping listening due to TTS speaking');
        this.stopListening();
      }
    } else {
      // Speaking ended - clear flag after a short cooldown
      // Clear any existing timer first
      if (this.rearmTimer) {
        clearTimeout(this.rearmTimer);
      }
      
      // Immediately set speakingNow to false but with a short delay to avoid capturing tail of TTS
      this.rearmTimer = setTimeout(() => {
        this.speakingNow = false;  // Clear hard-gate after cooldown
        this.log('Speaking ended, hard-gate cleared');
        
        // Resume listening after speaking if in ACTIVE mode or open wake window
        if ((this.mode === 'ACTIVE' || (this.mode === 'WAKE' && Date.now() < this.wakeWindowUntil)) && !this.isListeningFlag) {
          this.log('Re-enabling listening after TTS cooldown');
          this.startListening().catch(err => {
            this.log(`Failed to resume listening: ${err}`, 'error');
          });
        }
        this.rearmTimer = null;
      }, 300);  // Reduced to 300ms cooldown for faster response
    }
    
    // Notify listeners
    this.notifyListeners();
    
    // Send audit log
    this.audit('SPEAKING_STATE', { 
      isSpeaking, 
      wasListening,
      mode: this.mode 
    });
  }

  /**
   * Toggle between ACTIVE and MUTED states
   */
  toggleMute(): void {
    if (this.mode === 'KILLED') {
      this.log('Cannot toggle mute - system is KILLED');
      return;
    }

    const previousMode = this.mode;
    // Toggle between ACTIVE/WAKE and MUTED
    if (this.mode === 'MUTED') {
      this.mode = 'WAKE'; // Default back to WAKE mode
    } else {
      this.mode = 'MUTED';
    }
    
    this.log(`Mode changed: ${previousMode} -> ${this.mode}`);
    
    if (this.mode === 'MUTED') {
      // Stop listening when muted
      this.stopListening();
    } else if (!this.isSpeakingFlag) {
      // Start listening when unmuted (if not speaking)
      this.startListening().catch(err => {
        this.log(`Failed to start listening after unmute: ${err}`, 'error');
      });
    }
    
    // Notify listeners
    this.notifyListeners();
    
    // Send audit log
    this.audit('MODE_CHANGE', { 
      from: previousMode, 
      to: this.mode 
    });
  }

  /**
   * Kill the voice system with passphrase protection
   */
  kill(): string {
    this.killPassphrase = Math.random().toString(36).substring(7);
    this.mode = 'KILLED';
    this.stopListening();
    
    this.log(`System KILLED. Passphrase: ${this.killPassphrase}`, 'warn');
    
    // Notify listeners
    this.notifyListeners();
    
    // Send audit log
    this.audit('SYSTEM_KILLED', { 
      timestamp: new Date().toISOString() 
    });
    
    return this.killPassphrase;
  }

  /**
   * Revive the killed system with correct passphrase
   */
  async revive(passphrase: string): Promise<void> {
    if (this.mode !== 'KILLED') {
      throw new Error('System is not killed');
    }
    
    if (passphrase !== this.killPassphrase) {
      this.log(`Invalid passphrase attempt`, 'error');
      throw new Error('Invalid passphrase');
    }
    
    this.mode = 'ACTIVE';
    this.killPassphrase = '';
    
    this.log('System REVIVED successfully');
    
    // Start listening again
    await this.startListening();
    
    // Notify listeners
    this.notifyListeners();
    
    // Send audit log
    this.audit('SYSTEM_REVIVED', { 
      timestamp: new Date().toISOString() 
    });
  }

  /**
   * Get current mode
   */
  getMode(): VoiceMode {
    return this.mode;
  }

  /**
   * Check if currently listening
   */
  isListening(): boolean {
    return this.isListeningFlag;
  }

  /**
   * Check if currently speaking (hard-gate flag)
   */
  isSpeaking(): boolean {
    return this.speakingNow;
  }
  
  /**
   * Open a wake window for ACTIVE mode (10 seconds default)
   */
  openWakeWindow(ms: number = 10000): void {
    this.wakeWindowUntil = Date.now() + ms;
    
    if (this.mode === 'WAKE') {
      this.log(`Wake window opened for ${ms}ms, temporarily enabling ACTIVE mode`);
      // Temporarily activate mode
      this.setMode('ACTIVE');
      
      // Set timer to return to WAKE mode
      setTimeout(() => {
        if (this.mode === 'ACTIVE' && Date.now() >= this.wakeWindowUntil) {
          this.log('Wake window expired, returning to WAKE mode');
          this.setMode('WAKE');
        }
      }, ms);
    }
  }
  
  /**
   * Wake word was heard
   */
  wakeWordHeard(): void {
    this.log('Wake word detected!');
    this.openWakeWindow();
  }
  
  /**
   * Check if input should be ignored
   */
  shouldIgnoreInput(): boolean {
    // Ignore if killed, muted, or speaking
    if (this.mode === 'KILLED' || this.mode === 'MUTED' || this.speakingNow) {
      return true;
    }
    
    // In WAKE mode, check if window is active
    if (this.mode === 'WAKE' && Date.now() >= this.wakeWindowUntil) {
      return true;
    }
    
    // In ACTIVE mode with expired window, return to WAKE
    if (this.mode === 'ACTIVE' && this.wakeWindowUntil > 0 && Date.now() >= this.wakeWindowUntil) {
      this.log('Active window expired, returning to WAKE mode');
      this.setMode('WAKE');
      return true;
    }
    
    return false;
  }
  
  /**
   * Set mode directly (with notification)
   */
  setMode(mode: VoiceMode): void {
    const previousMode = this.mode;
    this.mode = mode;
    
    this.log(`Mode changed: ${previousMode} -> ${mode}`);
    
    // Handle mode-specific actions
    if (mode === 'MUTED' || mode === 'KILLED') {
      this.stopListening();
    } else if (mode === 'ACTIVE' && !this.speakingNow) {
      this.startListening().catch(err => {
        this.log(`Failed to start listening after mode change: ${err}`, 'error');
      });
    }
    
    // Notify listeners
    this.notifyListeners();
    
    // Send audit log
    this.audit('MODE_CHANGE', {
      from: previousMode,
      to: mode
    });
  }

  /**
   * Get current state
   */
  getState(): VoiceControllerState {
    return {
      mode: this.mode,
      isListening: this.isListeningFlag,
      isSpeaking: this.isSpeakingFlag
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: VoiceControllerState) => void): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (err) {
        console.error('Voice Controller listener error:', err);
      }
    });
  }

  /**
   * Get the current media stream (for integration with recognizers)
   */
  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  /**
   * Get audio analyser for visualization
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Reset the system (for debugging)
   */
  async reset(): Promise<void> {
    this.log('Resetting Voice Controller');
    this.stopListening();
    this.mode = 'ACTIVE';
    this.killPassphrase = '';
    this.isSpeakingFlag = false;
    await this.startListening();
  }

  /**
   * Internal logging
   */
  private log(message: string, level: 'log' | 'warn' | 'error' = 'log'): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[VoiceController ${timestamp}] ${message}`;
    console[level](logMessage);
  }

  /**
   * Send audit log to server
   */
  private async audit(event: string, data: any = {}): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        event,
        data,
        state: this.getState()
      };
      
      // Send to server
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      });
    } catch (err) {
      console.error('Failed to send audit log:', err);
    }
  }
}

// Export singleton instance
export const Voice = new VoiceController();

// Export type
export type { VoiceMode, VoiceControllerState };