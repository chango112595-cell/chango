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
  // Initialize voice system on mount using bootstrap
  useEffect(() => {
    console.log("[App] Initializing Chango with bootstrap...");
    
    const initializeChango = async () => {
      try {
        // Bootstrap Chango with always listening mode
        await bootstrapChango({
          autoStartListening: true,  // Auto-start continuous listening
          enableTTS: true,           // Enable text-to-speech
          pauseOnHidden: true        // Pause when tab is hidden
        });
        
        console.log("[App] Chango bootstrapped successfully - always listening mode active");
      } catch (error) {
        console.error("[App] Failed to bootstrap Chango:", error);
      }
    };
    
    // Run initialization
    initializeChango();
    
    return () => {
      // Cleanup on unmount
      shutdownChango();
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
