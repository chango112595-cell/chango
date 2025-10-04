import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Configuration
const DATA_DIR = path.join(process.cwd(), 'data');
const POWER_FILE = path.join(DATA_DIR, 'power.json');

// Types
interface PowerState {
  on: boolean;
  ts: string;
}

interface PowerResponse {
  ok: boolean;
  on: boolean;
  error?: string;
}

/**
 * Get the current power state
 * Defaults to true if file doesn't exist or is invalid
 */
function getPowerState(): boolean {
  try {
    const data = fs.readFileSync(POWER_FILE, 'utf8');
    const state: PowerState = JSON.parse(data);
    return state.on === true;
  } catch (error) {
    // If file doesn't exist or is invalid, default to true (on)
    return true;
  }
}

/**
 * Set the power state
 * Creates the data directory if it doesn't exist
 */
function setPowerState(on: boolean): void {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Write power state to file
  const state: PowerState = {
    on: !!on,
    ts: new Date().toISOString()
  };

  fs.writeFileSync(POWER_FILE, JSON.stringify(state, null, 2));
}

/**
 * GET /api/power
 * Retrieve current power state
 */
router.get('/power', (req: Request, res: Response<PowerResponse>) => {
  try {
    const on = getPowerState();
    res.json({ ok: true, on });
  } catch (error) {
    console.error('Error getting power state:', error);
    res.status(500).json({ 
      ok: false, 
      on: true, 
      error: 'Failed to retrieve power state' 
    });
  }
});

/**
 * POST /api/power
 * Set power state (on/off)
 */
router.post('/power', (req: Request, res: Response<PowerResponse>) => {
  try {
    // Extract 'on' from request body, convert to boolean
    const on = !!(req.body?.on);
    
    // Set the power state
    setPowerState(on);
    
    // Return success response
    res.json({ ok: true, on });
  } catch (error) {
    console.error('Error setting power state:', error);
    res.status(500).json({ 
      ok: false, 
      on: getPowerState(), 
      error: 'Failed to set power state' 
    });
  }
});

export default router;