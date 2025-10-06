import { useEffect, useState, Suspense, lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeechCoordinationProvider } from "@/lib/speechCoordination";
import { ConversationProvider } from "@/lib/conversationContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Safe imports with fallbacks for hotfix components
const HeaderCompact = lazy(() => 
  import("@/components/HeaderCompact").then(m => ({ default: m.HeaderCompact })).catch(() => ({
    default: () => <div className="p-2 bg-gray-100/10 text-gray-500 text-center">Header unavailable</div>
  }))
);

const ChatInputBar = lazy(() => 
  import("@/components/ChatInputBar").then(m => ({ default: m.ChatInputBar })).catch(() => ({
    default: () => <div className="fixed bottom-0 w-full p-4 bg-gray-100/10">Chat input unavailable</div>
  }))
);

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
import { bootstrapChango } from "@/app/bootstrap";

// Safe imports with fallbacks for original components
const StatusDock = lazy(() => 
  import("@/components/StatusDock").catch(() => ({
    default: () => <div className="fixed top-0 w-full p-2 bg-gray-100/10 text-center">Status unavailable</div>
  }))
);

const HeaderBar = lazy(() => 
  import("@/components/HeaderBar").then(m => ({ default: m.HeaderBar })).catch(() => ({
    default: () => <div className="p-2 bg-gray-100/10 text-center">Header bar unavailable</div>
  }))
);

const HologramSphere = lazy(() => 
  import("@/components/HologramSphere").then(m => ({ default: m.HologramSphere })).catch(() => ({
    default: () => <div className="p-4 text-center">Hologram unavailable</div>
  }))
);

const UiModeSwitch = lazy(() => 
  import("@/components/UiModeSwitch").then(m => ({ default: m.UiModeSwitch })).catch(() => ({
    default: () => null
  }))
);

const DebugOverlay = lazy(() => 
  import("@/dev/DebugOverlay").then(m => ({ default: m.DebugOverlay })).catch(() => ({
    default: () => null
  }))
);

const AudioUnlock = lazy(() => 
  import("@/components/AudioUnlock").then(m => ({ default: m.AudioUnlock })).catch(() => ({
    default: () => null
  }))
);

import { UIModeProvider, useUIMode } from "@/contexts/UIModeContext";
import { useVoiceBus } from "@/voice/useVoiceBus";
import { FEATURES } from "@/config/featureFlags";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";
import { debugBus } from "@/dev/debugBus";

// Import test scripts in dev mode - DISABLED to prevent message accumulation
// if (import.meta.env.DEV) {
//   import("@/tests/testConversationFlow").then(module => {
//     console.log("[App] Test conversation flow loaded");
//   }).catch(err => {
//     console.log("[App] Failed to load test script:", err);
//   });
  
//   import("@/tests/debugWakeWord").then(module => {
//     console.log("[App] Debug wake word test loaded");
//   }).catch(err => {
//     console.log("[App] Failed to load debug wake word script:", err);
//   });
  
//   import("@/tests/manualTest").then(module => {
//     console.log("[App] Manual test loaded");
//   }).catch(err => {
//     console.log("[App] Failed to load manual test script:", err);
//   });
  
//   import("@/tests/finalTest").then(module => {
//     console.log("[App] Final test loaded");
//   }).catch(err => {
//     console.log("[App] Failed to load final test script:", err);
//   });
  
//   import("@/tests/comprehensiveWakeWordTest").then(module => {
//     console.log("[App] Comprehensive wake word test loaded");
//   }).catch(err => {
//     console.log("[App] Failed to load comprehensive test:", err);
//   });
  
//   import("@/tests/runInlineTest").then(module => {
//     console.log("[App] Inline wake word test loaded and running...");
//   }).catch(err => {
//     console.log("[App] Failed to load inline test:", err);
//   });
  
