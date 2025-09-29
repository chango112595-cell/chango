import { Router, Request, Response, Application } from 'express';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Types for diagnostic responses
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
  regexp: string;
}

interface HealthCheck {
  ok: boolean;
  timestamp: string;
  timestamp_ms: number;
}

interface DiagnosticsResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Configuration
const LOG_DIR = path.join(process.cwd(), 'logs');
const DIAG_LOG_FILE = path.join(LOG_DIR, 'diag.log');

/**
 * Ensure log directory exists
 */
function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Log diagnostic requests to file
 */
function logRequest(endpoint: string, status: number, data?: any): void {
  ensureLogDir();
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    endpoint,
    status,
    data: data ? JSON.stringify(data).substring(0, 200) : undefined // Truncate large data
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  
  try {
    fs.appendFileSync(DIAG_LOG_FILE, logLine);
  } catch (error) {
    console.error('Failed to write to diagnostic log:', error);
  }
}

/**
 * Convert bytes to megabytes
 */
function bytesToMB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

/**
 * GET /api/diagnostics/sys
 * Return system metrics including memory, CPU, and uptime
 */
router.get('/diagnostics/sys', (req: Request, res: Response<DiagnosticsResponse<SystemMetrics>>) => {
  try {
    const memUsage = process.memoryUsage();
    
    const systemMetrics: SystemMetrics = {
      memory: {
        rss_mb: bytesToMB(memUsage.rss),
        heap_used_mb: bytesToMB(memUsage.heapUsed),
        heap_total_mb: bytesToMB(memUsage.heapTotal),
        external_mb: bytesToMB(memUsage.external)
      },
      cpu: {
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      },
      uptime: {
        process_seconds: Math.floor(process.uptime()),
        system_seconds: Math.floor(os.uptime())
      }
    };
    
    const response: DiagnosticsResponse<SystemMetrics> = {
      ok: true,
      data: systemMetrics,
      timestamp: new Date().toISOString()
    };
    
    logRequest('/api/diagnostics/sys', 200, systemMetrics);
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logRequest('/api/diagnostics/sys', 500, { error: errorMessage });
    
    res.status(500).json({
      ok: false,
      error: 'Failed to retrieve system metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/diagnostics/routes
 * Return list of registered routes
 */
router.get('/diagnostics/routes', (req: Request, res: Response<DiagnosticsResponse<RouteInfo[]>>) => {
  try {
    const routes: RouteInfo[] = [];
    const app = req.app;
    
    // Helper function to extract routes from a layer
    function extractRoutes(stack: any[], basePath: string = ''): void {
      stack.forEach((layer: any) => {
        if (layer.route) {
          // This is a route
          const methods = Object.keys(layer.route.methods).filter(method => layer.route.methods[method]);
          methods.forEach(method => {
            routes.push({
              method: method.toUpperCase(),
              path: basePath + layer.route.path,
              regexp: layer.regexp.toString()
            });
          });
        } else if (layer.name === 'router' && layer.handle.stack) {
          // This is a router middleware
          const routerPath = layer.regexp.source.match(/^\^\\(.*?)\$/) 
            ? '' 
            : layer.regexp.source.replace(/\\/g, '').replace(/\^/, '').replace(/\$.*/, '').replace(/\?.*/, '');
          extractRoutes(layer.handle.stack, basePath + routerPath);
        }
      });
    }
    
    // Extract routes from the main app
    if (app._router && app._router.stack) {
      extractRoutes(app._router.stack);
    }
    
    // Sort routes by path and method for better readability
    routes.sort((a, b) => {
      if (a.path !== b.path) {
        return a.path.localeCompare(b.path);
      }
      return a.method.localeCompare(b.method);
    });
    
    const response: DiagnosticsResponse<RouteInfo[]> = {
      ok: true,
      data: routes,
      timestamp: new Date().toISOString()
    };
    
    logRequest('/api/diagnostics/routes', 200, { count: routes.length });
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logRequest('/api/diagnostics/routes', 500, { error: errorMessage });
    
    res.status(500).json({
      ok: false,
      error: 'Failed to retrieve registered routes',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/diagnostics/ping
 * Basic health check endpoint
 */
router.get('/diagnostics/ping', (req: Request, res: Response<DiagnosticsResponse<HealthCheck>>) => {
  try {
    const healthCheck: HealthCheck = {
      ok: true,
      timestamp: new Date().toISOString(),
      timestamp_ms: Date.now()
    };
    
    const response: DiagnosticsResponse<HealthCheck> = {
      ok: true,
      data: healthCheck,
      timestamp: new Date().toISOString()
    };
    
    logRequest('/api/diagnostics/ping', 200);
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logRequest('/api/diagnostics/ping', 500, { error: errorMessage });
    
    res.status(500).json({
      ok: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;