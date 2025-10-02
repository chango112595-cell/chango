import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { voiceController } from "@/voice/voiceController";
import { voiceBus } from "@/voice/voiceBus";
import { sttService } from "@/voice/stt/sttService";
import { wakeWordDetector } from "@/voice/wakeWord";
import { Voice } from "@/lib/voiceController";
import { Mic, MicOff, Volume2, VolumeX, Power, Zap, Shield } from "lucide-react";

export default function VoiceControls() {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mode, setMode] = useState<'WAKE' | 'ACTIVE' | 'MUTED'>('WAKE');
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [listeningPulse, setListeningPulse] = useState(false);

  // Initialize voice system
  const initializeVoice = async () => {
    setIsInitializing(true);
    try {
      // Initialize voice controller
      await voiceController.initialize({
        autoStart: true,
        wakeWordEnabled: wakeWordEnabled,
        mode: mode
      });
      
      setVoiceEnabled(true);
      setMicPermission('granted');
      console.log('[VoiceControls] Voice system initialized');
    } catch (error) {
      console.error('[VoiceControls] Failed to initialize voice:', error);
      setMicPermission('denied');
    } finally {
      setIsInitializing(false);
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

    // Listen for Voice controller state
    unsubscribers.push(
      Voice.subscribe((state) => {
        setIsListening(state.isListening);
        setIsSpeaking(state.isSpeaking);
        if (state.mode === 'WAKE' || state.mode === 'ACTIVE' || state.mode === 'MUTED') {
          setMode(state.mode as 'WAKE' | 'ACTIVE' | 'MUTED');
        }
      })
    );

    // Check STT status periodically
    const statusInterval = setInterval(() => {
      const status = sttService.getStatus();
      setIsListening(status.isListening);
    }, 1000);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      clearInterval(statusInterval);
    };
  }, []);

  // Toggle voice on/off
  const toggleVoice = async () => {
    if (voiceEnabled) {
      // Disable voice
      voiceController.stopSTT();
      wakeWordDetector.disable();
      setVoiceEnabled(false);
      console.log('[VoiceControls] Voice disabled');
    } else {
      // Enable voice
      await initializeVoice();
    }
  };

  // Toggle mode
  const toggleMode = () => {
    const nextMode = mode === 'WAKE' ? 'ACTIVE' : mode === 'ACTIVE' ? 'MUTED' : 'WAKE';
    setMode(nextMode);
    voiceController.setMode(nextMode);
    console.log(`[VoiceControls] Mode changed to ${nextMode}`);
  };

  // Toggle wake word
  const toggleWakeWord = () => {
    if (wakeWordEnabled) {
      voiceController.disableWakeWord();
      setWakeWordEnabled(false);
    } else {
      voiceController.enableWakeWord();
      setWakeWordEnabled(true);
    }
    console.log(`[VoiceControls] Wake word ${wakeWordEnabled ? 'disabled' : 'enabled'}`);
  };

  // Test TTS
  const testTTS = () => {
    voiceBus.emitSpeak("Hello! I am Chango, your voice assistant. I'm listening for your commands.");
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Voice Controls</span>
          <Button
            variant={voiceEnabled ? "default" : "outline"}
            size="sm"
            onClick={toggleVoice}
            disabled={isInitializing}
            data-testid="button-voice-toggle"
          >
            {isInitializing ? (
              <>Initializing...</>
            ) : voiceEnabled ? (
              <><Power className="h-4 w-4 mr-1" /> ON</>
            ) : (
              <><Power className="h-4 w-4 mr-1" /> OFF</>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Microphone Permission Status */}
        <Alert>
          <AlertDescription className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Microphone Permission
            </span>
            <span className={`font-semibold ${
              micPermission === 'granted' ? 'text-green-600' : 
              micPermission === 'denied' ? 'text-red-600' : 
              'text-yellow-600'
            }`}>
              {micPermission === 'granted' ? 'Granted' : 
               micPermission === 'denied' ? 'Denied' : 
               'Not Requested'}
            </span>
          </AlertDescription>
        </Alert>

        {/* Voice Mode */}
        <div className="flex items-center justify-between">
          <Label>Voice Mode</Label>
          <div className="flex items-center gap-2">
            <Button
              variant={mode === 'WAKE' ? "secondary" : mode === 'ACTIVE' ? "default" : "outline"}
              size="sm"
              onClick={toggleMode}
              disabled={!voiceEnabled}
              data-testid="button-mode-toggle"
            >
              {mode === 'WAKE' ? (
                <><Shield className="h-4 w-4 mr-1" /> Wake Word</>
              ) : mode === 'ACTIVE' ? (
                <><Zap className="h-4 w-4 mr-1" /> Active</>
              ) : (
                <><VolumeX className="h-4 w-4 mr-1" /> Muted</>
              )}
            </Button>
          </div>
        </div>

        {/* Wake Word Control */}
        <div className="flex items-center justify-between">
          <Label htmlFor="wake-word" className="flex items-center gap-2">
            Wake Word Detection
            {mode === 'WAKE' && wakeWordEnabled && (
              <span className="text-xs text-muted-foreground">Say "Hey Chango"</span>
            )}
          </Label>
          <Switch
            id="wake-word"
            checked={wakeWordEnabled}
            onCheckedChange={toggleWakeWord}
            disabled={!voiceEnabled || mode !== 'WAKE'}
            data-testid="switch-wake-word"
          />
        </div>

        {/* Listening Indicator */}
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
                <span className="text-sm text-green-600 font-medium">Listening</span>
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
            disabled={!voiceEnabled || isSpeaking}
            data-testid="button-test-tts"
          >
            <Volume2 className="h-4 w-4 mr-1" />
            Test Speech
          </Button>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• In WAKE mode, say "Hey Chango" to activate</p>
          <p>• In ACTIVE mode, all speech is processed</p>
          <p>• STT pauses during TTS to prevent feedback</p>
        </div>
      </CardContent>
    </Card>
  );
}