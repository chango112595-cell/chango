import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { VoiceProfile } from "@shared/schema";

export default function VoiceScanner() {
  const [profileName, setProfileName] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { 
    isRecording, 
    hasRecording, 
    startRecording, 
    stopRecording, 
    audioBlob,
    status 
  } = useAudioRecording();

  // Load voice profiles
  const { data: profilesData } = useQuery({
    queryKey: ["/api/voice-profiles"],
  });

  const profiles = ((profilesData as any)?.profiles || []) as VoiceProfile[];

  // Analyze and save profile mutation
  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!audioBlob || !profileName.trim()) {
        throw new Error("Audio recording and profile name are required");
      }

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");
      formData.append("name", profileName.trim());
      formData.append("accentType", "custom");
      formData.append("intensity", "0.5");

      const response = await fetch("/api/voice-profiles", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to save voice profile");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
      setProfileName("");
      toast({
        title: "Voice Profile Saved",
        description: `Profile "${profileName}" has been analyzed and saved successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Load profile mutation
  const loadProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      return apiRequest("GET", `/api/voice-profiles/${profileId}`);
    },
    onSuccess: (data) => {
      const profile = (data as any).profile as VoiceProfile;
      toast({
        title: "Profile Loaded",
        description: `Voice profile "${profile.name}" has been applied.`,
      });
    },
    onError: () => {
      toast({
        title: "Load Failed",
        description: "Failed to load the selected voice profile.",
        variant: "destructive",
      });
    },
  });

  const handleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleAnalyzeAndSave = () => {
    if (!profileName.trim()) {
      toast({
        title: "Profile Name Required",
        description: "Please enter a name for the voice profile.",
        variant: "destructive",
      });
      return;
    }
    saveProfileMutation.mutate();
  };

  const handleLoadProfile = () => {
    if (!selectedProfileId) {
      toast({
        title: "Profile Selection Required",
        description: "Please select a profile to load.",
        variant: "destructive",
      });
      return;
    }
    loadProfileMutation.mutate(selectedProfileId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Profile Scanner</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <Input
              type="text"
              placeholder="Profile name (e.g., 'Morgan Freeman Style')"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="flex-1"
              data-testid="input-profile-name"
            />
            <Button
              onClick={handleRecord}
              variant={isRecording ? "destructive" : "secondary"}
              className="flex items-center space-x-2"
              data-testid="button-record-voice"
            >
              <div className={`w-3 h-3 rounded-full ${
                isRecording ? 'bg-red-400 animate-pulse' : 'bg-gray-400'
              }`}></div>
              <span>{isRecording ? "Stop" : "Record"}</span>
            </Button>
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={handleAnalyzeAndSave}
              disabled={!hasRecording || !profileName.trim() || saveProfileMutation.isPending}
              className="flex-1"
              data-testid="button-analyze-save"
            >
              {saveProfileMutation.isPending ? "Analyzing..." : "Analyze & Save"}
            </Button>
            <div className="flex-1 flex space-x-2">
              <Select 
                value={selectedProfileId} 
                onValueChange={setSelectedProfileId}
                data-testid="select-voice-profile"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleLoadProfile}
                disabled={!selectedProfileId || loadProfileMutation.isPending}
                data-testid="button-load-profile"
              >
                Load
              </Button>
            </div>
          </div>

          <div className="bg-muted/30 rounded-md p-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className={`status-indicator ${
                isRecording ? 'status-processing' : 
                hasRecording ? 'status-online' : 'status-offline'
              }`}></span>
              <span className="text-sm font-medium">Scanning Status</span>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-scan-status">
              {status} • {profiles.length} custom profiles saved
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
