import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Activity, Cpu, HardDrive, Clock, Wifi, Server, Zap, ChevronDown, ChevronUp, LineChart, BarChart3, Route, Download, FileText, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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

interface SystemMetrics {
  memory: {
    rss_mb: number;
    heap_used_mb: number;
    heap_total_mb: number;
    external_mb: number;
  };
  cpu: {
    loadAverage: number[];
    cores: number;
  };
  uptime: {
    process_seconds: number;
    system_seconds: number;
  };
}

interface RouteInfo {
  method: string;
  path: string;
  // regexp field removed for security
}

interface HealthCheck {
  ok: boolean;
  timestamp: string;
  timestamp_ms: number;
}

interface MetricsSnapshot {
  timestamp: string;
  timestamp_ms: number;
  memory: {
    process: {
      rss_mb: number;
      heap_used_mb: number;
      heap_total_mb: number;
      external_mb: number;
      array_buffers_mb: number;
    };
    system: {
      total_mb: number;
      free_mb: number;
      used_mb: number;
      usage_percent: number;
    };
  };
  cpu: {
    usage_percent: number;
    load_average: {
      '1min': number;
      '5min': number;
      '15min': number;
    };
    cores: number;
  };
  uptime: {
    process_seconds: number;
    system_seconds: number;
  };
  pid: number;
  platform: string;
  node_version: string;
}

interface MetricsFile {
  filename: string;
  size_bytes: number;
  size_mb: number;
  modified: string;
  created: string;
}

