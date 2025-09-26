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
    onProgress
  } = options;
  
  // Create output directory if it doesn't exist
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });
  
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: compressionLevel },
      comment
    });
    
    let entriesCount = 0;
    let totalBytes = 0;
    
    // Handle stream events
    output.on('close', () => {
      resolve({
        size: archive.pointer(),
        entries: entriesCount
      });
    });
    
    archive.on('error', (err: Error) => {
      reject(new Error(`Archive creation failed: ${err.message}`));
    });
    
    archive.on('warning', (err: archiver.ArchiverError) => {
      if (err.code === 'ENOENT') {
        console.warn(`Archive warning: ${err.message}`);
      } else {
        reject(err);
      }
    });
    
    archive.on('entry', (entry: any) => {
      entriesCount++;
      totalBytes = archive.pointer();
      if (onProgress) {
        onProgress({ entries: entriesCount, totalBytes });
      }
    });
    
    // Pipe archive data to the file
    archive.pipe(output);
    
    // Process and add paths to archive
    (async () => {
      try {
        for (const pathItem of paths) {
          const { source, archiveName } = normalizePathEntry(pathItem);
          
          // Check if path exists
          const stats = await fs.stat(source).catch(() => null);
          if (!stats) {
            console.warn(`Path not found, skipping: ${source}`);
            continue;
          }
          
          if (stats.isDirectory()) {
            // Add directory recursively
            archive.directory(source, archiveName || path.basename(source));
          } else {
            // Add single file
            archive.file(source, { 
              name: archiveName || path.basename(source) 
            });
          }
        }
        
        // Finalize the archive
        await archive.finalize();
      } catch (error) {
        reject(new Error(`Failed to add files to archive: ${error instanceof Error ? error.message : 'Unknown error'}`));
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