import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Types for request/response
interface FileWrite {
  path: string;
  content: string;
  mode?: 'text' | 'binary';
}

interface DevWriteRequest {
  files: FileWrite[];
  note?: string;
}

interface DevWriteResponse {
  ok: boolean;
  written?: string[];
  error?: string;
}

interface DevWriteLogEntry {
  ts: string;
  note: string;
  files: string[];
}

// Configuration
const ROOT = process.cwd();
const TOKEN = process.env.CHANGO_WRITE_TOKEN || '';
const LOGS_DIR = path.join(ROOT, 'logs');
const DEV_WRITES_LOG = path.join(LOGS_DIR, 'DEV_WRITES.log');

/**
 * Validates and normalizes file paths to prevent directory traversal attacks
 * @param relativePath - The relative path to validate
 * @returns The safe absolute path
 * @throws Error if the path tries to escape the root directory
 */
function getSafePath(relativePath: string): string {
  const normalizedPath = path.normalize(path.join(ROOT, relativePath));
  
  if (!normalizedPath.startsWith(ROOT)) {
    throw new Error('Path traversal attempt detected - path escapes root directory');
  }
  
  return normalizedPath;
}

/**
 * Verifies the HMAC signature of the request body
 * @param body - The request body object
 * @param signature - The signature from the x-chango-signature header
 * @returns true if signature is valid, false otherwise
 */
function verifySignature(body: any, signature: string): boolean {
  if (!TOKEN) {
    return false;
  }
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', TOKEN)
      .update(JSON.stringify(body))
      .digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature || '', 'hex')
    );
  } catch (error) {
    // Invalid signature format or other error
    return false;
  }
}

/**
 * Logs a write operation to the DEV_WRITES.log file
 * @param note - Optional note about the write operation
 * @param files - Array of file paths that were written
 */
function logWriteOperation(note: string, files: string[]): void {
  try {
    // Ensure logs directory exists
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    
    const logEntry: DevWriteLogEntry = {
      ts: new Date().toISOString(),
      note: note || '',
      files: files
    };
    
    // Append log entry as JSON line
    fs.appendFileSync(DEV_WRITES_LOG, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    // Log errors are non-fatal, continue operation
    console.error('Failed to write to DEV_WRITES.log:', error);
  }
}

/**
 * POST /api/dev/write
 * Securely writes files to the filesystem with HMAC signature verification
 */
router.post('/dev/write', (req: Request, res: Response<DevWriteResponse>) => {
  try {
    // Check if bridge is enabled (TOKEN is set)
    if (!TOKEN) {
      return res.status(403).json({
        ok: false,
        error: 'bridge disabled'
      });
    }
    
    // Extract and verify signature
    const signature = (req.headers['x-chango-signature'] || '') as string;
    
    if (!verifySignature(req.body || {}, signature)) {
      return res.status(401).json({
        ok: false,
        error: 'bad signature'
      });
    }
    
    // Validate request body structure
    const body = req.body as DevWriteRequest;
    
    if (!body || !Array.isArray(body.files)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid request body - files array required'
      });
    }
    
    const writtenFiles: string[] = [];
    
    // Process each file write request
    for (const file of body.files) {
      // Validate file object structure
      if (!file.path || typeof file.path !== 'string') {
        return res.status(400).json({
          ok: false,
          error: `Invalid file entry - path required for all files`
        });
      }
      
      if (file.content === undefined || file.content === null) {
        return res.status(400).json({
          ok: false,
          error: `Invalid file entry - content required for file: ${file.path}`
        });
      }
      
      try {
        // Get safe path (prevents directory traversal)
        const safePath = getSafePath(file.path);
        
        // Create parent directory if it doesn't exist
        const parentDir = path.dirname(safePath);
        fs.mkdirSync(parentDir, { recursive: true });
        
        // Determine encoding based on mode
        const encoding = file.mode === 'binary' ? 'binary' : 'utf8';
        
        // Write file to disk
        fs.writeFileSync(safePath, file.content, encoding as BufferEncoding);
        
        // Track successfully written file
        writtenFiles.push(file.path);
        
      } catch (fileError: any) {
        // If any file fails, return error immediately
        return res.status(500).json({
          ok: false,
          error: `Failed to write file ${file.path}: ${fileError.message || fileError}`
        });
      }
    }
    
    // Log the write operation
    logWriteOperation(body.note || '', writtenFiles);
    
    // Return success response with list of written files
    res.json({
      ok: true,
      written: writtenFiles
    });
    
  } catch (error: any) {
    // Handle unexpected errors
    console.error('Dev write error:', error);
    res.status(500).json({
      ok: false,
      error: String(error.message || error)
    });
  }
});

/**
 * GET /api/dev/write/status
 * Returns the status of the dev write bridge
 */
router.get('/dev/write/status', (req: Request, res: Response) => {
  const enabled = !!TOKEN;
  
  res.json({
    ok: true,
    enabled,
    root: ROOT,
    logsPath: DEV_WRITES_LOG,
    message: enabled 
      ? 'Dev write bridge is enabled and ready' 
      : 'Dev write bridge is disabled (CHANGO_WRITE_TOKEN not set)'
  });
});

export default router;