import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, Cpu, HardDrive, Clock, Wifi, Server, Zap } from "lucide-react";

interface DiagnosticsData {
  ok: boolean;
  env: {
    node: string;
    pid: number;
    uptime_s: number;
  };
  cpuLoad: number;
  mem: {
    free: number;
    total: number;
    rss: number;
  };
  loop: {
    lag_ms: number;
  };
  ffmpeg: string;
  routes: {
    client: { enabled: boolean; healthy: boolean; note: string };
    local_neural: { enabled: boolean; healthy: boolean; note: string };
    elevenlabs: { enabled: boolean; healthy: boolean; note: string };
    azure: { enabled: boolean; healthy: boolean; note: string };
  };
  selfPing: {
    ok: boolean;
    ms: number;
  };
  session: {
    start: number;
    ttsClientUtterances: number;
    profilesLearned: number;
    checkpointsMade: number;
  };
}

export function SystemDiagnostics() {
  const { data: diagnostics, isLoading } = useQuery<DiagnosticsData>({
    queryKey: ["/api/diagnostics"],
    refetchInterval: 3000, // Poll every 3 seconds
  });

  const formatBytes = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${Math.round(mb)} MB`;
  };

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const getStatusBadge = (enabled: boolean, healthy: boolean) => {
    if (!enabled) return <Badge variant="secondary" data-testid="status-disabled">Off</Badge>;
    if (!healthy) return <Badge variant="destructive" data-testid="status-unhealthy">Stub</Badge>;
    return <Badge variant="default" className="bg-green-500" data-testid="status-healthy">Ready</Badge>;
  };

  const getPingBadge = (ms: number, ok: boolean) => {
    if (!ok) return <Badge variant="destructive" data-testid="ping-failed">Failed</Badge>;
    if (ms < 50) return <Badge variant="default" className="bg-green-500" data-testid="ping-good">Good</Badge>;
    if (ms < 200) return <Badge variant="secondary" data-testid="ping-ok">OK</Badge>;
    return <Badge variant="destructive" data-testid="ping-slow">Slow</Badge>;
  };

  if (isLoading || !diagnostics) {
    return (
      <Card data-testid="card-diagnostics-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading diagnostics...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-diagnostics">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* System Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Uptime
            </div>
            <Badge variant="outline" data-testid="text-uptime">
              {formatUptime(diagnostics.env.uptime_s)}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Cpu className="h-4 w-4" />
              CPU Load
            </div>
            <Badge variant="outline" data-testid="text-cpu">
              {diagnostics.cpuLoad.toFixed(2)}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <HardDrive className="h-4 w-4" />
              Memory
            </div>
            <Badge variant="outline" data-testid="text-memory">
              {formatBytes(diagnostics.mem.rss)}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4" />
              Event Loop
            </div>
            <Badge variant="outline" data-testid="text-loop-lag">
              {diagnostics.loop.lag_ms.toFixed(1)}ms
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Server Info Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">Node.js</div>
            <Badge variant="outline" data-testid="text-node-version">
              {diagnostics.env.node}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="text-sm font-medium">FFmpeg</div>
            <Badge 
              variant={diagnostics.ffmpeg === 'available' ? 'default' : 'secondary'} 
              data-testid="text-ffmpeg"
            >
              {diagnostics.ffmpeg}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wifi className="h-4 w-4" />
              Self Ping
            </div>
            {getPingBadge(diagnostics.selfPing.ms, diagnostics.selfPing.ok)}
          </div>
          
          <div className="space-y-1">
            <div className="text-sm font-medium">Process ID</div>
            <Badge variant="outline" data-testid="text-pid">
              {diagnostics.env.pid}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* TTS Routes Status */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Server className="h-4 w-4" />
            <span className="font-medium">Voice Synthesis Routes</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-sm">CVE (Chango Voice Engine)</div>
              {getStatusBadge(true, true)}
              <div className="text-xs text-muted-foreground">Phrase-level synthesis active</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Session Analytics */}
        <div>
          <div className="font-medium mb-3">Session Analytics</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">TTS Utterances:</span>
              <div className="font-mono" data-testid="text-tts-count">{diagnostics.session.ttsClientUtterances}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Profiles Learned:</span>
              <div className="font-mono" data-testid="text-profiles-count">{diagnostics.session.profilesLearned}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Checkpoints:</span>
              <div className="font-mono" data-testid="text-checkpoints-count">{diagnostics.session.checkpointsMade}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}