import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Voice } from "@/lib/voiceController";

// HMR-safe initialization - prevents duplicate listeners
if (!(window as any).__voice_bootstrapped__) {
  (window as any).__voice_bootstrapped__ = true;
  // Initialize voice system once
  Voice.startListening().catch(console.error);
}

createRoot(document.getElementById("root")!).render(<App />);
