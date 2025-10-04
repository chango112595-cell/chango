import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Configuration
const METRICS_DIR = path.join(process.cwd(), 'data', 'metrics');
const SAMPLE_INTERVAL_MS = 5000; // 5 seconds
const MAX_TAIL_LINES = 180; // ~15 minutes of data at 5s intervals

// Global state
let samplingInterval = null;
let lastSampleTime = 0;

/**
 * Ensure metrics directory exists
 */
async function ensureMetricsDir() {
  try {
    await fs.promises.mkdir(METRICS_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create metrics directory:', error);
  }
}

/**
 * Get the filename for today's metrics file
 */
function getTodayMetricsFile() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const filename = `metrics-${year}${month}${day}.jsonl`;
  return path.join(METRICS_DIR, filename);
}

/**
 * Convert bytes to megabytes
 */
function bytesToMB(bytes) {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

/**
 * Get current CPU usage percentage (approximation)
 */
function getCPUUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - ~~(100 * idle / total);
  
  return {
    percentage: Math.max(0, Math.min(100, usage)),
    loadAverage: os.loadavg(),
    cores: cpus.length
  };
}

/**
 * Sample system metrics once
 * @returns {Object} Metrics snapshot
 */
export function sampleOnce() {
  const memUsage = process.memoryUsage();
  const cpuInfo = getCPUUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  
  return {
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    memory: {
      process: {
        rss_mb: bytesToMB(memUsage.rss),
        heap_used_mb: bytesToMB(memUsage.heapUsed),
        heap_total_mb: bytesToMB(memUsage.heapTotal),
        external_mb: bytesToMB(memUsage.external),
        array_buffers_mb: bytesToMB(memUsage.arrayBuffers || 0)
      },
      system: {
        total_mb: bytesToMB(totalMem),
        free_mb: bytesToMB(freeMem),
        used_mb: bytesToMB(totalMem - freeMem),
        usage_percent: Math.round(((totalMem - freeMem) / totalMem) * 100)
      }
    },
    cpu: {
      usage_percent: cpuInfo.percentage,
      load_average: {
        '1min': cpuInfo.loadAverage[0],
        '5min': cpuInfo.loadAverage[1],
        '15min': cpuInfo.loadAverage[2]
      },
      cores: cpuInfo.cores
    },
    uptime: {
      process_seconds: Math.floor(process.uptime()),
      system_seconds: Math.floor(os.uptime())
    },
    pid: process.pid,
    platform: os.platform(),
    node_version: process.version
  };
}

/**
 * Write metrics sample to file
 */
async function writeSample(metrics) {
  try {
    await ensureMetricsDir();
    const filename = getTodayMetricsFile();
    const line = JSON.stringify(metrics) + '\n';
    await fs.promises.appendFile(filename, line);
  } catch (error) {
    console.error('Failed to write metrics sample:', error);
  }
}

/**
 * Sample and store metrics periodically
 */
async function sampleAndStore() {
  // Prevent overlapping samples
  const now = Date.now();
  if (now - lastSampleTime < SAMPLE_INTERVAL_MS - 100) {
    return;
  }
  lastSampleTime = now;
  
  const metrics = sampleOnce();
  await writeSample(metrics);
}

/**
 * Start metrics collection
 * @returns {boolean} Whether metrics collection was started
 */
export function startMetrics() {
  if (samplingInterval) {
    return false; // Already running
  }
  
  // Initial sample
  sampleAndStore();
  
  // Start periodic sampling
  samplingInterval = setInterval(sampleAndStore, SAMPLE_INTERVAL_MS);
  
  console.log('Metrics collection started (5-second intervals)');
  return true;
}

/**
 * Stop metrics collection
 */
export function stopMetrics() {
  if (samplingInterval) {
    clearInterval(samplingInterval);
    samplingInterval = null;
    console.log('Metrics collection stopped');
    return true;
  }
  return false;
}

