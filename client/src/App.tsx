import { useEffect, useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeechCoordinationProvider } from "@/lib/speechCoordination";
import { ConversationProvider } from "@/lib/conversationContext";

// New imports for hotfix components
import { HeaderCompact } from "@/components/HeaderCompact";
import { ChatInputBar } from "@/components/ChatInputBar";
import { useAlwaysListen } from "@/hooks/useAlwaysListen";
import { voiceGate } from "@/core/gate";
import { orchestrator } from "@/core/orchestrator";
import { voiceBus as coreVoiceBus } from "@/core/voice-bus";
import { responder } from "@/services/responder";
// Import layout styles
import "@/styles/layout.css";

// Voice system imports  
import { voiceController } from "@/voice/voiceController";
import { voiceBus } from "@/voice/voiceBus";

// Original components still needed
import StatusDock from "@/components/StatusDock";
import { HeaderBar } from "@/components/HeaderBar";
import { HologramSphere } from "@/components/HologramSphere";
import { UiModeSwitch } from "@/components/UiModeSwitch";
import { UIModeProvider, useUIMode } from "@/contexts/UIModeContext";
import { useVoiceBus } from "@/voice/useVoiceBus";
import { FEATURES } from "@/config/featureFlags";
import { DebugOverlay } from "@/dev/DebugOverlay";
import { MicrophonePermission } from "@/components/MicrophonePermission";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";
import { debugBus } from "@/dev/debugBus";

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

// New Voice System Initializer with Gate and Orchestrator integration
function EnhancedVoiceInitializer({ onInitializeWithGesture }: { onInitializeWithGesture?: (fn: () => Promise<boolean>) => void }) {
  const { 
    isListening, 
    hasPermission, 
    gateOpen,
    initializeWithGesture 
  } = useAlwaysListen(FEATURES.ALWAYS_LISTEN_DEFAULT);
  
  // Pass the initializeWithGesture function to parent
  useEffect(() => {
    if (onInitializeWithGesture) {
      onInitializeWithGesture(initializeWithGesture);
    }
  }, [initializeWithGesture, onInitializeWithGesture]);
  
  // Initialize voice controller and integrate with gate/orchestrator
  useEffect(() => {
    let initialized = false;
    let cleanupFns: (() => void)[] = [];
    
    const initializeVoiceSystem = async () => {
      // Prevent duplicate initialization
      if (initialized) {
        console.log("[App] Voice system already initialized, skipping");
        return;
      }
      
      // Check if permission was previously denied
      const permissionDenied = sessionStorage.getItem('mic_permission_denied') === 'true';
      if (permissionDenied) {
        console.log("[App] Mic permission previously denied, skipping voice initialization");
        debugBus.info("App", "voice_init_skipped", { reason: "permission_denied" });
        return;
      }
      
      initialized = true;
      console.log("[App] Initializing enhanced voice system...");
      debugBus.info("App", "voice_init_start", {});
      
      try {
        // Initialize the voice controller with new gate integration
        await voiceController.initialize({
          autoStart: false, // Don't auto-start, wait for gate
          wakeWordEnabled: true,
          mode: 'WAKE'
        });
        
        // Message routing removed - now handled directly by ChatInputBar for text
        // and by voice recognition handler for voice to prevent double responses
        
        // Setup voice recognition results to orchestrator
        const unsubscribeSpeech = voiceBus.on('userSpeechRecognized', async (event) => {
          const text = event.text;
          if (!text) return;
          
          // Route through orchestrator
          const decision = await orchestrator.routeMessage({
            text,
            source: 'voice'
          });
          
          if (decision.shouldProcess) {
            await orchestrator.processMessage({
              text,
              source: 'voice'
            }, decision);
            
            // Get response from responder
            if (decision.responseType !== 'none') {
              await responder.respond(text, {
                source: 'voice',
                responseType: decision.responseType as any
              });
            }
          }
        });
        
        // Setup gate state monitoring
        const unsubscribeGate = voiceGate.onStateChange((isOpen) => {
          debugBus.info("App", "gate_state_changed", { isOpen });
          
          if (isOpen) {
            // Gate opened, start voice controller if not already
            voiceController.startSTT().catch(err => {
              console.error("[App] Failed to start STT after gate open:", err);
            });
          } else {
            // Gate closed, stop STT
            voiceController.stopSTT();
          }
        });
        
        // Connect core voice bus to legacy voice bus
        const unsubscribeSpeak = coreVoiceBus.on('speak', (event) => {
          voiceBus.emit({
            type: 'speak',
            text: event.data?.text || ''
          });
        });
        
        const unsubscribeListen = coreVoiceBus.on('start_listening', () => {
          voiceController.startSTT().catch(err => {
            console.error("[App] Failed to start listening:", err);
          });
        });
        
        const unsubscribeStop = coreVoiceBus.on('stop_listening', () => {
          voiceController.stopSTT();
        });
        
        console.log("[App] Enhanced voice system initialized successfully");
        debugBus.info("App", "voice_init_complete", { 
          gateOpen, 
          hasPermission 
        });
        
        // Store cleanup functions
        cleanupFns = [
          unsubscribeSpeech,
          unsubscribeGate,
          unsubscribeSpeak,
          unsubscribeListen,
          unsubscribeStop
        ];
      } catch (error) {
        console.error("[App] Failed to initialize voice system:", error);
        debugBus.error("App", "voice_init_failed", { error: String(error) });
      }
    };
    
    // Initialize the voice system
    initializeVoiceSystem();
    
    // Cleanup on unmount
    return () => {
      initialized = false;
      cleanupFns.forEach(fn => fn());
      voiceController.destroy();
    };
  }, [gateOpen, hasPermission]);
  
  // Log always listen status
  useEffect(() => {
    debugBus.info("App", "always_listen_status", {
      isListening,
      hasPermission,
      gateOpen
    });
  }, [isListening, hasPermission, gateOpen]);
  
  return null;
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
  const [initializeWithGesture, setInitializeWithGesture] = useState<(() => Promise<boolean>) | null>(null);

  return (
    <>
      {/* Enhanced Voice Initializer with Gate and Orchestrator */}
      <EnhancedVoiceInitializer 
        onInitializeWithGesture={(fn) => setInitializeWithGesture(() => fn)}
      />
      
      {/* Microphone permission request card */}
      <MicrophonePermission />
      
      {/* Use HeaderCompact as the primary header */}
      <HeaderCompact />
      
      {/* Conditionally render HeaderBar when mode is "header" (legacy support) */}
      {mode === "header" && FEATURES.LEGACY_HEADER && <HeaderBar />}
      
      {/* Conditionally render HologramSphere when mode is "sphere" */}
      {mode === "sphere" && <HologramSphere state="idle" />}
      
      {/* Always show UiModeSwitch if the feature flag is enabled */}
      {FEATURES.UI_MODE_TOGGLE && <UiModeSwitch />}
      
      {/* Status dock for legacy UI */}
      {!FEATURES.HANDS_FREE_UI && <StatusDockWrapper />}
      
      <Toaster />
      <Router />
      
      {/* Use ChatInputBar instead of AskBar - sticky bottom with better mobile support */}
      <ChatInputBar 
        placeholder="Type a message or tap mic to speak..."
        initializeWithGesture={initializeWithGesture}
      />
      
      {/* Debug Overlay - shows Gate state and more */}
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