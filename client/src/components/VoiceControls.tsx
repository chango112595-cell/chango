import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";
import { useVAD } from "@/hooks/useVAD";
import { useWakeWord } from "@/hooks/useWakeWord";
import { VoiceBus } from "@/lib/voiceBus";
import { Voice, type VoiceControllerState } from "@/lib/voiceController";
import { ConversationOrchestrator } from "@/lib/conversationOrchestrator";
import { Mic, MicOff, Volume2, VolumeX, Power, PowerOff, ShieldOff, Shield, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConversation } from "@/lib/conversationContext";

export default function VoiceControls() {
  const { addUserMessage, addChangoMessage } = useConversation();
  const { 
    isEnabled, 
    isPlaying, 
    isMuted,
    requiresHumanSpeech,
    enable, 
    disable, 
    test, 
    stop,
    speak,
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
  const [voiceMode, setVoiceMode] = useState<'ACTIVE' | 'MUTED' | 'KILLED' | 'WAKE'>('WAKE');
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [askInputValue, setAskInputValue] = useState("");
  const { toast } = useToast();
  
  // Add refs for debouncing and transition states
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTransitioningRef = useRef(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
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
  
  // Subscribe to Voice controller state
  useEffect(() => {
    const unsubscribe = Voice.subscribe((state: VoiceControllerState) => {
      setVoiceMode(state.mode);
      setIsVoiceListening(state.isListening);
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
  
  // Debounce function for control changes
  const debounce = useCallback((fn: () => void, delay: number = 100) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(fn, delay);
  }, []);
  
  // Handle power toggle
  const handlePowerToggle = useCallback(() => {
    if (isTransitioningRef.current) return;
    
    debounce(() => {
      isTransitioningRef.current = true;
      setIsTransitioning(true);
      
      try {
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
      } finally {
        isTransitioningRef.current = false;
        setIsTransitioning(false);
      }
    });
  }, [isPowerOn, setPower, stop, debounce]);
  
  // Handle mic toggle
  const handleMicToggle = useCallback(() => {
    if (isTransitioningRef.current) return;
    
    debounce(() => {
      isTransitioningRef.current = true;
      setIsTransitioning(true);
      
      try {
        const newMicState = !isMicOn;
        setIsMicOn(newMicState);
        
        if (!newMicState) {
          // Turning mic off
          if (vad.isListening) vad.stopListening();
          if (wakeWord.isEnabled) wakeWord.disable();
          setAutoListen(false);
          setWakeWordEnabled(false);
        }
      } finally {
        isTransitioningRef.current = false;
        setIsTransitioning(false);
      }
    });
  }, [isMicOn, vad, wakeWord, debounce]);
  
  // Handle Voice Controller mute toggle
  const handleVoiceMuteToggle = useCallback(() => {
    Voice.toggleMute();
    toast({
      title: "Voice Mode Changed",
      description: Voice.getMode() === 'MUTED' ? "Voice muted" : "Voice activated",
    });
  }, [toast]);
  
  // Handle Voice Controller kill
  const handleVoiceKill = useCallback(() => {
    const passphrase = Voice.kill();
    toast({
      title: "Voice System Killed",
      description: `Passphrase to revive: ${passphrase}`,
      variant: "destructive",
    });
  }, [toast]);
  
  // Handle Voice Controller revive
  const handleVoiceRevive = useCallback(() => {
    const pass = prompt('Enter passphrase to revive voice system:');
    if (pass) {
      try {
        Voice.revive(pass);
        toast({
          title: "Voice System Revived",
          description: "Voice system is now active",
        });
      } catch (e) {
        toast({
          title: "Invalid Passphrase",
          description: "Could not revive voice system",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

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
              disabled={isTransitioning}
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

        {/* Ask Button with Input */}
        <div className="flex gap-2 mb-6">
          <Input
            type="text"
            placeholder="Type a question (e.g., 'what time is it?')"
            value={askInputValue}
            onChange={(e) => setAskInputValue(e.target.value)}
            onKeyPress={async (e) => {
              if (e.key === 'Enter') {
                console.log("[VoiceControls] Enter key pressed");
                console.log("[VoiceControls] Current state (Enter):", {
                  isPowerOn,
                  isEnabled,
                  askInputValue
                });
                
                const text = askInputValue || 'what time is it?';
                console.log("[VoiceControls] Processing text (Enter):", text);
                
                // Use the conversation orchestrator for consistent Q&A flow
                const result = await ConversationOrchestrator.processConversation(text, {
                  addUserMessage,
                  addChangoMessage,
                  speak,
                  showToast: (title, description, variant) => {
                    console.log("[VoiceControls] Toast (Enter):", title, description);
                    toast({
                      title,
                      description,
                      variant: variant as any,
                    });
                  }
                });
                
                console.log("[VoiceControls] Result (Enter):", result);
                
                // Clear input on success
                if (result.success) {
                  setAskInputValue("");
                }
              }
            }}
            disabled={!isPowerOn || !isEnabled}
            data-testid="input-ask-question"
          />
          <Button
            onClick={async () => {
              console.log("[VoiceControls] Ask button clicked");
              console.log("[VoiceControls] Current state:", {
                isPowerOn,
                isEnabled,
                askInputValue
              });
              
              const text = askInputValue || 'what time is it?';
              console.log("[VoiceControls] Processing text:", text);
              
              // Use the conversation orchestrator for consistent Q&A flow
              const result = await ConversationOrchestrator.processConversation(text, {
                addUserMessage,
                addChangoMessage,
                speak,
                showToast: (title, description, variant) => {
                  console.log("[VoiceControls] Toast:", title, description);
                  toast({
                    title,
                    description,
                    variant: variant as any,
                  });
                }
              });
              
              console.log("[VoiceControls] Result:", result);
              
              // Clear input on success
              if (result.success) {
                setAskInputValue("");
              }
            }}
            disabled={!isPowerOn || !isEnabled}
            size="sm"
            data-testid="button-ask"
          >
            <Send className="h-4 w-4 mr-1" />
            Ask
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
            disabled={!isPowerOn || isTransitioning}
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
                disabled={!isPowerOn || !isEnabled || !isMicOn || isTransitioning}
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
        
        {/* Voice Controller Controls */}
        <div className="space-y-2 mb-4 p-3 border rounded-lg bg-secondary/20">
          <div className="text-sm font-medium mb-2">Voice Controller</div>
          
          {/* Mode toggle for WAKE/ACTIVE */}
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant={voiceMode === 'WAKE' ? "secondary" : "default"}
              size="sm"
              onClick={() => Voice.setMode(voiceMode === 'WAKE' ? 'ACTIVE' : 'WAKE')}
              disabled={voiceMode === 'KILLED' || voiceMode === 'MUTED'}
              data-testid="button-mode-toggle"
            >
              {voiceMode === 'WAKE' ? (
                <>🌙 Wake Mode</>
              ) : voiceMode === 'ACTIVE' ? (
                <>🔊 Active Mode</>
              ) : (
                <>Mode: {voiceMode}</>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">
              {voiceMode === 'WAKE' ? "Say 'Chango' to activate" : 
               voiceMode === 'ACTIVE' ? "Actively listening" : ""}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={voiceMode === 'MUTED' ? "destructive" : "default"}
              size="sm"
              onClick={handleVoiceMuteToggle}
              disabled={voiceMode === 'KILLED'}
              data-testid="button-voice-mute"
            >
              {voiceMode === 'MUTED' ? (
                <><VolumeX className="h-4 w-4 mr-1" /> Unmute Voice</>
              ) : (
                <><Volume2 className="h-4 w-4 mr-1" /> Mute Voice</>
              )}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleVoiceKill}
              disabled={voiceMode === 'KILLED'}
              data-testid="button-voice-kill"
            >
              <ShieldOff className="h-4 w-4 mr-1" /> Kill
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVoiceRevive}
              disabled={voiceMode !== 'KILLED'}
              data-testid="button-voice-revive"
            >
              <Shield className="h-4 w-4 mr-1" /> Revive
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Mode: <span className={`font-bold ${
              voiceMode === 'ACTIVE' ? 'text-green-500' : 
              voiceMode === 'WAKE' ? 'text-blue-500' :
              voiceMode === 'MUTED' ? 'text-yellow-500' : 
              'text-red-500'
            }`}>{voiceMode}</span>
            {isVoiceListening && ' • Listening'}
            {voiceMode === 'WAKE' && ' • Say "Chango" to wake'}
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