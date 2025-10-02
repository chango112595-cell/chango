import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { voiceBus } from "@/voice/voiceBus";
import { alwaysListen } from "@/voice/always_listen";
import { requestMicrophonePermission, getChangoStatus } from "@/app/bootstrap";
import { Mic, MicOff, Volume2, Power } from "lucide-react";

export default function VoiceControls() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [listeningPulse, setListeningPulse] = useState(false);

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
      
      // Also check overall Chango status
      const changoStatus = getChangoStatus();
      setIsSpeaking(window.speechSynthesis?.speaking || false);
    }, 1000);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      clearInterval(statusInterval);
    };
  }, []);

  // Test TTS
  const testTTS = () => {
    voiceBus.emitSpeak("Hello! I'm Chango and I'm always listening. Just speak naturally and I'll respond.");
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
          <p>• Chango is always listening - no wake word needed</p>
          <p>• Just speak naturally and Chango will respond</p>
          <p>• Listening pauses when tab is hidden</p>
        </div>
      </CardContent>
    </Card>
  );
}