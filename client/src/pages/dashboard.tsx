import VoiceControls from "@/components/VoiceControls";
import HandsFreeMode from "@/components/HandsFreeMode";
import VoiceRouteSelector from "@/components/VoiceRouteSelector";
import AccentEmulator from "@/components/AccentEmulator";
import VoiceScanner from "@/components/VoiceScanner";
import TextToSpeech from "@/components/TextToSpeech";
import HolographicInterface from "@/components/HolographicInterface";
import CuriosityEngine from "@/components/CuriosityEngine";
import Chat from "@/components/Chat";
import { SystemDiagnostics } from "@/components/SystemDiagnostics";
import VoiceProfiles from "@/components/VoiceProfiles";
import { useQuery } from "@tanstack/react-query";
import { FEATURES } from "@/config/features";
import type { SystemSettings } from "@shared/schema";

export default function Dashboard() {
  // Load system settings
  const { data: settingsData } = useQuery({
    queryKey: ["/api/settings"],
  });

  const settings = (settingsData as any)?.settings as SystemSettings | undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mt-4 sm:mt-8 lg:mt-16">
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Left Column - Main Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chat Interface - Prominent Position */}
            <Chat />
            {FEATURES.HANDS_FREE_UI && <HandsFreeMode />}
            {FEATURES.HANDS_FREE_UI && <VoiceControls />}
            <VoiceRouteSelector />
            <AccentEmulator />
            <VoiceScanner />
            <VoiceProfiles />
            <TextToSpeech />
          </div>

          {/* Right Column - Hologram & Advanced */}
          <div className="space-y-6">
            <HolographicInterface />
            <CuriosityEngine />
            <SystemDiagnostics />
          </div>
        </div>
      </div>

    </div>
  );
}
