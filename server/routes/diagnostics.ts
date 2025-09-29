import { Router, Request, Response, Application, NextFunction } from 'express';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore - JavaScript module
import metrics from '../diag/metrics.js';
import { zipPaths, getArchivePath } from '../utils/zip.js';

const router = Router();

// Start metrics collection when server starts
metrics.startMetrics();

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
  // regexp field removed for security
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

interface MetricsSnapshot {
  timestamp: string;
  timestamp_ms: number;
  memory: any;
  cpu: any;
  uptime: any;
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

// Configuration
const LOG_DIR = path.join(process.cwd(), 'logs');
const DIAG_LOG_FILE = path.join(LOG_DIR, 'diag.log');
const MAX_LOG_LINES = 1000;

/**
 * Authentication middleware for diagnostics endpoints
 */
function authenticateDiagnostics(req: Request, res: Response, next: NextFunction): void | Response {
  // Get token from environment
  const expectedToken = process.env.DIAGNOSTICS_TOKEN;
  
  // In development mode without token, allow access
  if (!expectedToken && process.env.NODE_ENV !== 'production') {
    return next();
  }
  
  // If token is set, require authentication
  if (expectedToken) {
    // Check query parameter
    const queryToken = req.query.token as string;
    
    // Check Authorization header
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : undefined;
    
    // Validate token
    if (queryToken === expectedToken || bearerToken === expectedToken) {
      return next();
    }
    
    // Token mismatch or missing
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized: Invalid or missing diagnostics token',
      timestamp: new Date().toISOString()
    });
  }
  
  // No token set but in production - deny access
  return res.status(401).json({
    ok: false,
    error: 'Unauthorized: Diagnostics access is disabled',
    timestamp: new Date().toISOString()
  });
}

/**
 * Ensure log directory exists
 */
