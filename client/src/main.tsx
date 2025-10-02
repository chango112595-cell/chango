import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Voice } from "@/lib/voiceController";

// Import test utilities for browser console testing
if (import.meta.env.DEV) {
  import("./testChatIntegration").then(() => {
    console.log("[Test] Chat integration test utilities loaded");
  });
}

// HMR-safe initialization - prevents duplicate listeners
if (!(window as any).__voice_bootstrapped__) {
  (window as any).__voice_bootstrapped__ = true;
  // Initialize voice system once
  Voice.startListening().catch(console.error);
}

createRoot(document.getElementById("root")!).render(<App />);
