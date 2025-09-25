import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import VoiceControls from "@/components/VoiceControls";
import TTSRoutes from "@/components/TTSRoutes";
import AccentEmulator from "@/components/AccentEmulator";
import VoiceScanner from "@/components/VoiceScanner";
import TextToSpeech from "@/components/TextToSpeech";
import HolographicInterface from "@/components/HolographicInterface";
import CuriosityEngine from "@/components/CuriosityEngine";
import SystemStats from "@/components/SystemStats";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SystemSettings } from "@shared/schema";

export default function Dashboard() {
  const [theme, setTheme] = useState("classic");
  const queryClient = useQueryClient();

  // Load system settings
  const { data: settingsData } = useQuery({
    queryKey: ["/api/settings"],
  });

  const settings = (settingsData as any)?.settings as SystemSettings | undefined;

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<SystemSettings>) => {
      return apiRequest("POST", "/api/settings", newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  // Initialize theme from settings
  useEffect(() => {
    if (settings?.theme) {
      setTheme(settings.theme);
      document.body.classList.remove("theme-classic", "theme-hud");
      document.body.classList.add(`theme-${settings.theme}`);
    }
  }, [settings?.theme]);

  const toggleTheme = () => {
    const newTheme = theme === "classic" ? "hud" : "classic";
    setTheme(newTheme);
    
    document.body.classList.remove("theme-classic", "theme-hud");
    document.body.classList.add(`theme-${newTheme}`);
    
    updateSettingsMutation.mutate({ 
      userId: "default",
      theme: newTheme 
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">C</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">Chango AI</h1>
                <p className="text-sm text-muted-foreground">Advanced Voice Synthesis System</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="status-indicator status-online"></span>
                <span className="text-sm font-medium">System Online</span>
              </div>
              <Button 
                onClick={toggleTheme}
                variant="secondary"
                data-testid="button-theme-toggle"
              >
                {theme === "classic" ? "HUD Theme" : "Classic Theme"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Main Controls */}
          <div className="lg:col-span-2 space-y-6">
            <VoiceControls />
            <TTSRoutes />
            <AccentEmulator />
            <VoiceScanner />
            <TextToSpeech />
          </div>

          {/* Right Column - Hologram & Advanced */}
          <div className="space-y-6">
            <HolographicInterface />
            <CuriosityEngine />
            <SystemStats />
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          size="lg" 
          className="w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
          data-testid="button-quick-action"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
