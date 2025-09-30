
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";
import { useSpeechCoordination } from "@/lib/speechCoordination";
import { VoiceBus } from "@/lib/voiceBus";
import { Voice } from "@/lib/voiceController";
import { Volume2, VolumeX } from "lucide-react";
import type { CuriosityLog } from "@shared/schema";

interface CuriositySettings {
  userId: string;
  curiosityLevel: number;
  personalityVariance: number;
  learningRate: number;
}

// Export function for chat responses
export function generateChatResponse(message: string, voice: any) {
  const lowerMessage = message.toLowerCase();
  let response = "";
  let emotion: "neutral" | "cheerful" | "professional" | "casual" | "excited" | "calm" | "dramatic" | "friendly" | "serious" | "curious" = "cheerful";
  
  // Generate contextual responses
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    const greetings = [
      "Hey there! I'm Chango, your AI companion. What would you like to explore today?",
      "Hello! Great to meet you! I'm Chango, and I love helping with voice synthesis. What can I do for you?",
      "Hi there! Welcome! I'm Chango, your friendly AI assistant. Ready to create some amazing voices together?"
    ];
    response = greetings[Math.floor(Math.random() * greetings.length)];
    emotion = "friendly";
  } else if (lowerMessage.includes('how are you')) {
    const responses = [
      "I'm buzzing with energy! My circuits are all fired up and ready to help. How can I assist you?",
      "Feeling fantastic! I've been practicing different voices all day. Want to hear some?",
      "I'm great! Just floating around here, ready to chat and help with whatever you need!"
    ];
    response = responses[Math.floor(Math.random() * responses.length)];
    emotion = "excited";
  } else if (lowerMessage.includes('tell me about yourself') || lowerMessage.includes('who are you')) {
    response = "I'm Chango, an AI with a holographic interface that floats around your screen! I love learning about voices and helping create custom speech profiles. I can synthesize speech, emulate accents, and even adjust my personality to match your preferences. What would you like to know more about?";
    emotion = "cheerful";
  } else if (lowerMessage.includes('help')) {
    response = "I'd be happy to help! I can synthesize speech, create custom voice profiles, emulate different accents, and even have conversations like this one. What specifically would you like help with?";
    emotion = "helpful" as any;
  } else if (lowerMessage.includes('voice') || lowerMessage.includes('speech')) {
    response = "Voice synthesis is my specialty! I can help you create custom voices, adjust pitch and tone, add different emotions, and even emulate various accents. Want to try creating a unique voice together?";
    emotion = "excited";
  } else if (lowerMessage.includes('thank')) {
    response = "You're very welcome! It's my pleasure to help. Is there anything else you'd like to explore?";
    emotion = "friendly";
  } else if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
    response = "Goodbye! It was great chatting with you. Come back anytime you want to experiment with voices or just have a conversation!";
    emotion = "friendly";
  } else if (lowerMessage.includes('what can you do')) {
    response = "I can do lots of things! I synthesize speech with different emotions and accents, create custom voice profiles, scan and analyze voices, and of course, have conversations like this! I also have a cool holographic interface that floats around. What interests you most?";
    emotion = "excited";
  } else {
    // Default conversational responses
    const defaults = [
      "That's interesting! Tell me more about that.",
      "I'd love to hear your thoughts on that!",
      "Hmm, let me think about that... What aspect interests you most?",
      "That's a great point! How can I help with that?",
      "Fascinating! Would you like to explore that further with some voice experiments?"
    ];
    response = defaults[Math.floor(Math.random() * defaults.length)];
    emotion = "curious";
  }
  
  // Speak the response without changing global voice settings
  // Force speak for chat responses as they are user-initiated
  if (voice && voice.speak) {
    voice.speak(response, true);
  }
  
  return response;
}

