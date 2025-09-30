/**
 * Voice Controller Singleton
 * Centralized management of all voice-related resources
 * Prevents duplicate getUserMedia calls and stack overflow issues
 */

type VoiceMode = 'ACTIVE' | 'MUTED' | 'KILLED';

interface VoiceControllerState {
  mode: VoiceMode;
  isListening: boolean;
  isSpeaking: boolean;
}

class VoiceController {
  private mode: VoiceMode = 'ACTIVE';
  private mediaStream: MediaStream | null = null;
  private isListeningFlag = false;
  private isSpeakingFlag = false;
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
    try {
      this.log('Requesting microphone access...');
      
      // Request microphone with optimized settings
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });
      
      this.isListeningFlag = true;
      this.log('Microphone access granted, stream active');
      
      // Set up audio analysis
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
      }
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser!);
      
      // Notify listeners
      this.notifyListeners();
      
      // Send audit log
      await this.audit('LISTENING_STARTED', { mode: this.mode });
      
    } catch (error) {
      this.log(`Failed to start listening: ${error}`, 'error');
      this.isListeningFlag = false;
      this.mediaStream = null;
      this.notifyListeners();
      throw error;
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
      // Stop listening while speaking to prevent feedback
      if (this.isListeningFlag) {
        this.stopListening();
      }
    } else {
      // Resume listening after speaking if in ACTIVE mode
      if (this.mode === 'ACTIVE' && !this.isListeningFlag) {
        this.startListening().catch(err => {
          this.log(`Failed to resume listening: ${err}`, 'error');
        });
      }
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
    this.mode = this.mode === 'MUTED' ? 'ACTIVE' : 'MUTED';
    
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
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.isSpeakingFlag;
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