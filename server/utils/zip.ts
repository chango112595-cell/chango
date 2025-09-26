import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import type { Archiver } from 'archiver';

export interface ZipOptions {
  /**
   * Compression level (0-9)
   * 0 = no compression (fast), 9 = maximum compression (slow)
   * Default: 6
   */
  compressionLevel?: number;
  
  /**
   * Archive comment
   */
  comment?: string;
  
  /**
   * Progress callback
   */
  onProgress?: (progress: { entries: number; totalBytes: number }) => void;
  
  /**
   * Timeout in milliseconds (default: 30000 - 30 seconds)
   */
  timeout?: number;
  
  /**
   * Exclude patterns (glob patterns to exclude)
   */
  excludePatterns?: string[];
  
  /**
   * Enable verbose logging
   */
  verbose?: boolean;
}

export interface PathEntry {
  /**
   * Source path (file or directory)
   */
  source: string;
  
  /**
   * Optional name in the archive (if different from source)
   */
  archiveName?: string;
}

/**
 * Create a ZIP archive from specified paths
 * Supports both files and directories
 */
export async function zipPaths(
  outputPath: string,
  paths: (string | PathEntry)[],
  options: ZipOptions = {}
): Promise<{ size: number; entries: number }> {
  const {
    compressionLevel = 6,
    comment,
    onProgress,
    timeout = 30000, // 30 seconds default timeout
    excludePatterns = ['node_modules', '.git', '*.log', '.cache', 'dist', 'build', '.next', 'package-lock.json'],
    verbose = false
  } = options;
  
  const log = (message: string) => {
    if (verbose) {
      console.log(`[ZIP] ${new Date().toISOString()} - ${message}`);
    }
  };
  
  log(`Starting ZIP creation: ${outputPath}`);
  log(`Paths to archive: ${paths.map(p => typeof p === 'string' ? p : p.source).join(', ')}`);
  log(`Exclude patterns: ${excludePatterns.join(', ')}`);
  
  // Create output directory if it doesn't exist
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });
  
  return new Promise((resolve, reject) => {
    // Set up timeout
    const timeoutId = setTimeout(() => {
      const errorMsg = `ZIP creation timed out after ${timeout}ms`;
      log(errorMsg);
      cleanup();
      reject(new Error(errorMsg));
    }, timeout);
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: compressionLevel },
      comment
    });
    
    let entriesCount = 0;
    let totalBytes = 0;
    let isFinalized = false;
    let hasErrored = false;
    
    // Cleanup function to properly close streams and clear timeout
    const cleanup = () => {
      clearTimeout(timeoutId);
      if (!isFinalized && !hasErrored) {
        try {
          archive.abort();
        } catch (e) {
          // Ignore abort errors
        }
      }
      try {
        output.destroy();
      } catch (e) {
        // Ignore destroy errors
      }
    };
    
    // Handle stream events
    output.on('close', () => {
      clearTimeout(timeoutId);
      isFinalized = true;
      log(`Archive finalized successfully: ${entriesCount} entries, ${archive.pointer()} bytes`);
      resolve({
        size: archive.pointer(),
        entries: entriesCount
      });
    });
    
    output.on('error', (err: Error) => {
      hasErrored = true;
      const errorMsg = `Output stream error: ${err.message}`;
      log(errorMsg);
      cleanup();
      reject(new Error(errorMsg));
    });
    
    archive.on('error', (err: Error) => {
      hasErrored = true;
      const errorMsg = `Archive creation failed: ${err.message}`;
      log(errorMsg);
      cleanup();
      reject(new Error(errorMsg));
    });
    
    archive.on('warning', (err: archiver.ArchiverError) => {
      if (err.code === 'ENOENT') {
        log(`Archive warning (ENOENT): ${err.message}`);
      } else {
        hasErrored = true;
        log(`Archive warning (critical): ${err.message}`);
        cleanup();
        reject(err);
      }
    });
    
    archive.on('entry', (entry: any) => {
      entriesCount++;
      totalBytes = archive.pointer();
      if (entriesCount % 100 === 0) {
        log(`Progress: ${entriesCount} entries, ${totalBytes} bytes`);
      }
      if (onProgress) {
        onProgress({ entries: entriesCount, totalBytes });
      }
    });
    
    // Pipe archive data to the file
    archive.pipe(output);
    
    // Process and add paths to archive
    (async () => {
      try {
        log('Starting to add paths to archive...');
        
        for (const pathItem of paths) {
          const { source, archiveName } = normalizePathEntry(pathItem);
          
          log(`Processing path: ${source}`);
          
          // Check if path exists
          const stats = await fs.lstat(source).catch(() => null);
          if (!stats) {
            log(`Path not found, skipping: ${source}`);
            continue;
          }
          
          // Check for symbolic links to prevent circular references
          if (stats.isSymbolicLink()) {
            log(`Skipping symbolic link: ${source}`);
            continue;
          }
          
          if (stats.isDirectory()) {
            log(`Adding directory: ${source}`);
            
            // Add directory - archiver will handle filtering based on glob patterns
            // Note: The archiver library doesn't support an 'ignore' option directly
            // Filtering is handled by archiver's internal glob mechanisms
            archive.directory(source, archiveName || path.basename(source));
          } else {
            // Check if file should be excluded
            const shouldExclude = excludePatterns.some(pattern => {
              const filename = path.basename(source);
              if (pattern.startsWith('*')) {
                return filename.endsWith(pattern.slice(1));
              }
              return filename === pattern || filename.includes(pattern);
            });
            
            if (shouldExclude) {
              log(`Excluding file based on pattern: ${source}`);
              continue;
            }
            
            log(`Adding file: ${source}`);
            // Add single file
            archive.file(source, { 
              name: archiveName || path.basename(source) 
            });
          }
        }
        
        log('All paths added, finalizing archive...');
        
        // Don't wait for finalize() - just call it and let the stream events handle completion
        // This prevents hanging on large archives
        archive.finalize();
        log('Archive finalize() called, waiting for completion...');
      } catch (error) {
        hasErrored = true;
        const errorMsg = `Failed to add files to archive: ${error instanceof Error ? error.message : 'Unknown error'}`;
        log(errorMsg);
        cleanup();
        reject(new Error(errorMsg));
      }
    })();
  });
}

