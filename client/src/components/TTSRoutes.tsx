import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TTSRoute = "client" | "local_neural" | "elevenlabs" | "azure";

export default function TTSRoutes() {
  const [activeRoute, setActiveRoute] = useState<TTSRoute>("client");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateSettingsMutation = useMutation({
    mutationFn: async (route: TTSRoute) => {
      return apiRequest("POST", "/api/settings", {
        userId: "default",
        currentTtsRoute: route
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  const handleRouteChange = (route: TTSRoute) => {
    setActiveRoute(route);
    updateSettingsMutation.mutate(route);
    
    toast({
      title: "TTS Route Changed",
      description: `Switched to ${route} synthesis route`,
    });
  };

  const routes: { id: TTSRoute; label: string; available: boolean }[] = [
    { id: "client", label: "Client", available: true },
    { id: "local_neural", label: "Local Neural", available: false },
    { id: "elevenlabs", label: "ElevenLabs", available: !!import.meta.env.VITE_ELEVENLABS_API_KEY },
    { id: "azure", label: "Azure", available: !!(import.meta.env.VITE_AZURE_TTS_KEY && import.meta.env.VITE_AZURE_TTS_REGION) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>TTS Routes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {routes.map((route) => (
            <Button
              key={route.id}
              onClick={() => handleRouteChange(route.id)}
              variant={activeRoute === route.id ? "default" : "secondary"}
              disabled={!route.available}
              data-testid={`button-tts-${route.id}`}
            >
              {route.label}
              {!route.available && (
                <span className="ml-2 text-xs opacity-60">(N/A)</span>
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
