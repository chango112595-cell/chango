/**
 * Voice Controls Component
 * ========================
 * 
 * @module components/VoiceControls
 * @description UI controls for voice system management
 * 
 * **Responsibilities:**
 * - Display voice system status (listening, speaking, permission)
 * - Provide controls to start/stop voice recognition
 * - Handle permission requests and errors
 * - Display diagnostic information and recovery options
 * 
 * **Module Boundary:**
 * Pure UI component that delegates to voice system services.
 * Should not contain voice processing logic, only UI state
 * and service orchestration.
 * 
 * **Dependencies:**
 * - Voice services: alwaysListen, voiceBus
 * - Bootstrap functions: permission and status queries
 * - UI components: Button, Card, Alert from shadcn
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { voiceBus } from "@/voice/voiceBus";
import { alwaysListen } from "@/voice/always_listen";
import { requestMicrophonePermission, getLoloStatus } from "@/app/bootstrap";
import { Mic, MicOff, Volume2, Power, AlertTriangle, RefreshCcw, Loader2 } from "lucide-react";

export default function VoiceControls() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [listeningPulse, setListeningPulse] = useState(false);
  const [sttStatus, setSttStatus] = useState<any>({});
  const [isRecovering, setIsRecovering] = useState(false);

  // Request microphone permission
  const handleRequestPermission = async () => {
    setIsInitializing(true);
    try {
      const granted = await requestMicrophonePermission();
      setMicPermission(granted ? 'granted' : 'denied');
      console.log('[VoiceControls] Microphone permission:', granted ? 'granted' : 'denied');
    } catch (error) {
      console.error('[VoiceControls] Failed to get microphone permission:', error);
      setMicPermission('denied');
    } finally {
      setIsInitializing(false);
    }
  };

  // Toggle listening on/off
  const toggleListening = () => {
    if (isListening) {
      alwaysListen.stop();
      setIsListening(false);
      console.log('[VoiceControls] Stopped listening');
    } else {
      alwaysListen.start().then(() => {
        setIsListening(true);
        console.log('[VoiceControls] Started listening');
      }).catch((error) => {
        console.error('[VoiceControls] Failed to start listening:', error);
      });
    }
  };
  
  // Handle manual recovery
  const handleForceRestart = async () => {
    setIsRecovering(true);
    console.log('[VoiceControls] Initiating force restart...');
    
    try {
      // Force restart the STT system
      await alwaysListen.forceRestart();
      console.log('[VoiceControls] Force restart successful');
      
      // Try to start listening if permission is granted
      const status = alwaysListen.getStatus();
      if (status.hasPermission && !status.isListening) {
        await alwaysListen.start();
      }
      
      // Clear any error messages
      setSttStatus(alwaysListen.getStatus());
    } catch (error) {
      console.error('[VoiceControls] Force restart failed:', error);
    } finally {
      setIsRecovering(false);
    }
  };

  // Setup event listeners
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    // Listen for speech recognition events
    unsubscribers.push(
      voiceBus.on('userSpeechRecognized', (event) => {
        if (event.text) {
          setLastTranscript(event.text);
          setListeningPulse(true);
          setTimeout(() => setListeningPulse(false), 500);
        }
      })
    );

    // Listen for speaking state changes
    unsubscribers.push(
      voiceBus.on('speakingChange', (event) => {
        setIsSpeaking(event.speaking || false);
      })
    );

    // Check status periodically
    const statusInterval = setInterval(() => {
      const status = alwaysListen.getStatus();
      setIsListening(status.isListening);
      setMicPermission(status.hasPermission ? 'granted' : 'prompt');
      setSttStatus(status);
      
      // Also check overall Lolo status
      const loloStatus = getLoloStatus();
      setIsSpeaking(window.speechSynthesis?.speaking || false);
    }, 1000);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      clearInterval(statusInterval);
    };
  }, []);

  // Test TTS
  const testTTS = () => {
    voiceBus.emitSpeak("Hello! I'm Lolo and I'm always listening. Just speak naturally and I'll respond.");
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Voice Controls</span>
          {micPermission === 'granted' && (
            <Button
              variant={isListening ? "default" : "outline"}
              size="sm"
              onClick={toggleListening}
              data-testid="button-voice-toggle"
            >
              {isListening ? (
                <><Mic className="h-4 w-4 mr-1" /> ON</>
              ) : (
                <><MicOff className="h-4 w-4 mr-1" /> OFF</>
              )}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Microphone Permission Status */}
        <Alert>
          <AlertDescription className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Microphone Status
            </span>
            {micPermission === 'granted' ? (
              <span className="font-semibold text-green-600">Ready</span>
            ) : micPermission === 'denied' ? (
              <span className="font-semibold text-red-600">Denied</span>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleRequestPermission}
                disabled={isInitializing}
                data-testid="button-request-permission"
              >
                {isInitializing ? 'Requesting...' : 'Enable Microphone'}
              </Button>
            )}
          </AlertDescription>
        </Alert>

        {/* Listening Status */}
        <div className="flex items-center justify-between">
          <Label>Status</Label>
          <div className="flex items-center gap-3">
            {isListening ? (
              <div className="flex items-center gap-2">
                <div className={`relative ${listeningPulse ? 'animate-pulse' : ''}`}>
                  <Mic className="h-5 w-5 text-green-600" />
                  {listeningPulse && (
                    <div className="absolute inset-0 rounded-full bg-green-600 opacity-50 animate-ping" />
                  )}
                </div>
                <span className="text-sm text-green-600 font-medium">Always Listening</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MicOff className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-400">Not Listening</span>
              </div>
            )}
            {isSpeaking && (
              <div className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-blue-600 animate-pulse" />
                <span className="text-sm text-blue-600 font-medium">Speaking</span>
              </div>
            )}
          </div>
        </div>

        {/* Last Transcript */}
        {lastTranscript && (
          <div className="p-3 bg-secondary rounded-lg">
            <Label className="text-xs text-muted-foreground">Last Heard:</Label>
            <p className="text-sm mt-1" data-testid="text-last-transcript">
              "{lastTranscript}"
            </p>
          </div>
        )}

        {/* Test Button */}
        <div className="flex gap-2">
          <Button
            onClick={testTTS}
            variant="secondary"
            size="sm"
            disabled={isSpeaking}
            data-testid="button-test-tts"
          >
            <Volume2 className="h-4 w-4 mr-1" />
            Test Speech
          </Button>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Lolo is always listening - no wake word needed</p>
          <p>• Just speak naturally and Lolo will respond</p>
          <p>• Listening pauses when tab is hidden</p>
        </div>

        {/* Error Status Display */}
        {sttStatus.state === 'error' && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Speech Recognition Error</AlertTitle>
            <AlertDescription>
              <div className="space-y-2">
                {sttStatus.microphoneMuted && (
                  <p className="font-semibold">🔇 Microphone is muted - please unmute to use voice commands</p>
                )}
                {sttStatus.errorMessage && (
                  <p className="text-sm">{sttStatus.errorMessage}</p>
                )}
                {sttStatus.isPausedForRecovery && (
                  <div className="bg-red-900/20 p-2 rounded mt-2">
                    <p className="font-semibold">⚠️ STT Paused - Manual recovery needed</p>
                    <p className="text-xs mt-1">
                      {sttStatus.consecutiveFailures} consecutive failures detected
                    </p>
                  </div>
                )}
                {sttStatus.consecutiveFailures > 0 && !sttStatus.isPausedForRecovery && (
                  <p className="text-xs text-muted-foreground">
                    Retry #{sttStatus.consecutiveFailures} - Next retry in {Math.round(sttStatus.currentRetryDelay / 1000)}s
                  </p>
                )}
              </div>
              
              {/* Recovery Button */}
              <Button
                onClick={handleForceRestart}
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={isRecovering}
                data-testid="button-force-restart"
              >
                {isRecovering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recovering...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Force Restart STT
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Debug Info */}
        {sttStatus.state && import.meta.env.DEV && (
          <div className="mt-4 p-3 bg-secondary/50 rounded-lg text-xs space-y-1">
            <p>STT State: <span className="font-mono">{sttStatus.state}</span></p>
            <p>Consecutive Failures: <span className="font-mono">{sttStatus.consecutiveFailures || 0}/10</span></p>
            <p>Current Retry Delay: <span className="font-mono">{sttStatus.currentRetryDelay || 500}ms</span></p>
            <p>Microphone: {sttStatus.microphoneMuted ? '🔇 Muted' : sttStatus.microphoneAvailable ? '✅ Available' : '❌ Not available'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}