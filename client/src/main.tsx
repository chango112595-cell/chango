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