async function ensureLogDir(): Promise<void> {
  try {
    await fs.promises.mkdir(LOG_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
}

/**
 * Rotate log file if it exceeds MAX_LOG_LINES
 */
async function rotateLogIfNeeded(): Promise<void> {
  try {
    const logContent = await fs.promises.readFile(DIAG_LOG_FILE, 'utf-8');
    const lines = logContent.split('\n').filter(line => line.trim());
    
    if (lines.length > MAX_LOG_LINES) {
      // Keep only the last MAX_LOG_LINES lines
      const newContent = lines.slice(-MAX_LOG_LINES).join('\n') + '\n';
      await fs.promises.writeFile(DIAG_LOG_FILE, newContent);
    }
  } catch (error) {
    // File might not exist yet, ignore
  }
}

/**
 * Log diagnostic requests to file (async)
 * Skip logging for ping requests to reduce noise
 */
async function logRequest(endpoint: string, status: number, data?: any): Promise<void> {
  // Skip logging for frequent ping requests
  if (endpoint === '/api/diagnostics/ping') {
    return;
  }
  
  await ensureLogDir();
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    endpoint,
    status,
    data: data ? JSON.stringify(data).substring(0, 200) : undefined // Truncate large data
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  
  try {
    await fs.promises.appendFile(DIAG_LOG_FILE, logLine);
    await rotateLogIfNeeded();
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
router.get('/diagnostics/sys', authenticateDiagnostics, async (req: Request, res: Response<DiagnosticsResponse<SystemMetrics>>) => {
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
    
    await logRequest('/api/diagnostics/sys', 200, systemMetrics);
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logRequest('/api/diagnostics/sys', 500, { error: errorMessage });
    
    res.status(500).json({
      ok: false,
      error: 'Failed to retrieve system metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/diagnostics/routes
 * Return list of registered routes (without sensitive regexp info)
 */
router.get('/diagnostics/routes', authenticateDiagnostics, async (req: Request, res: Response<DiagnosticsResponse<RouteInfo[]>>) => {
  try {
    const routes: RouteInfo[] = [];
    const app = req.app;
    
    // Helper function to extract routes from a layer
    const extractRoutes = (stack: any[], basePath: string = ''): void => {
      stack.forEach((layer: any) => {
        if (layer.route) {
          // This is a route
          const methods = Object.keys(layer.route.methods).filter(method => layer.route.methods[method]);
          methods.forEach(method => {
            routes.push({
              method: method.toUpperCase(),
              path: basePath + layer.route.path
              // regexp field removed for security - it reveals internal patterns
            });
          });
        } else if (layer.name === 'router' && layer.handle.stack) {
          // This is a router middleware
          // Extract path without exposing the regexp
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
    
    await logRequest('/api/diagnostics/routes', 200, { count: routes.length });
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logRequest('/api/diagnostics/routes', 500, { error: errorMessage });
    
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
router.get('/diagnostics/ping', authenticateDiagnostics, async (req: Request, res: Response<DiagnosticsResponse<HealthCheck>>) => {
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
    
    // Ping requests are not logged to reduce noise
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Even errors from ping are not logged
    
    res.status(500).json({
      ok: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/diagnostics/metrics/snapshot
 * Get snapshot of last ~180 data points (15 minutes at 5-second intervals)
 */
router.get('/diagnostics/metrics/snapshot', authenticateDiagnostics, async (req: Request, res: Response<DiagnosticsResponse<MetricsSnapshot[]>>) => {
  try {
    // Get last 180 metrics points
    const snapshot = await metrics.readTail(180);
    
    const response: DiagnosticsResponse<MetricsSnapshot[]> = {
      ok: true,
      data: snapshot,
      timestamp: new Date().toISOString()
    };
    
    await logRequest('/api/diagnostics/metrics/snapshot', 200, { count: snapshot.length });
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logRequest('/api/diagnostics/metrics/snapshot', 500, { error: errorMessage });
    
    res.status(500).json({
      ok: false,
      error: 'Failed to retrieve metrics snapshot',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/diagnostics/metrics/files
 * List all saved metrics files
 */
router.get('/diagnostics/metrics/files', authenticateDiagnostics, async (req: Request, res: Response<DiagnosticsResponse<MetricsFile[]>>) => {
  try {
    const files = await metrics.listFiles();
    
    const response: DiagnosticsResponse<MetricsFile[]> = {
      ok: true,
      data: files,
      timestamp: new Date().toISOString()
    };
    
    await logRequest('/api/diagnostics/metrics/files', 200, { count: files.length });
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logRequest('/api/diagnostics/metrics/files', 500, { error: errorMessage });
    
    res.status(500).json({
      ok: false,
      error: 'Failed to list metrics files',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/diagnostics/metrics/export
 * Export all metrics as a ZIP file
 */
router.get('/diagnostics/metrics/export', authenticateDiagnostics, async (req: Request, res: Response) => {
  try {
    // Get all metrics files
    const metricsFiles = await metrics.getMetricsFilesForExport();
    
    if (metricsFiles.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'No metrics files found to export',
        timestamp: new Date().toISOString()
      });
    }
    
    // Create temp directory for the export
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const zipFilename = `metrics-export-${timestamp}.zip`;
    const zipPath = path.join(tempDir, zipFilename);
    
    // Create ZIP archive
    await zipPaths(zipPath, metricsFiles);
    
    // Get the actual archive path (could be .zip or .tar.gz)
    const actualPath = getArchivePath(zipPath);
    if (!actualPath) {
      throw new Error('Failed to create archive');
    }
    
    const actualFilename = path.basename(actualPath);
    
    // Send file to client
    res.download(actualPath, actualFilename, async (err) => {
      // Clean up temp file after download
      try {
        await fs.promises.unlink(actualPath);
      } catch (cleanupError) {
        console.error('Failed to clean up temp file:', cleanupError);
      }
      
      if (err) {
        console.error('Failed to send metrics export:', err);
      }
    });
    
    await logRequest('/api/diagnostics/metrics/export', 200, { files: metricsFiles.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logRequest('/api/diagnostics/metrics/export', 500, { error: errorMessage });
    
    res.status(500).json({
      ok: false,
      error: 'Failed to export metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/diagnostics/metrics/current
 * Get current metrics sample
 */
router.get('/diagnostics/metrics/current', authenticateDiagnostics, async (req: Request, res: Response<DiagnosticsResponse<MetricsSnapshot>>) => {
  try {
    const currentMetrics = metrics.sampleOnce();
    
    const response: DiagnosticsResponse<MetricsSnapshot> = {
      ok: true,
      data: currentMetrics,
      timestamp: new Date().toISOString()
    };
    
    await logRequest('/api/diagnostics/metrics/current', 200);
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logRequest('/api/diagnostics/metrics/current', 500, { error: errorMessage });
    
    res.status(500).json({
      ok: false,
      error: 'Failed to sample current metrics',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;