/**
 * Read the last N lines from today's metrics file
 * @param {number} lines - Number of lines to read (default: 180)
 * @returns {Array} Array of metrics objects
 */
export async function readTail(lines = MAX_TAIL_LINES) {
  try {
    const filename = getTodayMetricsFile();
    
    // Check if file exists
    if (!fs.existsSync(filename)) {
      return [];
    }
    
    // Read the entire file
    const content = await fs.promises.readFile(filename, 'utf-8');
    const allLines = content.split('\n').filter(line => line.trim());
    
    // Get the last N lines
    const tailLines = allLines.slice(-lines);
    
    // Parse each line as JSON
    const metrics = [];
    for (const line of tailLines) {
      try {
        metrics.push(JSON.parse(line));
      } catch (parseError) {
        // Skip invalid JSON lines
        console.warn('Skipping invalid JSON line:', parseError.message);
      }
    }
    
    return metrics;
  } catch (error) {
    console.error('Failed to read metrics tail:', error);
    return [];
  }
}

/**
 * Read all metrics from a specific file
 * @param {string} filename - Name of the metrics file
 * @returns {Array} Array of metrics objects
 */
export async function readMetricsFile(filename) {
  try {
    const filepath = path.join(METRICS_DIR, filename);
    
    // Security check: ensure file is in metrics directory
    if (!filepath.startsWith(METRICS_DIR)) {
      throw new Error('Invalid file path');
    }
    
    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return [];
    }
    
    // Read the entire file
    const content = await fs.promises.readFile(filepath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Parse each line as JSON
    const metrics = [];
    for (const line of lines) {
      try {
        metrics.push(JSON.parse(line));
      } catch (parseError) {
        // Skip invalid JSON lines
      }
    }
    
    return metrics;
  } catch (error) {
    console.error('Failed to read metrics file:', error);
    return [];
  }
}

/**
 * List all metrics files
 * @returns {Array} Array of file information objects
 */
export async function listFiles() {
  try {
    await ensureMetricsDir();
    
    const files = await fs.promises.readdir(METRICS_DIR);
    const metricsFiles = files.filter(f => f.startsWith('metrics-') && f.endsWith('.jsonl'));
    
    // Get file stats for each metrics file
    const fileInfo = [];
    for (const filename of metricsFiles) {
      const filepath = path.join(METRICS_DIR, filename);
      try {
        const stats = await fs.promises.stat(filepath);
        fileInfo.push({
          filename,
          size_bytes: stats.size,
          size_mb: bytesToMB(stats.size),
          modified: stats.mtime.toISOString(),
          created: stats.birthtime.toISOString()
        });
      } catch (statError) {
        console.error('Failed to stat file:', filename, statError);
      }
    }
    
    // Sort by filename (which includes date) in descending order
    fileInfo.sort((a, b) => b.filename.localeCompare(a.filename));
    
    return fileInfo;
  } catch (error) {
    console.error('Failed to list metrics files:', error);
    return [];
  }
}

/**
 * Get all metrics files for export
 * @returns {Array} Array of file paths
 */
export async function getMetricsFilesForExport() {
  try {
    await ensureMetricsDir();
    
    const files = await fs.promises.readdir(METRICS_DIR);
    const metricsFiles = files
      .filter(f => f.startsWith('metrics-') && f.endsWith('.jsonl'))
      .map(f => path.join(METRICS_DIR, f));
    
    return metricsFiles;
  } catch (error) {
    console.error('Failed to get metrics files for export:', error);
    return [];
  }
}

/**
 * Initialize metrics collection on module load
 */
if (process.env.NODE_ENV !== 'test') {
  // Auto-start metrics collection
  setTimeout(() => {
    startMetrics();
  }, 1000);
}

// Export all functions
export default {
  sampleOnce,
  startMetrics,
  stopMetrics,
  readTail,
  readMetricsFile,
  listFiles,
  getMetricsFilesForExport,
  ensureMetricsDir
};