
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";
import type { CuriosityLog } from "@shared/schema";

interface CuriositySettings {
  userId: string;
  curiosityLevel: number;
  personalityVariance: number;
  learningRate: number;
}

export default function CuriosityEngine() {
  const [curiosityLevel, setCuriosityLevel] = useState([95]);
  const [personalityVariance, setPersonalityVariance] = useState([85]);
  const [learningRate, setLearningRate] = useState([75]);
  const [currentResponse, setCurrentResponse] = useState("Hello! I'm Chango, your AI assistant. I'm here to help with voice synthesis and more!");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize voice synthesis with Chango's cheerful personality
  const voice = useVoiceSynthesis();

  // Load recent curiosity logs
  const { data: logsData } = useQuery({
    queryKey: ["/api/curiosity/logs"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const logs = ((logsData as any)?.logs || []) as CuriosityLog[];

  // Enable voice synthesis and configure Chango's voice on mount
  useEffect(() => {
    voice.enable();
    // Configure Chango's cheerful personality
    voice.applyAccent({
      profile: "neutral",
      intensity: 0.5,
      rate: 1.0,
      pitch: 1.1, // Slightly higher pitch for cheerful tone
      emotion: "cheerful" // Chango's default cheerful emotion
    });
  }, []);

  // Add curiosity log mutation
  const addLogMutation = useMutation({
    mutationFn: async (logData: { trigger: string; response: string; context?: any }) => {
      return apiRequest("POST", "/api/curiosity/log", logData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/curiosity/logs"] });
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: {
      curiosityLevel: number;
      personalityVariance: number;
      learningRate: number;
    }) => {
      return apiRequest("POST", "/api/settings", {
        userId: "default",
        ...settings,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Curiosity Settings Updated",
        description: "The AI's personality parameters have been adjusted.",
      });
    },
  });

  // Generate curiosity responses based on context
  const generateCuriousResponse = () => {
    const responses = [
      "I noticed a pacing change—should we save this as a style preset?",
      "Curious: want me to try a softer pitch for this topic?",
      "I can summarize our last 3 steps into a note—do it?",
      "I think your last assumption conflicts with earlier notes. Want a quick check?",
      "Should I adapt my response style based on the current conversation context?",
      "I've detected some interesting patterns in your voice preferences. Explore them?",
      "Ready to synthesize speech! Try the TextToSpeech controls below.",
      "I can help you create custom voice profiles. Just record your voice!",
      "Did you know? I support multiple TTS routes including ElevenLabs and Azure.",
      "The holographic interface is active. I'm floating around your screen!",
      "System diagnostics show everything is running smoothly.",
      "Want to try a different accent? Check out the Accent Emulator!",
      "I'm learning from your voice patterns. Keep experimenting!",
      "My curiosity level is set to very high - I'm eager to help!",
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    setCurrentResponse(randomResponse);
    
    // Speak the response with Chango's cheerful voice
    voice.speak(randomResponse);

    // Log the curiosity response
    addLogMutation.mutate({
      trigger: "adaptive_response",
      response: randomResponse,
      context: {
        curiosityLevel: curiosityLevel[0] / 100,
        personalityVariance: personalityVariance[0] / 100,
        timestamp: new Date().toISOString(),
      },
    });
  };

  // Auto-generate responses based on curiosity level
  useEffect(() => {
    const interval = setInterval(() => {
      const chance = curiosityLevel[0] / 100;
      if (Math.random() < chance * 0.3) { // 30% of curiosity level as base chance
        generateCuriousResponse();
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [curiosityLevel]);

  const handleAdjustPersonality = () => {
    updateSettingsMutation.mutate({
      curiosityLevel: curiosityLevel[0] / 100,
      personalityVariance: personalityVariance[0] / 100,
      learningRate: learningRate[0] / 100,
    });
  };

  const getCuriosityLevelText = (level: number) => {
    if (level >= 80) return "Very High";
    if (level >= 60) return "High";
    if (level >= 40) return "Medium";
    if (level >= 20) return "Low";
    return "Very Low";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Curiosity Engine</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {currentResponse && (
            <div className="bg-muted/20 rounded-md p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Adaptive Response</span>
              </div>
              <p className="text-xs text-muted-foreground" data-testid="text-curiosity-response">
                {currentResponse}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Curiosity Level</span>
              <span className="text-accent font-medium" data-testid="text-curiosity-level">
                {getCuriosityLevelText(curiosityLevel[0])}
              </span>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Personality Variance</span>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={personalityVariance}
                  onValueChange={setPersonalityVariance}
                  className="w-32"
                  data-testid="slider-personality-variance"
                />
                <span className="w-8 text-right">{personalityVariance[0]}%</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span>Learning Rate</span>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={learningRate}
                  onValueChange={setLearningRate}
                  className="w-32"
                  data-testid="slider-learning-rate"
                />
                <span className="w-8 text-right">{learningRate[0]}%</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span>Curiosity Intensity</span>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={curiosityLevel}
                  onValueChange={setCuriosityLevel}
                  className="w-32"
                  data-testid="slider-curiosity-intensity"
                />
                <span className="w-8 text-right">{curiosityLevel[0]}%</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleAdjustPersonality}
            className="w-full"
            disabled={updateSettingsMutation.isPending}
            data-testid="button-adjust-personality"
          >
            {updateSettingsMutation.isPending ? "Adjusting..." : "Adjust Personality"}
          </Button>
          
          {voice.isPlaying && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Speaking...</span>
            </div>
          )}

          {logs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Recent Activity:</p>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {logs.slice(0, 3).map((log) => (
                  <p key={log.id} className="text-xs text-muted-foreground truncate">
                    {log.response}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function useCuriosityEngine() {
  const [currentResponse, setCurrentResponse] = useState<string>("");
  const { toast } = useToast();

  // Fetch current settings
  const { data, isLoading } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: {
      curiosityLevel: number;
      personalityVariance: number;
      learningRate: number;
    }) => {
      return apiRequest("POST", "/api/settings", {
        userId: "default",
        ...settings,
      });
    },
    onSuccess: () => {
      toast({
        title: "Curiosity Settings Updated",
        description: "The AI's personality parameters have been adjusted.",
      });
    },
  });

  // Generate curiosity responses based on context
  const generateCuriousResponse = () => {
    const responses = [
      "I noticed a pacing change—should we save this as a style preset?",
      "Curious: want me to try a softer pitch for this topic?",
      "I can summarize our last 3 steps into a note—do it?",
      "I think your last assumption conflicts with earlier notes. Want a quick check?",
      "Should I adapt my response style based on the current conversation context?",
      "I've detected some interesting patterns in your voice preferences. Explore them?",
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    setCurrentResponse(randomResponse);
    
    // Trigger curiosity notification
    toast({
      title: "Curiosity Triggered",
      description: randomResponse,
      duration: 5000,
    });
  };

  return {
    settings: data,
    isLoading,
    currentResponse,
    updateSettings: updateSettingsMutation.mutate,
    generateCuriousResponse,
    isUpdating: updateSettingsMutation.isPending,
  };
}
