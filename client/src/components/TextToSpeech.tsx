import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVoiceSynthesisWithExport } from "@/hooks/useVoiceSynthesisWithExport";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { trackTtsUtterance } from "@/lib/sessionTracking";

export default function TextToSpeech() {
  const [text, setText] = useState("Hello, I'm Chango AI. I can synthesize speech with multiple accents and voices.");
  const [selectedRoute, setSelectedRoute] = useState<"client" | "elevenlabs" | "azure">("client");
  const { speak, isPlaying, isRecording, exportAudio, downloadAudio } = useVoiceSynthesisWithExport();
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
      const audioBlob = await exportAudio(text.trim(), selectedRoute);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const extension = selectedRoute === "client" ? "webm" : "mp3";
      const filename = `chango-${selectedRoute}-speech-${timestamp}.${extension}`;
      downloadAudio(audioBlob, filename);
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Audio Exported",
        description: `Speech has been saved as an audio file using ${selectedRoute.toUpperCase()} synthesis.`,
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

          {/* Route Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Synthesis Route</label>
            <Select value={selectedRoute} onValueChange={(value: any) => setSelectedRoute(value)}>
              <SelectTrigger data-testid="select-tts-route">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client (Browser)</SelectItem>
                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                <SelectItem value="azure">Azure TTS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
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
              disabled={!text.trim() || isPlaying || isRecording || exportMutation.isPending || (selectedRoute === "client")}
              data-testid="button-export"
            >
              {exportMutation.isPending ? "Exporting..." : selectedRoute === "client" ? "Export N/A" : "Export"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
