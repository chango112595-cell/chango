import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { trackTtsUtterance } from "@/lib/sessionTracking";

export default function TextToSpeech() {
  const [text, setText] = useState("Hello, I'm Chango AI. I can synthesize speech with multiple accents and voices.");
  const { speak, isPlaying } = useVoiceSynthesis();
  const { toast } = useToast();

  const previewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tts/synthesize", {
        text: text.trim(),
        route: "client"
      });
    },
    onSuccess: () => {
      toast({
        title: "Preview Generated",
        description: "Text has been processed for synthesis.",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      // TODO: Implement audio export functionality
      throw new Error("Export functionality not yet implemented");
    },
    onError: () => {
      toast({
        title: "Export Not Available",
        description: "Audio export feature is coming soon.",
        variant: "destructive",
      });
    },
  });

  const handleSpeak = () => {
    if (text.trim()) {
      speak(text.trim());
      // Track TTS usage for session analytics
      trackTtsUtterance();
    }
  };

  const handlePreview = () => {
    if (text.trim()) {
      previewMutation.mutate();
    }
  };

  const handleExport = () => {
    if (text.trim()) {
      exportMutation.mutate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Text to Speech</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Textarea
            placeholder="Enter text to synthesize..."
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="resize-none"
            data-testid="textarea-tts-input"
          />
          
          <div className="flex space-x-3">
            <Button 
              onClick={handleSpeak}
              className="flex-1"
              disabled={!text.trim() || isPlaying}
              data-testid="button-speak"
            >
              Speak
            </Button>
            <Button 
              onClick={handlePreview}
              variant="secondary"
              disabled={!text.trim() || previewMutation.isPending}
              data-testid="button-preview"
            >
              {previewMutation.isPending ? "Processing..." : "Preview"}
            </Button>
            <Button 
              onClick={handleExport}
              variant="outline"
              disabled={!text.trim()}
              data-testid="button-export"
            >
              Export
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
