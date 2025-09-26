import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVoiceProfileSchema, insertSystemSettingsSchema, insertCuriosityLogSchema } from "@shared/schema";
import multer from "multer";
import { z } from "zod";
import * as os from "os";
import { spawnSync } from "child_process";
import { appendJSONL } from "./utils/jsonl";
import { ensureDirs, CHECKPOINTS } from "./utils/paths";
import { zipPaths } from "./utils/zip";
import { promises as fs } from "fs";
import path from "path";
import { voiceProfileRouter } from "./voiceProfiles";

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// TTS Route validation schema
const ttsRequestSchema = z.object({
  text: z.string().min(1).max(1000),
  voiceProfileId: z.string().optional(),
  route: z.enum(["client", "local_neural", "elevenlabs", "azure"]).optional()
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/", async (req, res) => {
    try {
      res.json({ ok: true, service: "ChangoAI unified shim" });
    } catch (error) {
      res.status(500).json({ error: "Health check failed" });
    }
  });

  // Diagnostics endpoint
  app.get("/api/diagnostics", async (req, res) => {
    try {
      // Get system information
      const uptime_s = process.uptime();
      const node = process.version;
      const loadAvg = os.loadavg();
      const cpu_load = loadAvg[0]; // 1-minute load average
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      
      // Check if ffmpeg is available
      let ffmpeg: "available" | "missing" = "missing";
      try {
        const result = spawnSync("ffmpeg", ["-version"], { 
          encoding: "utf8",
          timeout: 3000 // 3 second timeout
        });
        if (result.status === 0) {
          ffmpeg = "available";
        }
      } catch (error) {
        // ffmpeg not found or error executing
        ffmpeg = "missing";
      }

      const diagnostics = {
        ok: true,
        uptime_s,
        node,
        cpu_load,
        mem: {
          free: freeMem,
          total: totalMem
        },
        ffmpeg
      };

      res.json(diagnostics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch diagnostics" });
    }
  });

  // Mount voice profile learning/analysis routes
  app.use("/api/voice_profile", voiceProfileRouter);

  // Voice Profile routes
  app.get("/api/voice-profiles", async (req, res) => {
    try {
      const profiles = await storage.getAllVoiceProfiles();
      res.json({ profiles });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch voice profiles" });
    }
  });

  app.get("/api/voice-profiles/:id", async (req, res) => {
    try {
      const profile = await storage.getVoiceProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Voice profile not found" });
      }
      res.json({ profile });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch voice profile" });
    }
  });

  app.post("/api/voice-profiles", upload.single("audio"), async (req, res) => {
    try {
      const profileData = insertVoiceProfileSchema.parse(req.body);
      
      // If audio file is provided, analyze it
      if (req.file) {
        // TODO: Implement audio analysis with librosa
        // For now, store basic info
        profileData.audioFeatures = {
          originalFormat: req.file.mimetype,
          size: req.file.size,
          analysisTimestamp: new Date().toISOString()
        };
      }

      const profile = await storage.createVoiceProfile(profileData);
      res.json({ profile });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid profile data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create voice profile" });
    }
  });

  app.put("/api/voice-profiles/:id", async (req, res) => {
    try {
      const updates = insertVoiceProfileSchema.partial().parse(req.body);
      const profile = await storage.updateVoiceProfile(req.params.id, updates);
      
      if (!profile) {
        return res.status(404).json({ error: "Voice profile not found" });
      }
      
      res.json({ profile });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid profile data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update voice profile" });
    }
  });

  app.delete("/api/voice-profiles/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteVoiceProfile(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Voice profile not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete voice profile" });
    }
  });

  // System Settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const userId = req.query.userId as string || "default";
      const settings = await storage.getSystemSettings(userId);
      res.json({ settings });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const settingsData = insertSystemSettingsSchema.parse(req.body);
      const settings = await storage.upsertSystemSettings(settingsData);
      res.json({ settings });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // TTS routes
  app.post("/api/tts/synthesize", async (req, res) => {
    try {
      const { text, voiceProfileId, route = "client" } = ttsRequestSchema.parse(req.body);
      
      // Get voice profile if specified
      let voiceProfile = null;
      if (voiceProfileId) {
        voiceProfile = await storage.getVoiceProfile(voiceProfileId);
      }

      switch (route) {
        case "client":
          // Client-side synthesis, just return success
          res.json({ success: true, message: "Use client-side synthesis" });
          break;
          
        case "local_neural":
          // TODO: Implement local neural TTS
          res.status(501).json({ error: "Local neural TTS not implemented" });
          break;
          
        case "elevenlabs":
          // TODO: Implement ElevenLabs integration
          const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
          if (!elevenLabsKey) {
            return res.status(501).json({ error: "ElevenLabs API key not configured" });
          }
          res.status(501).json({ error: "ElevenLabs integration not implemented" });
          break;
          
        case "azure":
          // TODO: Implement Azure TTS integration
          const azureKey = process.env.AZURE_TTS_KEY;
          const azureRegion = process.env.AZURE_TTS_REGION;
          if (!azureKey || !azureRegion) {
            return res.status(501).json({ error: "Azure TTS credentials not configured" });
          }
          res.status(501).json({ error: "Azure TTS integration not implemented" });
          break;
          
        default:
          res.status(400).json({ error: "Invalid TTS route" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid TTS request", details: error.errors });
      }
      res.status(500).json({ error: "TTS synthesis failed" });
    }
  });

  // Audio analysis route
  app.post("/api/audio/analyze", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      // TODO: Implement audio analysis with librosa
      // For now, return mock analysis
      const analysis = {
        duration: 0,
        sampleRate: 44100,
        channels: 1,
        pitchMean: 0,
        pitchStd: 0,
        energyMean: 0,
        spectralCentroid: 0,
        mfcc: [],
        detectedAccent: "neutral",
        confidence: 0.85
      };

      res.json({ analysis });
    } catch (error) {
      res.status(500).json({ error: "Audio analysis failed" });
    }
  });

  // Curiosity Engine routes
  app.get("/api/curiosity/logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const logs = await storage.getCuriosityLogs(limit);
      res.json({ logs });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch curiosity logs" });
    }
  });

  app.post("/api/curiosity/log", async (req, res) => {
    try {
      const logData = insertCuriosityLogSchema.parse(req.body);
      const log = await storage.addCuriosityLog(logData);
      res.json({ log });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid log data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to add curiosity log" });
    }
  });

  // Accent Feedback logging endpoint
  app.post("/api/accent_feedback", async (req, res) => {
    try {
      // Ensure the data directory exists
      await ensureDirs();
      
      // Add timestamp to the data
      const dataWithTimestamp = {
        ...req.body,
        ts: new Date().toISOString()
      };
      
      // Define the log file path
      const logFilePath = path.join('data', 'accents_log.jsonl');
      
      // Append the data to the JSONL file
      await appendJSONL(logFilePath, dataWithTimestamp);
      
      res.json({ ok: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({ ok: false, error: errorMessage });
    }
  });

  // Checkpoint/Backup endpoints
  app.post("/api/checkpoint", async (req, res) => {
    try {
      // Ensure the checkpoints directory exists
      await ensureDirs();
      
      // Generate timestamp-based filename
      const now = new Date();
      const timestamp = now.toISOString()
        .replace(/:/g, '-')  // Replace colons with hyphens
        .replace(/\./g, '-'); // Replace dots with hyphens
      const filename = `ChangoAI_checkpoint_${timestamp}.zip`;
      const outputPath = path.join(CHECKPOINTS, filename);
      
      // Define paths to include in the backup
      const pathsToBackup = [
        'client',
        'server', 
        'data',
        'logs',
        'replit.md'
      ];
      
      // Create the ZIP archive
      await zipPaths(outputPath, pathsToBackup);
      
      res.json({ ok: true, checkpoint: filename });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Checkpoint creation failed:', errorMessage);
      res.status(500).json({ ok: false, error: errorMessage });
    }
  });

  app.get("/api/checkpoint/latest", async (req, res) => {
    try {
      // Ensure the checkpoints directory exists
      await ensureDirs();
      
      // Read all files in the checkpoints directory
      const files = await fs.readdir(CHECKPOINTS);
      
      // Filter for ZIP files that match our naming pattern
      const checkpointFiles = files.filter(file => 
        file.startsWith('ChangoAI_checkpoint_') && file.endsWith('.zip')
      );
      
      // If no checkpoints exist, return 404
      if (checkpointFiles.length === 0) {
        return res.status(404).json({ ok: false, error: 'no checkpoints yet' });
      }
      
      // Sort files by name (which includes timestamp) to get the latest
      checkpointFiles.sort((a, b) => b.localeCompare(a));
      const latestCheckpoint = checkpointFiles[0];
      const checkpointPath = path.join(CHECKPOINTS, latestCheckpoint);
      
      // Send the file as a download
      res.download(checkpointPath, latestCheckpoint, (err) => {
        if (err) {
          console.error('Error sending checkpoint file:', err);
          if (!res.headersSent) {
            res.status(500).json({ ok: false, error: 'Failed to download checkpoint' });
          }
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Failed to retrieve latest checkpoint:', errorMessage);
      res.status(500).json({ ok: false, error: errorMessage });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
