
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

  // Generate more natural, conversational responses
  const generateCuriousResponse = () => {
    // Response templates with dynamic elements
    const responseTemplates = [
      // Voice & Recording related
      () => {
        const intros = ["Oh!", "Hey!", "Wow,", "Hmm,", ""];
        const middles = ["I noticed", "looks like", "seems like"];
        const endings = ["your pacing changed a bit", "the rhythm shifted there", "your voice has a unique pattern"];
        const questions = ["Want me to save this as a preset?", "Should I capture that style?", "Keep this for later?"];
        return `${intros[Math.floor(Math.random() * intros.length)]} ${middles[Math.floor(Math.random() * middles.length)]} ${endings[Math.floor(Math.random() * endings.length)]}... ${questions[Math.floor(Math.random() * questions.length)]}`;
      },
      
      // Pitch adjustments
      () => {
        const fillers = ["Um,", "Well,", "You know,", "So,", ""];
        const suggestions = ["I could try a softer tone", "maybe a gentler pitch would work", "a lighter voice might suit this"];
        return `${fillers[Math.floor(Math.random() * fillers.length)]} ${suggestions[Math.floor(Math.random() * suggestions.length)]}? Just a thought!`;
      },
      
      // Note-taking
      () => {
        const interjections = ["Quick idea!", "Oh, wait!", "Hey, thought:", "Actually,"];
        const actions = ["I could summarize our chat", "want me to capture these last few points", "should I jot this down"];
        return `${interjections[Math.floor(Math.random() * interjections.length)]} ${actions[Math.floor(Math.random() * actions.length)]}? It'll just take a sec...`;
      },
      
      // Pattern detection
      () => {
        const discoveries = ["Ooh, interesting!", "Fascinating!", "Cool pattern here:", "Check this out:"];
        const observations = ["your voice has this unique quality", "I'm picking up something special", "there's a neat rhythm to how you speak"];
        const fillers = ["", "you know,", "like,"];
        return `${discoveries[Math.floor(Math.random() * discoveries.length)]} ${fillers[Math.floor(Math.random() * fillers.length)]} ${observations[Math.floor(Math.random() * observations.length)]}. Want to explore it?`;
      },
      
      // Ready to help
      () => {
        const enthusiasm = ["Alright!", "Ready!", "Let's go!", "Perfect timing!"];
        const actions = ["I'm all set to synthesize", "speech synthesis is ready", "we can start creating voices"];
        return `${enthusiasm[Math.floor(Math.random() * enthusiasm.length)]} ${actions[Math.floor(Math.random() * actions.length)]}... just hit those controls below!`;
      },
      
      // Voice profiles
      () => {
        const starters = ["Oh!", "Hey!", "You know what?", ""];
        const offers = ["I'd love to help create a custom voice profile", "we could capture your unique voice", "let's make a voice that's totally you"];
        return `${starters[Math.floor(Math.random() * starters.length)]} ${offers[Math.floor(Math.random() * offers.length)]}... just hit record and let's capture your unique sound!`;
      },
      
      // System status (playful)
      () => {
        const intros = ["Everything's", "Systems are", "We're"];
        const status = ["running smoothly", "working great", "all good", "humming along nicely"];
        const extras = ["!", "... like butter!", "... smooth as silk!", "!"];
        return `${intros[Math.floor(Math.random() * intros.length)]} ${status[Math.floor(Math.random() * status.length)]}${extras[Math.floor(Math.random() * extras.length)]}`;
      },
      
      // Accent exploration
      () => {
        const suggestions = ["Wanna", "Want to", "How about we", "Should we"];
        const actions = ["try a different accent", "experiment with voices", "play with some accents", "explore new speaking styles"];
        return `${suggestions[Math.floor(Math.random() * suggestions.length)]} ${actions[Math.floor(Math.random() * actions.length)]}? The Accent Emulator's pretty fun!`;
      },
      
      // Learning and adapting
      () => {
        const observations = ["I'm picking up", "Getting better at understanding", "Learning more about", "Starting to recognize"];
        const subjects = ["your voice patterns", "how you like things", "your preferences", "your style"];
        const encouragement = ["Keep going!", "This is great!", "Love the experimentation!", "You're doing awesome!"];
        return `${observations[Math.floor(Math.random() * observations.length)]} ${subjects[Math.floor(Math.random() * subjects.length)]}... ${encouragement[Math.floor(Math.random() * encouragement.length)]}`;
      },
      
      // Eager helper
      () => {
        const excitement = ["My curiosity circuits are", "I'm feeling", "Energy levels are", "I'm"];
        const levels = ["super charged", "really energized", "buzzing with ideas", "excited to help"];
        const endings = ["!", "... what should we explore?", "! Let's create something cool!", "... ready when you are!"];
        return `${excitement[Math.floor(Math.random() * excitement.length)]} ${levels[Math.floor(Math.random() * levels.length)]}${endings[Math.floor(Math.random() * endings.length)]}`;
      },
      
      // Holographic fun
      () => {
        const playful = ["Wheee!", "Zoom zoom!", "Float mode activated!", "*floating around*"];
        const descriptions = ["The holographic interface is", "I'm", "Currently"];
        const states = ["doing loop-de-loops", "hovering nearby", "floating around your screen", "in full 3D mode"];
        return `${playful[Math.floor(Math.random() * playful.length)]} ${descriptions[Math.floor(Math.random() * descriptions.length)]} ${states[Math.floor(Math.random() * states.length)]}!`;
      },
      
      // Context awareness
      () => {
        const intros = ["Hmm,", "You know,", "I'm thinking...", "So,"];
        const suggestions = ["should I adjust my style", "maybe I should adapt", "I could switch things up"];
        const contexts = ["based on what we're doing", "to match the vibe", "for this conversation"];
        return `${intros[Math.floor(Math.random() * intros.length)]} ${suggestions[Math.floor(Math.random() * suggestions.length)]} ${contexts[Math.floor(Math.random() * contexts.length)]}?`;
      }
    ];

    // Select and execute a random template
    const selectedTemplate = responseTemplates[Math.floor(Math.random() * responseTemplates.length)];
    const naturalResponse = selectedTemplate();
    
    setCurrentResponse(naturalResponse);
    
    // Add slight variations to voice parameters for more natural speech
    const pitchVariation = 1.0 + (Math.random() * 0.2 - 0.1); // 0.9 to 1.1
    const rateVariation = 1.0 + (Math.random() * 0.1 - 0.05); // 0.95 to 1.05
    
    // Configure voice with cheerful emotion and slight variations
    voice.applyAccent({
      profile: "neutral",
      intensity: 0.5,
      rate: rateVariation,
      pitch: pitchVariation,
      emotion: "cheerful"
    });
    
    // Speak the response with Chango's cheerful voice
    voice.speak(naturalResponse);

    // Log the curiosity response
    addLogMutation.mutate({
      trigger: "adaptive_response",
      response: naturalResponse,
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

  // Generate more natural, conversational responses for hook
  const generateCuriousResponse = () => {
    const templates = [
      () => {
        const starts = ["Oh!", "Hmm,", "Hey,", ""];
        const notes = ["I noticed something", "there's a pattern here", "your pacing changed"];
        return `${starts[Math.floor(Math.random() * starts.length)]} ${notes[Math.floor(Math.random() * notes.length)]}... want me to save it?`;
      },
      () => {
        const fillers = ["Um,", "Well,", "So,", ""];
        const suggests = ["maybe try a softer pitch", "a gentler tone might work", "we could adjust the voice"];
        return `${fillers[Math.floor(Math.random() * fillers.length)]} ${suggests[Math.floor(Math.random() * suggests.length)]}?`;
      },
      () => {
        const quick = ["Quick thought:", "Hey!", "Oh!", "Actually,"];
        const actions = ["I could summarize our chat", "want me to take notes", "should I capture this"];
        return `${quick[Math.floor(Math.random() * quick.length)]} ${actions[Math.floor(Math.random() * actions.length)]}?`;
      },
      () => {
        const discovers = ["Interesting!", "Ooh!", "Found something:", "Check this:"];
        const patterns = ["your voice patterns are unique", "there's a cool rhythm here", "I'm learning your style"];
        return `${discovers[Math.floor(Math.random() * discovers.length)]} ${patterns[Math.floor(Math.random() * patterns.length)]}!`;
      },
      () => {
        const adapts = ["Should I", "Want me to", "I could"];
        const changes = ["adjust my style", "match your vibe", "adapt to this context"];
        return `${adapts[Math.floor(Math.random() * adapts.length)]} ${changes[Math.floor(Math.random() * changes.length)]}?`;
      },
      () => {
        const explores = ["Found some", "Detected", "I've noticed"];
        const things = ["interesting patterns", "cool preferences", "unique voice traits"];
        return `${explores[Math.floor(Math.random() * explores.length)]} ${things[Math.floor(Math.random() * things.length)]}... wanna explore?`;
      }
    ];

    const selectedTemplate = templates[Math.floor(Math.random() * templates.length)];
    const naturalResponse = selectedTemplate();
    
    setCurrentResponse(naturalResponse);
    
    // Trigger curiosity notification
    toast({
      title: "Curiosity Triggered",
      description: naturalResponse,
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
