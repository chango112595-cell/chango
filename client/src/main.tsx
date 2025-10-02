import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Voice } from "@/lib/voiceController";
import "./app/initHealthMonitor";

// Import test utilities for browser console testing
if (import.meta.env.DEV) {
  import("./testChatIntegration").then(() => {
    console.log("[Test] Chat integration test utilities loaded");
  });
  
  import("./testDateIntent").then(() => {
    console.log("[Test] Date intent test utilities loaded - run testDateIntent() to test");
  });
  
  import("./testChatFlow").then(() => {
    console.log("[Test] Chat flow debug utilities loaded - run testChatFlow() to test");
  });
  
  import("./testDirectMessage").then(() => {
    console.log("[Test] Direct message test loaded");
  });
  
  import("./autoDiagnostic").then(() => {
    console.log("[Diagnostic] Auto-diagnostic loaded");
  });
  
  import("./testDebugOverlay").then(() => {
    console.log("[Test] DebugOverlay test utilities loaded");
  });
}

// Bootstrap is now handled by the App component to avoid duplicate initialization

createRoot(document.getElementById("root")!).render(<App />);
