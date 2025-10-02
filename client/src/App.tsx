import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeechCoordinationProvider } from "@/lib/speechCoordination";
import { ConversationProvider } from "@/lib/conversationContext";
// import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis"; // Old VoiceBus-based system - replaced by TTS orchestrator
import { useLegacySTT } from "@/voice/legacy_stt";
import { initConversationEngine } from "@/modules/conversationEngine";
import { initTTS } from "@/app/initTTS";
import { AskBar } from "@/ui/AskBar";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

function VoiceInitializer() {
  // Initialize the new local TTS system
  // const voiceSynth = useVoiceSynthesis(); // Old VoiceBus-based system - replaced
  
  // Initialize STT (optional - can be toggled)
  const stt = useLegacySTT({
    continuous: true,
    interimResults: true,
    language: 'en-US'
  });

  // Initialize conversation engine and TTS on mount
  useEffect(() => {
    console.log("[App] Initializing TTS and conversation engine...");
    
    // Initialize the new local TTS system
    initTTS();
    
    // Initialize conversation engine
    initConversationEngine();
    
    // Old voice synthesis code - replaced by initTTS()
    // if (!voiceSynth.isEnabled) {
    //   voiceSynth.enable();
    // }
    
    // Optionally start STT (user can toggle this later)
    // Uncomment to auto-start: stt.start();
    
    return () => {
      // Cleanup on unmount
      if (stt.stt) {
        stt.stop();
      }
      // voiceSynth.cancel(); // Old cleanup - no longer needed
    };
  }, []);

  return null; // This component only handles initialization
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SpeechCoordinationProvider>
        <ConversationProvider>
          <TooltipProvider>
            <VoiceInitializer />
            <Toaster />
            <Router />
            {/* Global AskBar for text input */}
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 z-50">
              <AskBar 
                placeholder="Ask Chango anything..."
                showIcon={true}
                submitOnEnter={true}
                showSubmitButton={true}
                clearAfterSubmit={true}
              />
            </div>
          </TooltipProvider>
        </ConversationProvider>
      </SpeechCoordinationProvider>
    </QueryClientProvider>
  );
}

export default App;
