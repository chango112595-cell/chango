import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mic, Volume2, Settings, Zap, Cloud, Server, User } from "lucide-react";

interface RouteStatus {
  enabled: boolean;
  healthy: boolean;
  note: string;
}

interface DiagnosticsData {
  routes: {
    client: RouteStatus;
    local_neural: RouteStatus;
    elevenlabs: RouteStatus;
    azure: RouteStatus;
  };
}

type TTSRoute = "client" | "local_neural" | "elevenlabs" | "azure";

export default function VoiceRouteSelector() {
  const [selectedRoute, setSelectedRoute] = useState<TTSRoute>("client");
  const [testText, setTestText] = useState("Hello, this is a test of the voice synthesis system.");
  const { toast } = useToast();

  // Get route status from diagnostics
  const { data: diagnostics } = useQuery<DiagnosticsData>({
    queryKey: ["/api/diagnostics"],
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const routes = diagnostics?.routes || {
    client: { enabled: true, healthy: true, note: 'WebSpeech (browser)' },
    local_neural: { enabled: false, healthy: false, note: 'planned' },
    elevenlabs: { enabled: false, healthy: false, note: 'no key' },
    azure: { enabled: false, healthy: false, note: 'no key' }
  };

  // Test synthesis mutation
  const testMutation = useMutation({
    mutationFn: async (route: TTSRoute) => {
      const response = await apiRequest("POST", "/api/tts/synthesize", {
        text: testText,
        route: route
      });

      return response;
    },
    onSuccess: (data: any, route) => {
      if (data && data.success) {
        toast({
          title: "Route Test Success",
          description: `${route.toUpperCase()}: ${data.message || 'Route is working correctly'}`,
        });
      } else {
        toast({
          title: "Route Test Complete",
          description: `${route.toUpperCase()} route responded.`,
        });
      }
    },
    onError: (error: any, route) => {
      toast({
        title: "Route Test Failed",
        description: `${route.toUpperCase()} route error: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const getRouteIcon = (route: TTSRoute) => {
    switch (route) {
      case "client":
        return <User className="h-4 w-4" />;
      case "local_neural":
        return <Server className="h-4 w-4" />;
      case "elevenlabs":
        return <Cloud className="h-4 w-4" />;
      case "azure":
        return <Zap className="h-4 w-4" />;
      default:
        return <Volume2 className="h-4 w-4" />;
    }
  };

  const getRouteDescription = (route: TTSRoute) => {
    switch (route) {
      case "client":
        return "Browser-based speech synthesis using Web Speech API";
      case "local_neural":
        return "Local neural TTS engine (coming soon)";
      case "elevenlabs":
        return "ElevenLabs professional AI voices with natural speech";
      case "azure":
        return "Microsoft Azure neural voices with SSML support";
      default:
        return "";
    }
  };

  const getStatusBadge = (routeData: RouteStatus) => {
    if (!routeData.enabled) {
      return <Badge variant="secondary" data-testid="status-disabled">Disabled</Badge>;
    }
    if (!routeData.healthy && routeData.enabled) {
      return <Badge variant="outline" data-testid="status-enabled">Available</Badge>;
    }
    return <Badge variant="default" className="bg-green-500" data-testid="status-ready">Ready</Badge>;
  };

  const isRouteSelectable = (route: TTSRoute) => {
    const routeData = routes[route];
    return routeData.enabled || route === "client";
  };

  return (
    <Card data-testid="card-voice-routes">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Voice Synthesis Routes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Route Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(routes).map(([route, status]) => (
            <div 
              key={route} 
              className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                selectedRoute === route ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              } ${!isRouteSelectable(route as TTSRoute) ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => isRouteSelectable(route as TTSRoute) && setSelectedRoute(route as TTSRoute)}
              data-testid={`route-card-${route}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getRouteIcon(route as TTSRoute)}
                  <span className="font-medium capitalize">{route.replace('_', ' ')}</span>
                </div>
                {getStatusBadge(status)}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {getRouteDescription(route as TTSRoute)}
              </p>
              <p className="text-xs text-muted-foreground">
                {status.note}
              </p>
            </div>
          ))}
        </div>

        <Separator />

        {/* Route Selection and Testing */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Active Route</label>
              <Select value={selectedRoute} onValueChange={(value: TTSRoute) => setSelectedRoute(value)}>
                <SelectTrigger data-testid="select-route">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(routes).map(([route, status]) => (
                    <SelectItem 
                      key={route} 
                      value={route}
                      disabled={!isRouteSelectable(route as TTSRoute)}
                      data-testid={`select-option-${route}`}
                    >
                      <div className="flex items-center gap-2">
                        {getRouteIcon(route as TTSRoute)}
                        <span className="capitalize">{route.replace('_', ' ')}</span>
                        {status.enabled && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {status.healthy ? 'Ready' : 'Available'}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => testMutation.mutate(selectedRoute)}
                disabled={testMutation.isPending || !isRouteSelectable(selectedRoute)}
                variant="outline"
                data-testid="button-test-route"
              >
                <Mic className="h-4 w-4 mr-2" />
                {testMutation.isPending ? "Testing..." : "Test Route"}
              </Button>
            </div>
          </div>

          {/* Route-specific Information */}
          {selectedRoute && routes[selectedRoute] && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {getRouteIcon(selectedRoute)}
                <h4 className="font-medium capitalize">{selectedRoute.replace('_', ' ')} Route</h4>
                {getStatusBadge(routes[selectedRoute])}
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {getRouteDescription(selectedRoute)}
              </p>

              {/* Route-specific configuration */}
              {selectedRoute === "client" && (
                <div className="text-sm">
                  <p className="text-green-600 font-medium">✓ No setup required</p>
                  <p className="text-muted-foreground">Uses your browser's built-in speech synthesis</p>
                </div>
              )}

              {selectedRoute === "elevenlabs" && !routes.elevenlabs.enabled && (
                <div className="text-sm">
                  <p className="text-amber-600 font-medium">⚠ API Key Required</p>
                  <p className="text-muted-foreground">Add ELEVENLABS_API_KEY to environment variables</p>
                </div>
              )}

              {selectedRoute === "azure" && !routes.azure.enabled && (
                <div className="text-sm">
                  <p className="text-amber-600 font-medium">⚠ Credentials Required</p>
                  <p className="text-muted-foreground">Add AZURE_TTS_KEY and AZURE_TTS_REGION to environment</p>
                </div>
              )}

              {selectedRoute === "local_neural" && (
                <div className="text-sm">
                  <p className="text-blue-600 font-medium">🚧 Coming Soon</p>
                  <p className="text-muted-foreground">Local neural TTS engine in development</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}