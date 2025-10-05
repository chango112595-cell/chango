import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Voice } from "@/lib/voiceController";
import "./app/initHealthMonitor";
import { startDiagRunner, attachDiagNotifier } from "./diag";

// Test utilities have been moved to client/tests/ directory
// They should not be imported in production code
if (import.meta.env.DEV) {
  // Expose test modules first
  import("./tests/exposeTestModules").then(() => {
    console.log("[Tests] Test modules exposed to window");
  });
  
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
  
  // Load comprehensive pipeline test
  import("./tests/comprehensivePipelineTest").then(() => {
    console.log("[Tests] Comprehensive pipeline test loaded");
  });
  
  // Load pipeline test runner (auto-runs test)
  import("./tests/runPipelineTest").then(() => {
    console.log("[Tests] Pipeline test runner loaded - auto-test will start");
  });
  
  // Load manual pipeline test (more comprehensive)
  import("./tests/manualPipelineTest").then(() => {
    console.log("[Tests] Manual pipeline test loaded - will auto-run");
  });
  
  // Load GlobalMonitor tests
  import("./tests/testGlobalMonitor").then(() => {
    console.log("[Tests] GlobalMonitor test suite loaded");
  });
  
  import("./tests/browserGlobalMonitorTest").then(() => {
    console.log("[Tests] Browser GlobalMonitor test loaded - run with: testGlobalMonitor()");
  });
  
  // Load typed message fix test
  import("./tests/inlineTypedMessageTest").then(() => {
    console.log("[Tests] Typed message fix test loaded - auto-running");
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
