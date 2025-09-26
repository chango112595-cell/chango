import { promises as fs } from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import readline from 'readline';

/**
 * Append a JSON object to a JSONL file
 * Creates the file if it doesn't exist
 */
export async function appendJSONL<T = any>(filePath: string, obj: T): Promise<void> {
  try {
    const jsonLine = JSON.stringify(obj) + '\n';
    await fs.appendFile(filePath, jsonLine, 'utf8');
  } catch (error) {
    throw new Error(`Failed to append to JSONL file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Append multiple JSON objects to a JSONL file
 * More efficient for bulk operations
 */
export async function appendMultipleJSONL<T = any>(filePath: string, objects: T[]): Promise<void> {
  try {
    const jsonLines = objects.map(obj => JSON.stringify(obj) + '\n').join('');
    await fs.appendFile(filePath, jsonLines, 'utf8');
  } catch (error) {
    throw new Error(`Failed to append multiple objects to JSONL file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Read and parse a JSONL file
 * Returns an array of parsed objects
 */
export async function readJSONL<T = any>(filePath: string): Promise<T[]> {
  const results: T[] = [];
  
  try {
    // Check if file exists
    await fs.access(filePath);
  } catch {
    // File doesn't exist, return empty array
    return results;
  }
  
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity
    });
    
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (trimmed) {
        try {
          const obj = JSON.parse(trimmed);
          results.push(obj);
        } catch (error) {
          console.warn(`Skipping invalid JSON line: ${trimmed}`);
        }
      }
    });
    
    rl.on('error', (error) => {
      reject(new Error(`Failed to read JSONL file ${filePath}: ${error.message}`));
    });
    
    rl.on('close', () => {
      resolve(results);
    });
  });
}

/**
 * Stream read a JSONL file with a callback for each object
 * More memory efficient for large files
 */
export async function streamJSONL<T = any>(
  filePath: string,
  onObject: (obj: T, lineNumber: number) => void | Promise<void>
): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    // File doesn't exist, nothing to stream
    return;
  }
  
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity
    });
    
    let lineNumber = 0;
    
    rl.on('line', async (line) => {
      lineNumber++;
      const trimmed = line.trim();
      if (trimmed) {
        try {
          const obj = JSON.parse(trimmed) as T;
          await onObject(obj, lineNumber);
        } catch (error) {
          console.warn(`Error processing line ${lineNumber}: ${trimmed}`);
        }
      }
    });
    
    rl.on('error', (error) => {
      reject(new Error(`Failed to stream JSONL file ${filePath}: ${error.message}`));
    });
    
    rl.on('close', () => {
      resolve();
    });
  });
}

/**
 * Write an array of objects to a JSONL file
 * Overwrites the file if it exists
 */
export async function writeJSONL<T = any>(filePath: string, objects: T[]): Promise<void> {
  try {
    const jsonLines = objects.map(obj => JSON.stringify(obj)).join('\n');
    await fs.writeFile(filePath, jsonLines + (objects.length > 0 ? '\n' : ''), 'utf8');
  } catch (error) {
    throw new Error(`Failed to write JSONL file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Count the number of lines in a JSONL file
 * Useful for large files where you don't want to load everything into memory
 */
export async function countJSONLLines(filePath: string): Promise<number> {
  try {
    await fs.access(filePath);
  } catch {
    return 0;
  }
  
  return new Promise((resolve, reject) => {
    let count = 0;
    const rl = readline.createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity
    });
    
    rl.on('line', (line) => {
      if (line.trim()) {
        count++;
      }
    });
    
    rl.on('error', (error) => {
      reject(new Error(`Failed to count lines in JSONL file ${filePath}: ${error.message}`));
    });
    
    rl.on('close', () => {
      resolve(count);
    });
  });
}