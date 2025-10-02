import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceSynthesisWithExport } from "@/hooks/useVoiceSynthesisWithExport";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { trackTtsUtterance } from "@/lib/sessionTracking";

export default function TextToSpeech() {
  const [text, setText] = useState("Hello, I'm Lolo AI. I can synthesize speech with multiple accents and voices using our custom voice engine!");
  const { speak, isPlaying, isRecording, exportAudio, downloadAudio } = useVoiceSynthesisWithExport();
  const { toast } = useToast();

  const previewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tts/synthesize", {
        text: text.trim()
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
      const audioBlob = await exportAudio(text.trim(), "client");
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const filename = `lolo-lve-speech-${timestamp}.webm`;
      downloadAudio(audioBlob, filename);
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Audio Exported",
        description: "Speech has been saved as an audio file using Lolo Voice Engine.",
      });
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export audio",
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
              disabled={!text.trim() || isPlaying || isRecording}
              data-testid="button-speak"
            >
              {isRecording ? "Recording..." : "Speak"}
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
              disabled={!text.trim() || isPlaying || isRecording || exportMutation.isPending}
              data-testid="button-export"
            >
              {exportMutation.isPending ? "Exporting..." : "Export"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
