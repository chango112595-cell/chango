import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface AudioRecordingState {
  isRecording: boolean;
  hasRecording: boolean;
  duration: number;
  status: string;
}

export function useAudioRecording() {
  const [state, setState] = useState<AudioRecordingState>({
    isRecording: false,
    hasRecording: false,
    duration: 0,
    status: "Ready to record voice sample",
  });

  const { toast } = useToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioBlobRef.current = audioBlob;
        
        setState(prev => ({ 
          ...prev, 
          isRecording: false, 
          hasRecording: true,
          status: `Recording complete (${audioBlob.size} bytes)`
        }));

        // Stop all tracks to release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      
      setState(prev => ({ 
        ...prev, 
        isRecording: true, 
        hasRecording: false,
        status: "Recording... (release to stop)"
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      setState(prev => ({ 
        ...prev, 
        status: `Microphone error: ${errorMessage}`
      }));
      
      toast({
        title: "Recording Failed",
        description: `Could not access microphone: ${errorMessage}`,
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      
      setState(prev => ({ 
        ...prev, 
        status: "Processing recording..."
      }));
    }
  }, [state.isRecording]);

  const clearRecording = useCallback(() => {
    audioBlobRef.current = null;
    audioChunksRef.current = [];
    
    setState(prev => ({ 
      ...prev, 
      hasRecording: false,
      status: "Ready to record voice sample"
    }));
  }, []);

  return {
    ...state,
    audioBlob: audioBlobRef.current,
    startRecording,
    stopRecording,
    clearRecording,
  };
}
