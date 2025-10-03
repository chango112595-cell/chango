/**
 * useVoiceprint Hook
 * Manages voice enrollment, verification, and security preferences
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { voiceprintEngine, VoiceprintData, EnrollmentResult, MatchResult } from '../voice/security/voiceprint';
import { voiceSecurityStore, VoiceSecuritySettings } from '../state/voiceSecurity';
import { useToast } from '@/hooks/use-toast';

export interface UseVoiceprintReturn {
  // State
  isEnrolling: boolean;
  isVerifying: boolean;
  enrollmentProgress: number;
  voiceprints: VoiceprintData[];
  activeVoiceprint: VoiceprintData | null;
  settings: VoiceSecuritySettings;
  lastMatch: MatchResult | null;
  
  // Actions
  startEnrollment: () => Promise<void>;
  cancelEnrollment: () => void;
  verifyVoice: (audioBuffer: Float32Array) => Promise<MatchResult>;
  deleteVoiceprint: (id: string) => void;
  setActiveVoiceprint: (id: string | null) => void;
  updateSettings: (settings: Partial<VoiceSecuritySettings>) => void;
  clearAllVoiceprints: () => void;
}

export function useVoiceprint(): UseVoiceprintReturn {
  const { toast } = useToast();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [enrollmentProgress, setEnrollmentProgress] = useState(0);
  const [voiceprints, setVoiceprints] = useState<VoiceprintData[]>([]);
  const [activeVoiceprint, setActiveVoiceprintState] = useState<VoiceprintData | null>(null);
  const [settings, setSettings] = useState<VoiceSecuritySettings>(voiceSecurityStore.getSettings());
  const [lastMatch, setLastMatch] = useState<MatchResult | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const enrollmentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = voiceSecurityStore.subscribe((state) => {
      setVoiceprints(state.voiceprints);
      setSettings(state.settings);
      setActiveVoiceprintState(voiceSecurityStore.getActiveVoiceprint());
    });

    // Load initial state
    const initialState = voiceSecurityStore.getState();
    setVoiceprints(initialState.voiceprints);
    setActiveVoiceprintState(voiceSecurityStore.getActiveVoiceprint());

    return unsubscribe;
  }, []);

  /**
   * Start voice enrollment (7-second recording)
   */
  const startEnrollment = useCallback(async () => {
    if (isEnrolling) {
      console.warn('[useVoiceprint] Enrollment already in progress');
      return;
    }

    try {
      setIsEnrolling(true);
      setEnrollmentProgress(0);
      audioChunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // Disable for better biometric capture
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000
        }
      });
      streamRef.current = stream;

      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        try {
          // Convert recorded audio to Float32Array
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioContext = new AudioContext({ sampleRate: 16000 });
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Get mono channel data
          const channelData = audioBuffer.getChannelData(0);
          
          // Enroll voiceprint
          const result: EnrollmentResult = await voiceprintEngine.enroll(channelData, audioBuffer.sampleRate);
          
          if (result.success && result.voiceprint) {
            // Save to store
            voiceSecurityStore.addVoiceprint(result.voiceprint);
            voiceSecurityStore.setActiveVoiceprint(result.voiceprint.id);
            
            toast({
              title: "Voice Enrolled",
              description: "Your voiceprint has been successfully enrolled.",
            });
            
            console.log('[useVoiceprint] Enrollment successful:', result.voiceprint.id);
          } else {
            throw new Error(result.error || 'Enrollment failed');
          }
          
          // Cleanup
          audioContext.close();
        } catch (error) {
          console.error('[useVoiceprint] Enrollment processing error:', error);
          toast({
            title: "Enrollment Failed",
            description: error instanceof Error ? error.message : "Failed to process voice recording",
            variant: "destructive"
          });
        } finally {
          setIsEnrolling(false);
          setEnrollmentProgress(0);
          
          // Stop all tracks
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        }
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      
      console.log('[useVoiceprint] Started enrollment recording');
      
      // Update progress
      const startTime = Date.now();
      const enrollmentDuration = voiceprintEngine.getEnrollmentDuration();
      
      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / enrollmentDuration) * 100, 100);
        setEnrollmentProgress(progress);
        
        if (progress >= 100) {
          // Stop recording after 7 seconds
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          if (enrollmentTimerRef.current) {
            clearInterval(enrollmentTimerRef.current);
            enrollmentTimerRef.current = null;
          }
        }
      };
      
      enrollmentTimerRef.current = setInterval(updateProgress, 100);
      
    } catch (error) {
      console.error('[useVoiceprint] Failed to start enrollment:', error);
      toast({
        title: "Enrollment Error",
        description: error instanceof Error ? error.message : "Failed to access microphone",
        variant: "destructive"
      });
      
      setIsEnrolling(false);
      setEnrollmentProgress(0);
      
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [isEnrolling, toast]);

  /**
   * Cancel ongoing enrollment
   */
  const cancelEnrollment = useCallback(() => {
    if (!isEnrolling) return;
    
    // Stop recording
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Clear timer
    if (enrollmentTimerRef.current) {
      clearInterval(enrollmentTimerRef.current);
      enrollmentTimerRef.current = null;
    }
    
    // Stop tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsEnrolling(false);
    setEnrollmentProgress(0);
    audioChunksRef.current = [];
    
    console.log('[useVoiceprint] Enrollment cancelled');
  }, [isEnrolling]);

  /**
   * Verify voice against active voiceprint
   */
  const verifyVoice = useCallback(async (audioBuffer: Float32Array): Promise<MatchResult> => {
    if (!activeVoiceprint) {
      const result: MatchResult = {
        match: false,
        similarity: 0,
        threshold: settings.matchThreshold
      };
      setLastMatch(result);
      return result;
    }
    
    setIsVerifying(true);
    
    try {
      const result = await voiceprintEngine.verify(
        audioBuffer,
        activeVoiceprint,
        settings.matchThreshold
      );
      
      setLastMatch(result);
      voiceSecurityStore.recordVerification(result.match, result.similarity);
      
      console.log('[useVoiceprint] Verification result:', result);
      
      return result;
    } catch (error) {
      console.error('[useVoiceprint] Verification error:', error);
      const errorResult: MatchResult = {
        match: false,
        similarity: 0,
        threshold: settings.matchThreshold
      };
      setLastMatch(errorResult);
      return errorResult;
    } finally {
      setIsVerifying(false);
    }
  }, [activeVoiceprint, settings.matchThreshold]);

  /**
   * Delete voiceprint
   */
  const deleteVoiceprint = useCallback((id: string) => {
    voiceSecurityStore.removeVoiceprint(id);
    toast({
      title: "Voiceprint Deleted",
      description: "The voiceprint has been removed.",
    });
  }, [toast]);

  /**
   * Set active voiceprint
   */
  const setActiveVoiceprint = useCallback((id: string | null) => {
    voiceSecurityStore.setActiveVoiceprint(id);
  }, []);

  /**
   * Update security settings
   */
  const updateSettings = useCallback((newSettings: Partial<VoiceSecuritySettings>) => {
    voiceSecurityStore.updateSettings(newSettings);
  }, []);

  /**
   * Clear all voiceprints
   */
  const clearAllVoiceprints = useCallback(() => {
    voiceSecurityStore.clearAllVoiceprints();
    toast({
      title: "All Voiceprints Cleared",
      description: "All voice enrollments have been removed.",
    });
  }, [toast]);

  return {
    isEnrolling,
    isVerifying,
    enrollmentProgress,
    voiceprints,
    activeVoiceprint,
    settings,
    lastMatch,
    startEnrollment,
    cancelEnrollment,
    verifyVoice,
    deleteVoiceprint,
    setActiveVoiceprint,
    updateSettings,
    clearAllVoiceprints
  };
}