export function SystemDiagnostics() {
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [routesOpen, setRoutesOpen] = useState(false);
  const [metricsFilesOpen, setMetricsFilesOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const memoryChartRef = useRef<HTMLCanvasElement>(null);
  const cpuChartRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  
  // Get diagnostics token from environment if available
  const diagToken = import.meta.env.VITE_DIAGNOSTICS_TOKEN;
  
  // Create custom query function that includes token if available
  const fetchWithToken = async (url: string) => {
    const urlWithToken = diagToken ? `${url}?token=${encodeURIComponent(diagToken)}` : url;
    const response = await fetch(urlWithToken, { credentials: "include" });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  };
  
  // Legacy diagnostics endpoint (for session analytics)
  const { data: diagnostics, isLoading } = useQuery<DiagnosticsData>({
    queryKey: ["/api/diagnostics"],
    queryFn: () => fetchWithToken("/api/diagnostics"),
    refetchInterval: 3000, // Poll every 3 seconds
  });
  
  // New system metrics endpoint
  const { data: systemMetrics } = useQuery<{ ok: boolean; data: SystemMetrics }>({
    queryKey: ["/api/diagnostics/sys"],
    queryFn: () => fetchWithToken("/api/diagnostics/sys"),
    refetchInterval: 3000,
  });
  
  // Routes endpoint
  const { data: routesData } = useQuery<{ ok: boolean; data: RouteInfo[] }>({
    queryKey: ["/api/diagnostics/routes"],
    queryFn: () => fetchWithToken("/api/diagnostics/routes"),
    refetchInterval: 30000, // Less frequent for routes
  });
  
  // Ping endpoint
  const { data: pingData } = useQuery<{ ok: boolean; data: HealthCheck }>({
    queryKey: ["/api/diagnostics/ping"],
    queryFn: () => fetchWithToken("/api/diagnostics/ping"),
    refetchInterval: 3000,
  });
  
  // Metrics snapshot endpoint (last ~180 points)
  const { data: metricsSnapshot } = useQuery<{ ok: boolean; data: MetricsSnapshot[] }>({
    queryKey: ["/api/diagnostics/metrics/snapshot"],
    queryFn: () => fetchWithToken("/api/diagnostics/metrics/snapshot"),
    refetchInterval: 5000, // Poll every 5 seconds (matches metrics collection rate)
  });
  
  // Metrics files list
  const { data: metricsFiles } = useQuery<{ ok: boolean; data: MetricsFile[] }>({
    queryKey: ["/api/diagnostics/metrics/files"],
    queryFn: () => fetchWithToken("/api/diagnostics/metrics/files"),
    refetchInterval: 30000, // Less frequent for file list
  });

  // Update memory and CPU history from metrics snapshot
  useEffect(() => {
    if (metricsSnapshot?.data && metricsSnapshot.data.length > 0) {
      // Extract memory history from snapshot
      const memHistory = metricsSnapshot.data.map(m => m.memory.process.heap_used_mb);
      setMemoryHistory(memHistory);
      
      // Extract CPU history from snapshot
      const cpuHist = metricsSnapshot.data.map(m => m.cpu.usage_percent);
      setCpuHistory(cpuHist);
    }
  }, [metricsSnapshot]);
  
  // Export metrics handler
  const handleExportMetrics = async () => {
    setIsExporting(true);
    try {
      const urlWithToken = diagToken 
        ? `/api/diagnostics/metrics/export?token=${encodeURIComponent(diagToken)}`
        : `/api/diagnostics/metrics/export`;
      
      const response = await fetch(urlWithToken, { credentials: "include" });
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('content-disposition');
      const filenameMatch = contentDisposition?.match(/filename="?(.+?)"?(?:;|$)/);
      const filename = filenameMatch ? filenameMatch[1] : 'metrics-export.zip';
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: `Metrics exported as ${filename}`,
      });
    } catch (error) {
      console.error('Failed to export metrics:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export metrics",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  // Draw memory chart
  useEffect(() => {
    if (!memoryChartRef.current || memoryHistory.length === 0) return;
    
    const canvas = memoryChartRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 150;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid lines
    ctx.strokeStyle = '#e5e5e5';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = (canvas.height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Calculate chart dimensions
    const padding = 10;
    const chartWidth = canvas.width - 2 * padding;
    const chartHeight = canvas.height - 2 * padding;
    const maxMemory = Math.max(...memoryHistory, 100);
    const pointSpacing = chartWidth / (59); // 60 points max
    
    // Draw line chart
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    memoryHistory.forEach((value, index) => {
      const x = padding + (index * pointSpacing);
      const y = padding + chartHeight - (value / maxMemory) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw data points
    ctx.fillStyle = '#3b82f6';
    memoryHistory.forEach((value, index) => {
      const x = padding + (index * pointSpacing);
      const y = padding + chartHeight - (value / maxMemory) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // Draw labels
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.fillText('0 MB', 2, canvas.height - 2);
    ctx.fillText(`${Math.round(maxMemory)} MB`, 2, 12);
  }, [memoryHistory]);
  
  // Draw CPU chart
  useEffect(() => {
    if (!cpuChartRef.current || !systemMetrics?.data?.cpu) return;
    
    const canvas = cpuChartRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 100;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const loadAverage = systemMetrics.data.cpu.loadAverage;
    const cores = systemMetrics.data.cpu.cores;
    const barWidth = canvas.width / 4;
    const maxLoad = Math.max(...loadAverage, cores);
    
    // Draw bars for 1min, 5min, 15min load averages
    const labels = ['1 min', '5 min', '15 min'];
    loadAverage.forEach((load, index) => {
      const x = (index * barWidth) + barWidth / 4;
      const barHeight = (load / maxLoad) * (canvas.height - 30);
      const y = canvas.height - barHeight - 20;
      
      // Color based on load vs cores
      const loadRatio = load / cores;
      let color = '#22c55e'; // Green
      if (loadRatio > 1) {
        color = '#ef4444'; // Red
      } else if (loadRatio > 0.7) {
        color = '#f59e0b'; // Orange
      }
      
      // Draw bar
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth / 2, barHeight);
      
      // Draw value
      ctx.fillStyle = '#333';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(load.toFixed(2), x + barWidth / 4, y - 5);
      
      // Draw label
      ctx.fillText(labels[index], x + barWidth / 4, canvas.height - 5);
    });
    
    // Draw reference line for number of cores
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    const coreLineY = canvas.height - 20 - (cores / maxLoad) * (canvas.height - 30);
    ctx.beginPath();
    ctx.moveTo(0, coreLineY);
    ctx.lineTo(canvas.width * 0.75, coreLineY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw cores label
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${cores} cores`, canvas.width - 5, coreLineY - 3);
  }, [systemMetrics]);
  
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
  
  // Calculate ping time from timestamp if available
  const calculatePingMs = () => {
    if (pingData?.data?.timestamp_ms) {
      return Date.now() - pingData.data.timestamp_ms;
    }
    return 0;
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
        {/* Memory Usage Chart */}
        {systemMetrics?.data && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <LineChart className="h-4 w-4" />
              <span className="font-medium">Memory Usage Over Time</span>
              <Badge variant="outline" className="ml-auto" data-testid="text-current-memory">
                {systemMetrics.data.memory.heap_used_mb.toFixed(1)} MB
              </Badge>
            </div>
            <canvas 
              ref={memoryChartRef} 
              className="w-full border rounded" 
              data-testid="canvas-memory-chart"
            />
            <div className="text-xs text-muted-foreground mt-1">
              Heap Used (Last {memoryHistory.length} samples, 5s intervals)
            </div>
          </div>
        )}

        <Separator />

        {/* CPU Load Average Bars */}
        {systemMetrics?.data && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4" />
              <span className="font-medium">CPU Load Average</span>
              <Badge variant="outline" className="ml-auto" data-testid="text-cpu-cores">
                {systemMetrics.data.cpu.cores} cores
              </Badge>
            </div>
            <canvas 
              ref={cpuChartRef} 
              className="w-full border rounded" 
              data-testid="canvas-cpu-chart"
            />
          </div>
        )}

        <Separator />
        
        {/* System Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Uptime
            </div>
            <Badge variant="outline" data-testid="text-uptime">
              {systemMetrics?.data ? formatUptime(systemMetrics.data.uptime.process_seconds) : formatUptime(diagnostics.env.uptime_s)}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Cpu className="h-4 w-4" />
              CPU Load
            </div>
            <Badge variant="outline" data-testid="text-cpu">
              {systemMetrics?.data ? systemMetrics.data.cpu.loadAverage[0].toFixed(2) : diagnostics.cpuLoad.toFixed(2)}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <HardDrive className="h-4 w-4" />
              Memory RSS
            </div>
            <Badge variant="outline" data-testid="text-memory">
              {systemMetrics?.data ? `${systemMetrics.data.memory.rss_mb.toFixed(0)} MB` : formatBytes(diagnostics.mem.rss)}
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
              Ping Status
            </div>
            {pingData?.data ? 
              getPingBadge(calculatePingMs(), pingData.data.ok) : 
              getPingBadge(diagnostics.selfPing.ms, diagnostics.selfPing.ok)
            }
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
        
        {/* Metrics Management Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="font-medium">Metrics Management</span>
            </div>
            <Button
              size="sm"
              onClick={handleExportMetrics}
              disabled={isExporting || !metricsFiles?.data?.length}
              data-testid="button-export-metrics"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export metrics.zip
                </>
              )}
            </Button>
          </div>
          
          {/* Metrics Files List (Collapsible) */}
          {metricsFiles?.data && metricsFiles.data.length > 0 && (
            <Collapsible open={metricsFilesOpen} onOpenChange={setMetricsFilesOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between p-2 h-auto hover:bg-muted/50"
                  data-testid="button-toggle-metrics-files"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm">Saved Metrics Files</span>
                    <Badge variant="outline" className="text-xs" data-testid="text-metrics-file-count">
                      {metricsFiles.data.length} files
                    </Badge>
                  </div>
                  {metricsFilesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="max-h-40 overflow-y-auto space-y-1 pl-4" data-testid="container-metrics-files-list">
                  {metricsFiles.data.map((file, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/50"
                      data-testid={`metrics-file-item-${index}`}
                    >
                      <span className="font-mono" data-testid={`metrics-filename-${index}`}>
                        {file.filename}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs" data-testid={`metrics-size-${index}`}>
                          {file.size_mb.toFixed(2)} MB
                        </Badge>
                        <span className="text-muted-foreground" data-testid={`metrics-modified-${index}`}>
                          {new Date(file.modified).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
          
          {(!metricsFiles?.data || metricsFiles.data.length === 0) && (
            <div className="text-xs text-muted-foreground pl-2">
              No metrics files available yet. Metrics are collected every 5 seconds.
            </div>
          )}
        </div>

        <Separator />

        {/* Registered Routes (Collapsible) */}
        {routesData?.data && (
          <>
            <Collapsible open={routesOpen} onOpenChange={setRoutesOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between p-0 h-auto hover:bg-transparent"
                  data-testid="button-toggle-routes"
                >
                  <div className="flex items-center gap-2">
                    <Route className="h-4 w-4" />
                    <span className="font-medium">Registered Routes</span>
                    <Badge variant="outline" data-testid="text-route-count">
                      {routesData.data.length} routes
                    </Badge>
                  </div>
                  {routesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="max-h-60 overflow-y-auto space-y-1" data-testid="container-routes-list">
                  {routesData.data.map((route, index) => (
                    <div 
                      key={index} 
                      className="flex items-center gap-2 text-xs font-mono py-1 px-2 rounded hover:bg-muted/50"
                      data-testid={`route-item-${index}`}
                    >
                      <Badge 
                        variant={route.method === 'GET' ? 'secondary' : 'default'}
                        className="text-xs"
                        data-testid={`route-method-${index}`}
                      >
                        {route.method}
                      </Badge>
                      <span className="flex-1" data-testid={`route-path-${index}`}>{route.path}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
            <Separator />
          </>
        )}

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