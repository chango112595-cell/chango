import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { VoiceProfile, SystemSettings } from "@shared/schema";

export default function SystemStats() {
  // Load system data
  const { data: profilesData } = useQuery({
    queryKey: ["/api/voice-profiles"],
  });

  const { data: settingsData } = useQuery({
    queryKey: ["/api/settings"],
  });

  const profiles = ((profilesData as any)?.profiles || []) as VoiceProfile[];
  const settings = (settingsData as any)?.settings as SystemSettings | undefined;

  // Mock system stats (in a real app, these would come from server metrics)
  const systemStats = {
    memoryUsage: "245 MB",
    sessionTime: "1h 23m",
    lastSynthesis: "2 minutes ago",
    version: "v1.2.0",
  };

  const getRouteStatus = (route: string) => {
    switch (route) {
      case "client":
        return { status: "online", label: "Online" };
      case "local_neural":
        return { status: "processing", label: "Loading" };
      case "elevenlabs":
        return import.meta.env.VITE_ELEVENLABS_API_KEY 
          ? { status: "online", label: "Ready" }
          : { status: "offline", label: "No Key" };
      case "azure":
        return (import.meta.env.VITE_AZURE_TTS_KEY && import.meta.env.VITE_AZURE_TTS_REGION)
          ? { status: "online", label: "Ready" }
          : { status: "offline", label: "No Key" };
      default:
        return { status: "offline", label: "Unknown" };
    }
  };

  const voiceEngineStatus = getRouteStatus("client");
  const neuralTtsStatus = getRouteStatus("local_neural");

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Voice Engine</span>
            <div className="flex items-center space-x-2">
              <span className={`status-indicator status-${voiceEngineStatus.status}`}></span>
              <span className={`${
                voiceEngineStatus.status === 'online' ? 'text-green-400' : 
                voiceEngineStatus.status === 'processing' ? 'text-yellow-400' : 'text-red-400'
              }`} data-testid="text-voice-engine-status">
                {voiceEngineStatus.label}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>Neural TTS</span>
            <div className="flex items-center space-x-2">
              <span className={`status-indicator status-${neuralTtsStatus.status}`}></span>
              <span className={`${
                neuralTtsStatus.status === 'online' ? 'text-green-400' : 
                neuralTtsStatus.status === 'processing' ? 'text-yellow-400' : 'text-red-400'
              }`} data-testid="text-neural-tts-status">
                {neuralTtsStatus.label}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>Accent Profiles</span>
            <span className="text-muted-foreground" data-testid="text-accent-profiles-count">
              {profiles.length + 5} loaded {/* +5 for built-in profiles */}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>Current Theme</span>
            <span className="text-muted-foreground capitalize" data-testid="text-current-theme">
              {settings?.theme || 'classic'}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>TTS Route</span>
            <span className="text-muted-foreground capitalize" data-testid="text-current-tts-route">
              {settings?.currentTtsRoute || 'client'}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>Memory Usage</span>
            <span className="text-muted-foreground" data-testid="text-memory-usage">
              {systemStats.memoryUsage}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground space-y-1">
            <p data-testid="text-last-synthesis">Last synthesis: {systemStats.lastSynthesis}</p>
            <p data-testid="text-session-time">Session time: {systemStats.sessionTime}</p>
            <p data-testid="text-version">Version: {systemStats.version}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
