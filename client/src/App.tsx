import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeechCoordinationProvider } from "@/lib/speechCoordination";
import { ConversationProvider } from "@/lib/conversationContext";
import { bootstrapChango, shutdownChango } from "@/app/bootstrap";
import { AskBar } from "@/ui/AskBar";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

function VoiceInitializer() {
  // Initialize voice system on mount
  useEffect(() => {
    console.log("[App] Initializing voice system...");
    
    const initializeVoice = async () => {
      try {
        // Initialize the TTS system first
        initTTS();
        
        // Initialize conversation engine
        initConversationEngine();
        
        // Initialize voice controller with STT and wake word
        await voiceController.initialize({
          autoStart: true,      // Auto-start STT
          wakeWordEnabled: true, // Enable wake word detection
          mode: 'WAKE'          // Start in wake mode
        });
        
        console.log("[App] Voice system initialized successfully");
      } catch (error) {
        console.error("[App] Failed to initialize voice system:", error);
      }
    };
    
    // Run initialization
    initializeVoice();
    
    return () => {
      // Cleanup on unmount
      voiceController.destroy();
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
