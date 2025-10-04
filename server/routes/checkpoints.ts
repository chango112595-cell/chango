import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { zipPaths, getArchiveFilename, getArchivePath } from '../utils/zip';

const router = Router();

// Configuration
const ROOT = process.cwd();
const CHECKPOINTS_DIR = path.join(ROOT, 'checkpoints');

// Types
interface CheckpointResponse {
  ok: boolean;
  checkpoint?: string;
  error?: string;
}

interface CheckpointLatestResponse {
  ok: boolean;
  error?: string;
}

/**
 * Ensure checkpoints directory exists
 */
function ensureCheckpointsDirectory(): void {
  if (!fs.existsSync(CHECKPOINTS_DIR)) {
    fs.mkdirSync(CHECKPOINTS_DIR, { recursive: true });
  }
}

/**
 * POST /api/checkpoint
 * Create a new checkpoint backup of the project
 */
router.post('/checkpoint', async (req: Request, res: Response<CheckpointResponse>) => {
  try {
    // Ensure checkpoints directory exists
    ensureCheckpointsDirectory();

    // Generate timestamp for unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(CHECKPOINTS_DIR, `ChangoAI_checkpoint_${timestamp}.zip`);

    // Define paths to backup (important project directories)
    const pathsToBackup = [
      path.join(ROOT, 'client'),
      path.join(ROOT, 'server'),
      path.join(ROOT, 'data'),
      path.join(ROOT, 'logs')
    ];

    // Create the archive
    await zipPaths(outputPath, pathsToBackup);

    // Get the actual filename (could be .zip or .tar.gz)
    const actualFilename = getArchiveFilename(outputPath);
    
    if (!actualFilename) {
      throw new Error('Archive creation failed - file not found');
    }

    // Return success response
    res.json({
      ok: true,
      checkpoint: actualFilename
    });
    
  } catch (error: any) {
    console.error('Checkpoint creation error:', error);
    res.status(500).json({
      ok: false,
      error: String(error.message || error)
    });
  }
});

/**
 * GET /api/checkpoint/latest
 * Download the most recent checkpoint backup
 */
router.get('/checkpoint/latest', (req: Request, res: Response) => {
  try {
    // Check if checkpoints directory exists
    if (!fs.existsSync(CHECKPOINTS_DIR)) {
      return res.status(404).json({
        ok: false,
        error: 'none'
      });
    }

    // Get all checkpoint files (support both .zip and .tar.gz)
    const files = fs.readdirSync(CHECKPOINTS_DIR)
      .filter(file => file.endsWith('.zip') || file.endsWith('.tar.gz'))
      .filter(file => file.startsWith('ChangoAI_checkpoint_'))
      .sort(); // Sort alphabetically (which works for ISO timestamp format)

    // Check if any checkpoints exist
    if (files.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'none'
      });
    }

    // Get the latest checkpoint (last in sorted array)
    const latestFile = files[files.length - 1];
    const latestPath = path.join(CHECKPOINTS_DIR, latestFile);

    // Verify file exists (safety check)
    if (!fs.existsSync(latestPath)) {
      return res.status(404).json({
        ok: false,
        error: 'checkpoint file not found'
      });
    }

    // Send the file as download
    res.download(latestPath, latestFile, (error) => {
      if (error) {
        console.error('Download error:', error);
        // Only send error response if headers haven't been sent
        if (!res.headersSent) {
          res.status(500).json({
            ok: false,
            error: 'download failed'
          });
        }
      }
    });
    
  } catch (error: any) {
    console.error('Get latest checkpoint error:', error);
    res.status(500).json({
      ok: false,
      error: String(error.message || error)
    });
  }
});

/**
 * GET /api/checkpoint/list
 * List all available checkpoints
 */
router.get('/checkpoint/list', (req: Request, res: Response) => {
  try {
    // Check if checkpoints directory exists
    if (!fs.existsSync(CHECKPOINTS_DIR)) {
      return res.json({
        ok: true,
        checkpoints: []
      });
    }

    // Get all checkpoint files with stats
    const files = fs.readdirSync(CHECKPOINTS_DIR)
      .filter(file => file.endsWith('.zip') || file.endsWith('.tar.gz'))
      .filter(file => file.startsWith('ChangoAI_checkpoint_'))
      .map(file => {
        const filePath = path.join(CHECKPOINTS_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => b.created.localeCompare(a.created)); // Sort by creation date, newest first

    res.json({
      ok: true,
      checkpoints: files
    });
    
  } catch (error: any) {
    console.error('List checkpoints error:', error);
    res.status(500).json({
      ok: false,
      error: String(error.message || error),
      checkpoints: []
    });
  }
});

/**
 * DELETE /api/checkpoint/:filename
 * Delete a specific checkpoint
 */
router.delete('/checkpoint/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    
    // Validate filename format for security
    if (!filename.match(/^ChangoAI_checkpoint_[\d\-T]+\.(zip|tar\.gz)$/)) {
      return res.status(400).json({
        ok: false,
        error: 'invalid checkpoint filename'
      });
    }

    const filePath = path.join(CHECKPOINTS_DIR, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        ok: false,
        error: 'checkpoint not found'
      });
    }

    // Delete the file
    fs.unlinkSync(filePath);

    res.json({
      ok: true,
      deleted: filename
    });
    
  } catch (error: any) {
    console.error('Delete checkpoint error:', error);
    res.status(500).json({
      ok: false,
      error: String(error.message || error)
    });
  }
});

export default router;