//   import("@/tests/simpleWakeWordTest").then(module => {
//     console.log("[App] Simple wake word test loaded");
//   }).catch(err => {
//     console.log("[App] Failed to load simple test:", err);
//   });
// }

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
    let cleanupFns: (() => void)[] = [];
    
    const initializeVoiceSystem = async () => {
      console.log("[App] Initializing enhanced voice system...");
      
      // iOS-specific checks
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        console.log("[App] iOS detected, using iOS-specific initialization");
        debugBus.info("App", "ios_detected", { userAgent: navigator.userAgent });
      }
      
      debugBus.info("App", "voice_init_start", { isIOS });
      
      try {
        // ALWAYS bootstrap Chango to initialize conversation engine and TTS
        // This is needed for text input to work, even without mic permission
        console.log("[App] Bootstrapping Chango for conversation engine and TTS initialization...");
        await bootstrapChango({
          autoStartListening: false,  // Don't auto-start, will be handled by gate
          enableTTS: !isIOS || true,  // Enable TTS even on iOS, but handle failures
          pauseOnHidden: true
        });
        console.log("[App] Bootstrap complete, conversation engine and VoiceOrchestrator are ready");
        
        // Check if permission was previously denied
        const permissionDenied = sessionStorage.getItem('mic_permission_denied') === 'true';
        if (permissionDenied) {
          console.log("[App] Mic permission previously denied, skipping voice controller initialization");
          debugBus.info("App", "voice_controller_skipped", { reason: "permission_denied" });
          // Continue to set up other components but skip voice controller
        } else {
          // Initialize the voice controller only if mic permission wasn't denied
          console.log("[App] Initializing voice controller with gate integration...");
          await voiceController.initialize({
            autoStart: false, // Don't auto-start, wait for gate
            wakeWordEnabled: !isIOS, // Disable wake word on iOS due to audio restrictions
            mode: isIOS ? 'PUSH' : 'WAKE'
          });
          console.log("[App] Voice controller initialized successfully");
        }
        
        // Message routing removed - now handled directly by ChatInputBar for text
        // and by voice recognition handler for voice to prevent double responses
        
        // Setup voice recognition results to orchestrator (only if voice is available)
        let unsubscribeSpeech = () => {};
        if (!permissionDenied) {
          unsubscribeSpeech = voiceBus.on('userSpeechRecognized', async (event) => {
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
        }
        
        // Setup gate state monitoring (always, for debugging)
        const unsubscribeGate = voiceGate.onStateChange((isOpen) => {
          debugBus.info("App", "gate_state_changed", { isOpen });
          
          // DISABLED: STT is now handled by alwaysListen singleton
          // voiceController.startSTT/stopSTT calls removed
          if (isOpen) {
            console.log("[App] Gate opened - STT handled by alwaysListen singleton");
          } else {
            console.log("[App] Gate closed - STT handled by alwaysListen singleton");
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
          // DISABLED: STT is now handled by alwaysListen singleton
          console.log("[App] start_listening event - STT handled by alwaysListen singleton");
        });
        
        const unsubscribeStop = coreVoiceBus.on('stop_listening', () => {
          // DISABLED: STT is now handled by alwaysListen singleton
          console.log("[App] stop_listening event - STT handled by alwaysListen singleton");
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
      cleanupFns.forEach(fn => fn());
      // Only destroy voice controller if it was initialized
      const permissionDenied = sessionStorage.getItem('mic_permission_denied') === 'true';
      if (!permissionDenied) {
        voiceController.destroy();
      }
    };
  }, []); // Empty dependency array - run once on mount
  
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
      <ErrorBoundary name="VoiceInitializer" fallback={<div />}>
        <EnhancedVoiceInitializer 
          onInitializeWithGesture={(fn) => setInitializeWithGesture(() => fn)}
        />
      </ErrorBoundary>
      
      {/* HeaderCompact removed - was covering settings banners */}
      {/* <ErrorBoundary name="HeaderCompact" fallback={<div className="p-2 text-center">Header unavailable</div>}>
        <Suspense fallback={<div className="p-2 text-center">Loading header...</div>}>
          <HeaderCompact />
        </Suspense>
      </ErrorBoundary> */}
      
      {/* Conditionally render HeaderBar when mode is "header" (legacy support) */}
      {mode === "header" && FEATURES.LEGACY_HEADER && (
        <ErrorBoundary name="HeaderBar" fallback={null}>
          <Suspense fallback={null}>
            <HeaderBar />
          </Suspense>
        </ErrorBoundary>
      )}
      
      {/* Conditionally render HologramSphere when mode is "sphere" */}
      {mode === "sphere" && (
        <ErrorBoundary name="HologramSphere" fallback={<div className="p-4 text-center">Hologram unavailable</div>}>
          <Suspense fallback={<div className="p-4 text-center">Loading hologram...</div>}>
            <HologramSphere state="idle" />
          </Suspense>
        </ErrorBoundary>
      )}
      
      {/* Always show UiModeSwitch if the feature flag is enabled */}
      {FEATURES.UI_MODE_TOGGLE && (
        <ErrorBoundary name="UiModeSwitch" fallback={null}>
          <Suspense fallback={null}>
            <UiModeSwitch />
          </Suspense>
        </ErrorBoundary>
      )}
      
      {/* Status dock for legacy UI */}
      {!FEATURES.HANDS_FREE_UI && (
        <ErrorBoundary name="StatusDock" fallback={<div className="fixed top-0 w-full p-2 text-center">Status unavailable</div>}>
          <Suspense fallback={<div className="fixed top-0 w-full p-2 text-center">Loading status...</div>}>
            <StatusDockWrapper />
          </Suspense>
        </ErrorBoundary>
      )}
      
      <Toaster />
      
      <ErrorBoundary name="Router" fallback={<div className="p-4 text-center">Navigation error</div>}>
        <Router />
      </ErrorBoundary>
      
      {/* Use ChatInputBar instead of AskBar - sticky bottom with better mobile support */}
      <ErrorBoundary name="ChatInputBar" fallback={<div className="fixed bottom-0 w-full p-4 bg-gray-100">Chat input unavailable</div>}>
        <Suspense fallback={<div className="fixed bottom-0 w-full p-4 bg-gray-100">Loading chat...</div>}>
          <ChatInputBar 
            placeholder="Type a message or tap mic to speak..."
            initializeWithGesture={initializeWithGesture}
          />
        </Suspense>
      </ErrorBoundary>
      
      {/* iOS Audio Unlock button */}
      <ErrorBoundary name="AudioUnlock" fallback={null}>
        <Suspense fallback={null}>
          <AudioUnlock />
        </Suspense>
      </ErrorBoundary>
      
      {/* Debug Overlay - shows Gate state and more */}
      <ErrorBoundary name="DebugOverlay" fallback={null}>
        <Suspense fallback={null}>
          <DebugOverlay />
        </Suspense>
      </ErrorBoundary>
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