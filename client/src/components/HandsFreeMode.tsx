import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useWakeWord } from "@/hooks/useWakeWord";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Bot, Loader2, Settings, Volume2 } from "lucide-react";

export default function HandsFreeMode() {
  const [customWakeWord, setCustomWakeWord] = useState("lolo");
  const [showSettings, setShowSettings] = useState(false);
  
  const {
    isEnabled,
    isListening,
    isProcessing,
    inCooldown,
    sessionActive,
    lastCommand,
    lastResponse,
    wakeWord,
    enable,
    disable,
    setWakeWord: updateWakeWord,
  } = useWakeWord({
    wakeWord: customWakeWord,
    cooldownMs: 2500,
    maxUtteranceMs: 8000,
    silenceTimeoutMs: 1500,
  });

  const { toast } = useToast();

  // Handle wake word change
  const handleWakeWordChange = () => {
    if (customWakeWord && customWakeWord.trim()) {
      updateWakeWord(customWakeWord.trim().toLowerCase());
      toast({
        title: "Wake Word Updated",
        description: `Wake word changed to "${customWakeWord.trim().toLowerCase()}"`,
      });
      setShowSettings(false);
    }
  };

  // Toggle hands-free mode
  const toggleHandsFree = async () => {
    if (isEnabled) {
      disable();
    } else {
      const success = await enable();
      if (!success) {
        toast({
          title: "Failed to Enable",
          description: "Could not enable hands-free mode. Please check your microphone permissions.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Hands-Free Mode
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              data-testid="button-wake-settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Switch
              checked={isEnabled}
              onCheckedChange={toggleHandsFree}
              aria-label="Toggle hands-free mode"
              data-testid="switch-hands-free"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
            <div className="space-y-2">
              <Label htmlFor="wake-word">Wake Word</Label>
              <div className="flex gap-2">
                <Input
                  id="wake-word"
                  value={customWakeWord}
                  onChange={(e) => setCustomWakeWord(e.target.value)}
                  placeholder="Enter wake word"
                  disabled={isEnabled}
                  data-testid="input-wake-word"
                />
                <Button
                  onClick={handleWakeWordChange}
                  disabled={isEnabled || !customWakeWord.trim()}
                  size="sm"
                  data-testid="button-update-wake-word"
                >
                  Update
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Say this word to activate voice commands (default: "lolo")
              </p>
            </div>
          </div>
        )}

        {/* Status Display */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            {isListening ? (
              <Mic className="h-5 w-5 text-green-500 animate-pulse" />
            ) : (
              <MicOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium">
                {!isEnabled ? "Hands-free mode disabled" :
                 sessionActive ? "Listening for command..." :
                 inCooldown ? "Cooldown active" :
                 `Say "${wakeWord}" to start`}
              </p>
              <div className="flex gap-2 mt-1">
                {isEnabled && (
                  <Badge variant={isListening ? "default" : "secondary"} className="text-xs">
                    {isListening ? "Listening" : "Ready"}
                  </Badge>
                )}
                {sessionActive && (
                  <Badge variant="default" className="text-xs bg-blue-500">
                    Session Active
                  </Badge>
                )}
                {isProcessing && (
                  <Badge variant="default" className="text-xs bg-orange-500">
                    Processing
                  </Badge>
                )}
                {inCooldown && (
                  <Badge variant="secondary" className="text-xs">
                    Cooldown
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Processing Indicator */}
          {isProcessing && (
            <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
          )}
        </div>

        {/* Last Command/Response */}
        {(lastCommand || lastResponse) && (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/20">
            {lastCommand && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Last Command:</p>
                <p className="text-sm flex items-center gap-2">
                  <Mic className="h-3 w-3" />
                  "{lastCommand}"
                </p>
              </div>
            )}
            {lastResponse && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Response:</p>
                <p className="text-sm flex items-center gap-2">
                  <Volume2 className="h-3 w-3" />
                  "{lastResponse}"
                </p>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Say "{wakeWord}" followed by your command</p>
          <p>• Examples: "{wakeWord} what time is it", "{wakeWord} tell me a joke"</p>
          <p>• Wait for cooldown (2.5s) between commands</p>
          <p>• Commands timeout after 8 seconds of silence</p>
        </div>

        {/* Test Section */}
        {isEnabled && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-2">Test Commands:</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toast({
                    title: "Try Saying",
                    description: `"${wakeWord} what time is it"`,
                  });
                }}
                data-testid="button-test-time"
              >
                Time Query
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toast({
                    title: "Try Saying",
                    description: `"${wakeWord} who are you"`,
                  });
                }}
                data-testid="button-test-identity"
              >
                Identity
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toast({
                    title: "Try Saying",
                    description: `"${wakeWord} tell me a joke"`,
                  });
                }}
                data-testid="button-test-joke"
              >
                Joke
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toast({
                    title: "Try Saying",
                    description: `"${wakeWord} how are you"`,
                  });
                }}
                data-testid="button-test-greeting"
              >
                Greeting
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}