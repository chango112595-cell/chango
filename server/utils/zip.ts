import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';
import { createWriteStream, createReadStream } from 'fs';
import { spawn } from 'child_process';

/**
 * Create a zip archive using the system zip command
 * Falls back to tar.gz if zip is not available
 * 
 * @param outputPath - Path where the archive should be created
 * @param items - Array of paths (files or directories) to include in the archive
 */
export async function zipPaths(outputPath: string, items: string[]): Promise<void> {
  // Filter out non-existent paths
  const existingItems = items.filter(item => fs.existsSync(item));
  
  if (existingItems.length === 0) {
    throw new Error('No valid paths to archive');
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Try using system zip command first (most universal)
  try {
    await zipWithSystemCommand(outputPath, existingItems);
    return;
  } catch (error) {
    console.log('System zip not available, falling back to tar.gz');
  }

  // Fallback to tar.gz using system tar command
  try {
    await tarGzWithSystemCommand(outputPath, existingItems);
    return;
  } catch (error) {
    throw new Error(`Failed to create archive: ${error}`);
  }
}

/**
 * Create a zip archive using the system zip command
 */
async function zipWithSystemCommand(outputPath: string, items: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // Convert items to relative paths for cleaner archive structure
    const args = ['-r', outputPath];
    
    // Add each item with its basename to avoid full paths in archive
    for (const item of items) {
      args.push(path.basename(item));
    }
    
    // Get the common parent directory
    const parentDir = path.dirname(items[0]);
    
    const zipProcess = spawn('zip', args, {
      cwd: parentDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let errorOutput = '';
    
    zipProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    zipProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`zip command failed with code ${code}: ${errorOutput}`));
      } else {
        resolve();
      }
    });

    zipProcess.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Create a tar.gz archive using the system tar command
 * This changes the extension from .zip to .tar.gz
 */
async function tarGzWithSystemCommand(outputPath: string, items: string[]): Promise<void> {
  // Change extension from .zip to .tar.gz
  const tarPath = outputPath.replace(/\.zip$/, '.tar.gz');
  
  return new Promise((resolve, reject) => {
    // Build tar command arguments
    const args = ['-czf', tarPath];
    
    // Add each item with -C to change to parent directory first
    for (const item of items) {
      args.push('-C', path.dirname(item), path.basename(item));
    }
    
    const tarProcess = spawn('tar', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let errorOutput = '';
    
    tarProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    tarProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`tar command failed with code ${code}: ${errorOutput}`));
      } else {
        resolve();
      }
    });

    tarProcess.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Get the actual archive filename (could be .zip or .tar.gz)
 */
export function getArchiveFilename(basePath: string): string | null {
  // Check for .zip first
  if (fs.existsSync(basePath)) {
    return path.basename(basePath);
  }
  
  // Check for .tar.gz
  const tarPath = basePath.replace(/\.zip$/, '.tar.gz');
  if (fs.existsSync(tarPath)) {
    return path.basename(tarPath);
  }
  
  return null;
}

/**
 * Get the actual archive path (could be .zip or .tar.gz)
 */
export function getArchivePath(basePath: string): string | null {
  // Check for .zip first
  if (fs.existsSync(basePath)) {
    return basePath;
  }
  
  // Check for .tar.gz
  const tarPath = basePath.replace(/\.zip$/, '.tar.gz');
  if (fs.existsSync(tarPath)) {
    return tarPath;
  }
  
  return null;
}