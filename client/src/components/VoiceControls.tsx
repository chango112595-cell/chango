import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";

export default function VoiceControls() {
  const { isEnabled, isPlaying, enable, test, stop } = useVoiceSynthesis();

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

        <div className={`voice-visualizer ${isPlaying ? 'active' : ''} mb-4`}></div>
        
        <p className="text-sm text-muted-foreground" data-testid="text-voice-status">
          Status: {isEnabled ? 'Voice synthesis ready' : 'Voice synthesis disabled'} 
          {isPlaying && ' • Currently playing'}
        </p>
      </CardContent>
    </Card>
  );
}