export default function CuriosityEngine() {
  const [curiosityLevel, setCuriosityLevel] = useState([95]);
  const [personalityVariance, setPersonalityVariance] = useState([85]);
  const [learningRate, setLearningRate] = useState([75]);
  const [currentResponse, setCurrentResponse] = useState("Hello! I'm Chango, your AI assistant. I'm here to help with voice synthesis and more!");
  const [quietMode, setQuietMode] = useState(false); // Add quiet mode state
  const isGeneratingRef = useRef(false); // Flag to prevent concurrent generation

  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize voice synthesis with Chango's cheerful personality
  const voice = useVoiceSynthesis();
  const speechCoordination = useSpeechCoordination();

  // Load recent curiosity logs
  const { data: logsData } = useQuery({
    queryKey: ["/api/curiosity/logs"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const logs = ((logsData as any)?.logs || []) as CuriosityLog[];

  // Enable voice synthesis on mount (without changing global settings)
  useEffect(() => {
    voice.enable();
    // Do not modify global voice settings - let the user control them through AccentEmulator
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
  const generateCuriousResponse = useCallback(() => {
    // Check VoiceBus power and mute states first, and generation flag
    const busState = VoiceBus.getState();
    if (!busState.power || busState.mute || isGeneratingRef.current) {
      console.log("[CuriosityEngine] Skipping response - power OFF, muted, or already generating");
      return;
    }
    
    isGeneratingRef.current = true;
    
    // Don't generate response if speech is already active or chat was recently active
    if (voice.isSpeaking()) {
      console.log("[CuriosityEngine] Skipping response - already speaking");
      isGeneratingRef.current = false;
      return;
    }
    
    if (!speechCoordination.canCuriositySpeak()) {
      console.log("[CuriosityEngine] Skipping response - chat recently active");
      isGeneratingRef.current = false;
      return;
    }
    // Response templates with dynamic elements - now more conversational and engaging
    const responseTemplates = [
      // Conversation starters and greetings
      () => {
        const greetings = ["Hey there!", "Hi!", "Hello!", "Oh, hello!", "Hey!"];
        const follows = ["I'm excited to chat!", "What's on your mind?", "How can I help today?", "What would you like to explore?", "Ready for some voice experiments?"];
        return `${greetings[Math.floor(Math.random() * greetings.length)]} ${follows[Math.floor(Math.random() * follows.length)]}`;
      },
      
      // Questions to engage the user
      () => {
        const questions = [
          "Hey, I noticed you've been quiet... want to chat about something?",
          "I'm curious - what brings you here today?",
          "Got any questions for me? I love a good conversation!",
          "Tell me something interesting about yourself!",
          "What kind of voice are you looking to create?",
          "Have you experimented with voice synthesis before?",
          "What's your favorite thing about AI voices?",
          "Want to hear about my latest discoveries?"
        ];
        return questions[Math.floor(Math.random() * questions.length)];
      },
      
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
      },
      
      // Fun facts about voice and AI
      () => {
        const facts = [
          "Did you know? The human voice has over 100 muscles working together!",
          "Fun fact: I can synthesize speech in milliseconds!",
          "Here's something cool: Voice patterns are as unique as fingerprints!",
          "Did you know AI voices are getting more expressive every day?",
          "Fun fact: Your voice changes throughout the day - it's usually deeper in the morning!",
          "Cool fact: I can adjust over 50 different voice parameters!"
        ];
        return facts[Math.floor(Math.random() * facts.length)];
      },
      
      // Encouragement to interact
      () => {
        const encouragements = [
          "Don't be shy - I love chatting with new friends!",
          "Feel free to ask me anything about voice synthesis!",
          "I'm here to help - just type a message below!",
          "Let's create something amazing together!",
          "Your ideas + my voice tech = awesome possibilities!",
          "I'm all ears... well, circuits! What would you like to know?"
        ];
        return encouragements[Math.floor(Math.random() * encouragements.length)];
      },
      
      // Time-aware responses
      () => {
        const hour = new Date().getHours();
        if (hour < 12) {
          return "Good morning! Ready to start the day with some voice experiments?";
        } else if (hour < 17) {
          return "Good afternoon! Perfect time for exploring voice synthesis!";
        } else if (hour < 21) {
          return "Good evening! How about we create some amazing voices together?";
        } else {
          return "Working late? I'm always here to help with your voice projects!";
        }
      }
    ];

    // Select and execute a random template
    const selectedTemplate = responseTemplates[Math.floor(Math.random() * responseTemplates.length)];
    const naturalResponse = selectedTemplate();
    
    setCurrentResponse(naturalResponse);
    
    // Add variations based on response type
    const isQuestion = naturalResponse.includes('?');
    const isExcited = naturalResponse.includes('!') || naturalResponse.includes('excited') || naturalResponse.includes('love');
    const isGreeting = naturalResponse.toLowerCase().includes('hello') || naturalResponse.toLowerCase().includes('hi ') || naturalResponse.toLowerCase().includes('hey');
    
    // Check VoiceBus state and Voice mode before speaking
    const currentBusState = VoiceBus.getState();
    const voiceMode = Voice.getMode();
    // Only speak if power is on, not muted, not in quiet mode, AND in ACTIVE mode
    if (currentBusState.power && !currentBusState.mute && !quietMode && voiceMode === 'ACTIVE') {
      // Speak the response without changing global voice settings
      // The voice will use the stable configuration set in useEffect
      // Don't force speak for random curiosity responses - respect VAD
      voice.speak(naturalResponse, false);
    }

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
    
    // Always clear the generating flag with a timeout for safety
    setTimeout(() => {
      isGeneratingRef.current = false;
    }, 100);
  }, [voice, speechCoordination, curiosityLevel, personalityVariance, addLogMutation, quietMode]);

  // Auto-generate responses based on curiosity level
  useEffect(() => {
    const interval = setInterval(() => {
      // Guard to check if already generating
      if (isGeneratingRef.current) return;
      
      // Check Voice controller mode first - only allow in ACTIVE mode
      const voiceMode = Voice.getMode();
      if (voiceMode !== 'ACTIVE') {
        console.log('[CuriosityEngine] Skipping auto response - Voice mode is', voiceMode);
        return; // Don't generate curiosity responses unless actively listening
      }
      
      // Check VoiceBus state
      const busState = VoiceBus.getState();
      if (!busState.power || busState.mute) {
        return; // Don't speak if power is off or muted
      }
      
      // Check if quiet mode is enabled or if we can speak before rolling the dice
      if (!quietMode && !voice.isSpeaking() && speechCoordination.canCuriositySpeak()) {
        // Check VAD requirements
        if (voice.requiresHumanSpeech) {
          const timeSinceHumanSpeech = Date.now() - voice.lastHumanSpeechTime;
          if (voice.lastHumanSpeechTime === 0 || timeSinceHumanSpeech > 30000) {
            // No human speech detected or too long ago
            console.log('[CuriosityEngine] Skipping auto speech - waiting for human speech');
            return;
          }
        }
        
        // Check if muted
        if (voice.isMuted) {
          console.log('[CuriosityEngine] Skipping auto speech - muted');
          return;
        }
        
        const chance = curiosityLevel[0] / 100;
        if (Math.random() < chance * 0.6) { // 60% of curiosity level as base chance
          generateCuriousResponse();
        }
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [curiosityLevel, voice, speechCoordination, generateCuriousResponse, quietMode]);

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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Curiosity Engine</CardTitle>
        <Button
          variant={quietMode ? "destructive" : "outline"}
          size="sm"
          onClick={() => setQuietMode(!quietMode)}
          className="ml-auto"
          data-testid="button-quiet-mode"
        >
          {quietMode ? (
            <>
              <VolumeX className="w-4 h-4 mr-2" />
              Quiet Mode
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 mr-2" />
              Active Mode
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {quietMode && (
            <div className="bg-destructive/10 rounded-md p-3 mb-4">
              <div className="flex items-center space-x-2">
                <VolumeX className="w-4 h-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">Quiet Mode Active</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Chango won't speak randomly. You can still chat normally using the Chat interface.
              </p>
            </div>
          )}
          
          {currentResponse && !quietMode && (
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
