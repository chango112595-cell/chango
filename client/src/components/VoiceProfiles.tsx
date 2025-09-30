import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Save, Trash2, Volume2, User } from "lucide-react";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";

// Import the Voice Profile API
declare global {
  interface Window {
    VoiceProfileAPI: any;
  }
}

interface VoiceProfile {
  id: string;
  name: string;
  gender: string;
  accent: string;
  createdAt: string;
  features?: any;
}

export default function VoiceProfiles() {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<VoiceProfile | null>(null);
  const [currentFeatures, setCurrentFeatures] = useState<any>(null);
  const [profileName, setProfileName] = useState("");
  const [gender, setGender] = useState("neutral");
  const [accent, setAccent] = useState("neutral");
  const [isLoading, setIsLoading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const voiceAPIRef = useRef<any>(null);
  const { toast } = useToast();
  const { applyAccent } = useVoiceSynthesis();

  // Initialize Voice Profile API
  useEffect(() => {
    // Load the Voice Profile API script
    const script = document.createElement('script');
    script.src = '/voice/profile.js';
    script.onload = () => {
      if (window.VoiceProfileAPI) {
        voiceAPIRef.current = new window.VoiceProfileAPI();
        loadProfiles();
      }
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Load saved profiles
  const loadProfiles = async () => {
    if (!voiceAPIRef.current) return;
    
    try {
      setIsLoading(true);
      const profileList = await voiceAPIRef.current.listProfiles();
      setProfiles(profileList);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load voice profiles",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Start recording audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await analyzeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Update recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 5000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      toast({
        title: "Error",
        description: "Failed to access microphone",
        variant: "destructive"
      });
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  // Analyze recorded audio
  const analyzeAudio = async (audioBlob: Blob) => {
    if (!voiceAPIRef.current) return;
    
    setIsAnalyzing(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        
        // Analyze the audio
        const result = await voiceAPIRef.current.analyzeSample(base64Audio, "Voice profile recording");
        
        if (result.ok) {
          setCurrentFeatures(result.features);
          
          // Update suggested gender if available
          if (result.suggestions?.gender) {
            setGender(result.suggestions.gender);
          }
          
          toast({
            title: "Analysis Complete",
            description: "Voice features extracted successfully"
          });
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze voice recording",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Save current analysis as profile
  const saveProfile = async () => {
    if (!voiceAPIRef.current || !currentFeatures || !profileName) {
      toast({
        title: "Missing Information",
        description: "Please record audio and enter a profile name",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await voiceAPIRef.current.saveProfile(
        profileName,
        currentFeatures,
        gender,
        accent
      );

      if (result.ok) {
        toast({
          title: "Profile Saved",
          description: `Voice profile "${profileName}" saved successfully`
        });
        
        setProfileName("");
        setCurrentFeatures(null);
        await loadProfiles();
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save voice profile",
        variant: "destructive"
      });
    }
  };

  // Delete a profile
  const deleteProfile = async (profileId: string) => {
    if (!voiceAPIRef.current) return;

    try {
      const result = await voiceAPIRef.current.deleteProfile(profileId);
      if (result.ok) {
        toast({
          title: "Profile Deleted",
          description: "Voice profile removed successfully"
        });
        
        if (selectedProfile?.id === profileId) {
          setSelectedProfile(null);
        }
        await loadProfiles();
      }
    } catch (error) {
      console.error('Failed to delete profile:', error);
      toast({
        title: "Delete Failed", 
        description: "Failed to delete voice profile",
        variant: "destructive"
      });
    }
  };

  // Apply style preset
  const applyStylePreset = async () => {
    if (!voiceAPIRef.current) return;

    try {
      const result = await voiceAPIRef.current.getStyle(
        accent,
        gender,
        currentFeatures || {}
      );

      if (result.ok) {
        setCurrentFeatures(result.features);
        
        // Apply the accent configuration to the voice synthesis
        applyAccent({
          profile: accent,
          rate: result.features?.speakingRate || 1.0,
          pitch: result.features?.pitchHint ? (result.features.pitchHint / 200) : 1.0,
          intensity: 0.5,
          emotion: 'neutral'
        });
        
        toast({
          title: "Style Applied",
          description: result.message
        });
      }
    } catch (error) {
      console.error('Failed to apply style:', error);
      toast({
        title: "Style Application Failed",
        description: "Failed to apply voice style",
        variant: "destructive"
      });
    }
  };

  // Load full profile details
  const loadProfileDetails = async (profile: VoiceProfile) => {
    if (!voiceAPIRef.current) return;

    try {
      const fullProfile = await voiceAPIRef.current.getProfile(profile.id);
      setSelectedProfile(fullProfile);
      setCurrentFeatures(fullProfile.features);
      setGender(fullProfile.gender || 'neutral');
      setAccent(fullProfile.accent || 'neutral');
      
      // Apply the loaded profile accent configuration to the voice synthesis
      if (fullProfile.features) {
        applyAccent({
          profile: fullProfile.accent || 'neutral',
          rate: fullProfile.features?.speakingRate || 1.0,
          pitch: fullProfile.features?.pitchHint ? (fullProfile.features.pitchHint / 200) : 1.0,
          intensity: 0.5,
          emotion: 'neutral'
        });
      }
    } catch (error) {
      console.error('Failed to load profile details:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load profile details",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Voice Intelligence Profiles
        </CardTitle>
        <CardDescription>
          Record, analyze, and save voice profiles with gender and accent styles
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Recording Section */}
        <div className="space-y-4 p-4 border rounded-lg">
          <Label>Record Voice Sample</Label>
          <div className="flex items-center gap-4">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isAnalyzing}
              variant={isRecording ? "destructive" : "default"}
              data-testid={isRecording ? "button-stop-recording" : "button-start-recording"}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  Stop ({5 - recordingTime}s)
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Record Sample
                </>
              )}
            </Button>
            {isAnalyzing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Analyzing...
              </div>
            )}
          </div>
        </div>

        {/* Analysis Results */}
        {currentFeatures && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <Label>Analysis Results</Label>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Pitch:</span>{' '}
                {currentFeatures.pitchHint?.toFixed(1)} Hz
              </div>
              <div>
                <span className="font-medium">Speaking Rate:</span>{' '}
                {currentFeatures.speakingRate?.toFixed(2)}x
              </div>
              <div>
                <span className="font-medium">Energy:</span>{' '}
                {(currentFeatures.energy * 100).toFixed(0)}%
              </div>
              <div>
                <span className="font-medium">Duration:</span>{' '}
                {currentFeatures.duration?.toFixed(1)}s
              </div>
            </div>
          </div>
        )}

        {/* Style Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Gender Style</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger data-testid="select-gender">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Accent Style</Label>
            <Select value={accent} onValueChange={setAccent}>
              <SelectTrigger data-testid="select-accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="british">British</SelectItem>
                <SelectItem value="southern_us">Southern US</SelectItem>
                <SelectItem value="spanish_en">Spanish English</SelectItem>
                <SelectItem value="caribbean">Caribbean</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Apply Style Button */}
        <Button
          onClick={applyStylePreset}
          variant="secondary"
          disabled={!currentFeatures}
          className="w-full"
          data-testid="button-apply-style"
        >
          <Volume2 className="w-4 h-4 mr-2" />
          Apply Style Preset
        </Button>

        {/* Save Profile */}
        {currentFeatures && (
          <div className="space-y-4 p-4 border rounded-lg">
            <Label>Save as Profile</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Profile name..."
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                data-testid="input-profile-name"
              />
              <Button
                onClick={saveProfile}
                disabled={!profileName}
                data-testid="button-save-profile"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        )}

        {/* Saved Profiles */}
        <div className="space-y-4">
          <Label>Saved Profiles</Label>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : profiles.length > 0 ? (
            <div className="space-y-2">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 ${
                    selectedProfile?.id === profile.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => loadProfileDetails(profile)}
                  data-testid={`profile-item-${profile.id}`}
                >
                  <div>
                    <div className="font-medium">{profile.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {profile.gender} • {profile.accent}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProfile(profile.id);
                    }}
                    data-testid={`button-delete-${profile.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                No saved profiles yet. Record a sample to create your first profile.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}