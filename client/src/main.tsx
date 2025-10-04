import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Voice } from "@/lib/voiceController";
import "./app/initHealthMonitor";
import { startDiagRunner, attachDiagNotifier } from "./diag";

// Test utilities have been moved to client/tests/ directory
// They should not be imported in production code
if (import.meta.env.DEV) {
  import("./autoDiagnostic").then(() => {
    console.log("[Diagnostic] Auto-diagnostic loaded");
  });
  
  // Load conversation flow test and verification
  import("./tests/testConversationFlow").then(() => {
    console.log("[Tests] Conversation flow test loaded");
  });
  
  import("./tests/verifySetup").then(() => {
    console.log("[Tests] Setup verification loaded");
  });
  
  // Load and run conversation engine fix
  import("./tests/fixConversationEngine").then(() => {
    console.log("[Tests] Conversation engine fix loaded");
  });
}

// Start the diagnostic runner and attach notifiers
startDiagRunner();
attachDiagNotifier({
  speak: (s) => (window as any).__chango?.tts?.speak?.(s),
  toast: (s, sev) => (window as any).__chango?.ui?.toast?.(s, sev),
  log: console.log
});

// Bootstrap is now handled by the App component to avoid duplicate initialization

createRoot(document.getElementById("root")!).render(<App />);
