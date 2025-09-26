import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define directory constants
export const ROOT = path.resolve(__dirname, '../..');
export const DATA = path.join(ROOT, 'data');
export const PROFILES = path.join(DATA, 'profiles');
export const LOGS = path.join(DATA, 'logs');
export const CHECKPOINTS = path.join(DATA, 'checkpoints');

// Collection of all directories for easy access
export const DIRECTORIES = {
  ROOT,
  DATA,
  PROFILES,
  LOGS,
  CHECKPOINTS
} as const;

/**
 * Ensures all application directories exist, creating them if necessary
 */
export async function ensureDirs(): Promise<void> {
  const dirs = [DATA, PROFILES, LOGS, CHECKPOINTS];
  
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }
}

/**
 * Check if a path exists
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the absolute path relative to the root directory
 */
export function getAbsolutePath(relativePath: string): string {
  return path.isAbsolute(relativePath) 
    ? relativePath 
    : path.join(ROOT, relativePath);
}

/**
 * Safely join paths, ensuring the result is within the root directory
 */
export function safeJoin(...paths: string[]): string {
  const joined = path.join(ROOT, ...paths);
  const normalized = path.normalize(joined);
  
  // Ensure the path doesn't escape the root directory
  if (!normalized.startsWith(ROOT)) {
    throw new Error(`Path escapes root directory: ${normalized}`);
  }
  
  return normalized;
}