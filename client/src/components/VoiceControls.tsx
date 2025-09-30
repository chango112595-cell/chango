import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";
import { useVAD } from "@/hooks/useVAD";
import { useWakeWord } from "@/hooks/useWakeWord";
import { VoiceBus } from "@/lib/voiceBus";
import { Mic, MicOff, Volume2, VolumeX, Power, PowerOff } from "lucide-react";

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
    setPower,
    setRequiresHumanSpeech,
    updateLastHumanSpeech
  } = useVoiceSynthesis();

  const [autoListen, setAutoListen] = useState(false);
  const [speechIndicatorLevel, setSpeechIndicatorLevel] = useState(0);
  const [isPowerOn, setIsPowerOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  
  const wakeWord = useWakeWord();

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
    if (autoListen && isEnabled && isPowerOn) {
      vad.startListening();
      setRequiresHumanSpeech(true);
    } else {
      vad.stopListening();
      setRequiresHumanSpeech(false);
    }
  }, [autoListen, isEnabled, isPowerOn]);
  
  // Handle wake word toggle
  useEffect(() => {
    if (wakeWordEnabled && isPowerOn) {
      wakeWord.enable();
    } else {
      wakeWord.disable();
    }
  }, [wakeWordEnabled, isPowerOn]);
  
  // Subscribe to VoiceBus state
  useEffect(() => {
    const unsubscribe = VoiceBus.subscribe((state) => {
      setIsPowerOn(state.power);
      if (!state.power) {
        // Power turned off, disable everything
        setAutoListen(false);
        setWakeWordEnabled(false);
        setIsMicOn(false);
      }
    });
    return unsubscribe;
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (vad.isListening) {
        vad.stopListening();
      }
      if (wakeWord.isEnabled) {
        wakeWord.disable();
      }
    };
  }, []);
  
  // Handle power toggle
  const handlePowerToggle = () => {
    const newPowerState = !isPowerOn;
    setIsPowerOn(newPowerState);
    setPower(newPowerState);
    
    if (!newPowerState) {
      // Turning power off - disable everything
      setAutoListen(false);
      setWakeWordEnabled(false);
      setIsMicOn(false);
      stop();
    }
  };
  
  // Handle mic toggle
  const handleMicToggle = () => {
    const newMicState = !isMicOn;
    setIsMicOn(newMicState);
    
    if (!newMicState) {
      // Turning mic off
      if (vad.isListening) vad.stopListening();
      if (wakeWord.isEnabled) wakeWord.disable();
      setAutoListen(false);
      setWakeWordEnabled(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Voice Controls</CardTitle>
          <div className="flex items-center space-x-4">
            <Button
              variant={isPowerOn ? "default" : "destructive"}
              size="sm"
              onClick={handlePowerToggle}
              data-testid="button-power"
            >
              {isPowerOn ? (
                <><Power className="h-4 w-4 mr-1" /> ON</>
              ) : (
                <><PowerOff className="h-4 w-4 mr-1" /> OFF</>
              )}
            </Button>
            <div className="flex items-center space-x-2">
              <span className={`status-indicator ${isPowerOn && isEnabled ? 'status-online' : 'status-offline'}`}></span>
              <span className="text-sm text-muted-foreground">
                {!isPowerOn ? 'Power OFF' : isEnabled ? 'Ready' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isPowerOn && (
          <div className="bg-destructive/10 rounded-md p-3 mb-4">
            <div className="flex items-center space-x-2">
              <PowerOff className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">Power is OFF</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Turn on power to enable voice features
            </p>
          </div>
        )}
        
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Button 
            onClick={enable}
            disabled={!isPowerOn || isEnabled}
            data-testid="button-enable-voice"
          >
            Enable Voice
          </Button>
          <Button 
            onClick={test}
            variant="secondary"
            disabled={!isPowerOn || !isEnabled || isPlaying}
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

        {/* Mic control */}
        <div className="flex items-center justify-between mb-4 p-3 border rounded-lg">
          <div className="flex items-center space-x-2">
            <Label className="cursor-pointer flex items-center gap-2">
              Microphone
              {isMicOn ? (
                <Mic className="h-4 w-4 text-green-500" />
              ) : (
                <MicOff className="h-4 w-4 text-red-500" />
              )}
            </Label>
          </div>
          <Button
            variant={isMicOn ? "outline" : "destructive"}
            size="sm"
            onClick={handleMicToggle}
            disabled={!isPowerOn}
            data-testid="button-mic-toggle"
          >
            {isMicOn ? "ON" : "OFF"}
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
                disabled={!isPowerOn || !isEnabled || !isMicOn}
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

        {/* Wake word control */}
        <div className="flex items-center justify-between mb-4 p-3 border rounded-lg">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="wake-word"
              checked={wakeWordEnabled}
              onCheckedChange={(checked) => setWakeWordEnabled(!!checked)}
              disabled={!isPowerOn || !isMicOn}
              data-testid="checkbox-wake-word"
            />
            <Label 
              htmlFor="wake-word" 
              className="cursor-pointer"
            >
              Wake Word ("Chango")
            </Label>
          </div>
          {wakeWord.isListening && (
            <span className="text-sm text-muted-foreground">
              Listening...
            </span>
          )}
        </div>
        
        {/* Mute control */}
        <div className="flex items-center justify-between mb-4 p-3 border rounded-lg">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="mute"
              checked={isMuted}
              onCheckedChange={(checked) => setMuted(!!checked)}
              disabled={!isPowerOn}
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
        </div>

        <div className={`voice-visualizer ${isPlaying ? 'active' : ''} mb-4`}></div>
        
        <p className="text-sm text-muted-foreground" data-testid="text-voice-status">
          Status: {!isPowerOn ? 'Power OFF' : isEnabled ? 'Voice synthesis ready' : 'Voice synthesis disabled'} 
          {isPlaying && ' • Currently playing'}
          {vad.isListening && ' • VAD active'}
          {wakeWord.isListening && ' • Wake word active'}
          {isMuted && ' • Muted'}
          {!isMicOn && ' • Mic OFF'}
        </p>
      </CardContent>
    </Card>
  );
}