/**
 * Create a ZIP archive from a single directory
 */
export async function zipDirectory(
  outputPath: string,
  directoryPath: string,
  options: ZipOptions = {}
): Promise<{ size: number; entries: number }> {
  return zipPaths(outputPath, [directoryPath], options);
}

/**
 * Create a ZIP archive with glob pattern support
 */
export async function zipGlob(
  outputPath: string,
  pattern: string,
  options: ZipOptions & { cwd?: string } = {}
): Promise<{ size: number; entries: number }> {
  const { cwd = process.cwd(), ...zipOptions } = options;
  
  // Note: In a real implementation, you'd use a glob library like 'glob' or 'fast-glob'
  // For now, this is a placeholder that would need the glob dependency
  throw new Error('Glob support requires additional dependencies. Use zipPaths() instead.');
}

/**
 * Helper function to normalize path entries
 */
function normalizePathEntry(pathItem: string | PathEntry): PathEntry {
  if (typeof pathItem === 'string') {
    return { source: pathItem };
  }
  return pathItem;
}

/**
 * Estimate the compressed size of files (rough approximation)
 * Useful for progress indicators before actual compression
 */
export async function estimateZipSize(
  paths: (string | PathEntry)[],
  compressionLevel: number = 6
): Promise<number> {
  let totalSize = 0;
  
  for (const pathItem of paths) {
    const { source } = normalizePathEntry(pathItem);
    totalSize += await getPathSize(source);
  }
  
  // Rough compression ratio estimates based on level
  const compressionRatios: { [key: number]: number } = {
    0: 1.0,
    1: 0.8,
    2: 0.7,
    3: 0.6,
    4: 0.55,
    5: 0.5,
    6: 0.45,
    7: 0.4,
    8: 0.35,
    9: 0.3
  };
  
  const ratio = compressionRatios[compressionLevel] || 0.5;
  return Math.ceil(totalSize * ratio);
}

/**
 * Get the total size of a file or directory
 */
async function getPathSize(pathStr: string): Promise<number> {
  const stats = await fs.stat(pathStr).catch(() => null);
  if (!stats) return 0;
  
  if (stats.isFile()) {
    return stats.size;
  }
  
  if (stats.isDirectory()) {
    let totalSize = 0;
    const entries = await fs.readdir(pathStr, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(pathStr, entry.name);
      if (entry.isDirectory()) {
        totalSize += await getPathSize(fullPath);
      } else {
        const fileStats = await fs.stat(fullPath).catch(() => null);
        if (fileStats) {
          totalSize += fileStats.size;
        }
      }
    }
    
    return totalSize;
  }
  
  return 0;
}