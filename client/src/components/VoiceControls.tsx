import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";
import { useVAD } from "@/hooks/useVAD";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

export default function VoiceControls() {
  const { 
    isEnabled, 
    isPlaying, 
    isMuted,
    requiresHumanSpeech,
    enable, 
    disable, 
    test, 
    stop,
    setMuted,
    setRequiresHumanSpeech,
    updateLastHumanSpeech
  } = useVoiceSynthesis();

  const [autoListen, setAutoListen] = useState(false);
  const [speechIndicatorLevel, setSpeechIndicatorLevel] = useState(0);

  const vad = useVAD({
    onSpeech: () => {
      console.log("[VoiceControls] Human speech detected");
      updateLastHumanSpeech();
    },
    onSilence: () => {
      console.log("[VoiceControls] Silence detected");
    },
    onLevelUpdate: (level) => {
      setSpeechIndicatorLevel(level);
    }
  });

  // Handle Auto Listen toggle
  useEffect(() => {
    if (autoListen && isEnabled) {
      vad.startListening();
      setRequiresHumanSpeech(true);
    } else {
      vad.stopListening();
      setRequiresHumanSpeech(false);
    }
  }, [autoListen, isEnabled]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (vad.isListening) {
        vad.stopListening();
      }
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Voice Controls</CardTitle>
          <div className="flex items-center space-x-2">
            <span className={`status-indicator ${isEnabled ? 'status-online' : 'status-offline'}`}></span>
            <span className="text-sm text-muted-foreground">
              {isEnabled ? 'Ready' : 'Disabled'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Button 
            onClick={enable}
            disabled={isEnabled}
            data-testid="button-enable-voice"
          >
            Enable Voice
          </Button>
          <Button 
            onClick={test}
            variant="secondary"
            disabled={!isEnabled || isPlaying}
            data-testid="button-test-speech"
          >
            Test Speech
          </Button>
          <Button 
            onClick={stop}
            variant="outline"
            disabled={!isPlaying}
            data-testid="button-stop-speech"
          >
            Stop
          </Button>
        </div>

        {/* Auto Listen controls */}
        <div className="space-y-4 mb-6 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="auto-listen"
                checked={autoListen}
                onCheckedChange={(checked) => setAutoListen(!!checked)}
                disabled={!isEnabled}
                data-testid="checkbox-auto-listen"
              />
              <Label 
                htmlFor="auto-listen" 
                className="cursor-pointer flex items-center gap-2"
              >
                Auto Listen
                {vad.isListening ? (
                  <Mic className="h-4 w-4 text-green-500" />
                ) : (
                  <MicOff className="h-4 w-4 text-muted-foreground" />
                )}
              </Label>
            </div>
            {autoListen && (
              <span className="text-sm text-muted-foreground">
                {vad.isListening ? "Listening for speech..." : "Not listening"}
              </span>
            )}
          </div>

          {/* Speech detection indicator */}
          {vad.isListening && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Audio Level</span>
                <span className={vad.isSpeaking ? "text-green-500" : "text-muted-foreground"}>
                  {vad.isSpeaking ? "Speaking Detected" : "Silent"}
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-100 ${
                    vad.isSpeaking ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${speechIndicatorLevel * 100}%` }}
                  data-testid="audio-level-indicator"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {requiresHumanSpeech 
                  ? "Chango will only respond after detecting human speech" 
                  : "VAD active but not blocking speech"}
              </p>
            </div>
          )}
        </div>

        {/* Mute control */}
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox 
            id="mute"
            checked={isMuted}
            onCheckedChange={(checked) => setMuted(!!checked)}
            data-testid="checkbox-mute"
          />
          <Label 
            htmlFor="mute" 
            className="cursor-pointer flex items-center gap-2"
          >
            Mute Speech Output
            {isMuted ? (
              <VolumeX className="h-4 w-4 text-red-500" />
            ) : (
              <Volume2 className="h-4 w-4 text-green-500" />
            )}
          </Label>
        </div>

        <div className={`voice-visualizer ${isPlaying ? 'active' : ''} mb-4`}></div>
        
        <p className="text-sm text-muted-foreground" data-testid="text-voice-status">
          Status: {isEnabled ? 'Voice synthesis ready' : 'Voice synthesis disabled'} 
          {isPlaying && ' • Currently playing'}
          {vad.isListening && ' • VAD active'}
          {isMuted && ' • Muted'}
        </p>
      </CardContent>
    </Card>
  );
}