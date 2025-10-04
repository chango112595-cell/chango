import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeechCoordinationProvider } from "@/lib/speechCoordination";
import { ConversationProvider } from "@/lib/conversationContext";
import { bootstrapLolo, shutdownLolo } from "@/app/bootstrap";
import { AskBar } from "@/ui/AskBar";
import StatusDock from "@/components/StatusDock";
import { HeaderBar } from "@/components/HeaderBar";
import { HologramSphere } from "@/components/HologramSphere";
import { UiModeSwitch } from "@/components/UiModeSwitch";
import { UIModeProvider, useUIMode } from "@/contexts/UIModeContext";
import { useVoiceBus } from "@/voice/useVoiceBus";
import { FEATURES } from "@/config/featureFlags";
import { voiceBus } from "@/voice/voiceBus";
import { DebugOverlay } from "@/dev/DebugOverlay";
import { MicrophonePermission } from "@/components/MicrophonePermission";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

function StatusDockWrapper() {
  const { systemOnline, isSpeaking, isMuted, setMuted } = useVoiceBus();
  
  return (
    <StatusDock
      systemOnline={systemOnline}
      speaking={isSpeaking}
      muted={isMuted}
      onToggleMute={() => setMuted(!isMuted)}
    />
  );
}

function VoiceInitializer() {
  // Initialize voice system on mount using bootstrap
  useEffect(() => {
    console.log("[App] Initializing Lolo with bootstrap...");
    
    const initializeLolo = async () => {
      try {
        // Bootstrap Lolo with always listening mode based on feature flag
        await bootstrapLolo({
          autoStartListening: FEATURES.ALWAYS_LISTEN_DEFAULT,  // Use feature flag
          enableTTS: true,           // Enable text-to-speech
          pauseOnHidden: true        // Pause when tab is hidden
        });
        
        // Set initial mute state based on feature flag (inverted logic: listening = not muted)
        if (FEATURES.ALWAYS_LISTEN_DEFAULT) {
          voiceBus.setMute(false);
        }
        
        console.log("[App] Lolo bootstrapped successfully - always listening mode:", FEATURES.ALWAYS_LISTEN_DEFAULT);
      } catch (error) {
        console.error("[App] Failed to bootstrap Lolo:", error);
      }
    };
    
    // Run initialization
    initializeLolo();
    
    return () => {
      // Cleanup on unmount
      shutdownLolo();
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

function AppContent() {
  const { mode } = useUIMode();

  return (
    <>
      <VoiceInitializer />
      
      {/* Microphone permission request card */}
      <MicrophonePermission />
      
      {/* Conditionally render HeaderBar when mode is "header" */}
      {mode === "header" && <HeaderBar />}
      
      {/* Conditionally render HologramSphere when mode is "sphere" */}
      {mode === "sphere" && <HologramSphere state="idle" />}
      
      {/* Always show UiModeSwitch if the feature flag is enabled */}
      {FEATURES.UI_MODE_TOGGLE && <UiModeSwitch />}
      
      {!FEATURES.HANDS_FREE_UI && <StatusDockWrapper />}
      <Toaster />
      <Router />
      {/* Global AskBar for text input */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 z-50">
        <AskBar 
          placeholder="Ask Lolo anything..."
          showIcon={true}
          submitOnEnter={true}
          showSubmitButton={true}
          clearAfterSubmit={true}
        />
      </div>
      
      {/* Debug Overlay - controlled by feature flag */}
      <DebugOverlay />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UIModeProvider>
        <SpeechCoordinationProvider>
          <ConversationProvider>
            <TooltipProvider>
              <AppContent />
            </TooltipProvider>
          </ConversationProvider>
        </SpeechCoordinationProvider>
      </UIModeProvider>
    </QueryClientProvider>
  );
}

export default App;
