import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVoiceProfileSchema, insertSystemSettingsSchema, insertCuriosityLogSchema } from "@shared/schema";
import multer from "multer";
import { z } from "zod";
import os from "os";
import { spawnSync } from "child_process";
import { getLag, sessionCounters, incrementCounter } from "./utils/lag.js";

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
          const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
          if (!elevenLabsKey) {
            return res.status(501).json({ error: "ElevenLabs API key not configured" });
          }
          
          try {
            // Dynamic import to handle potential missing dependency
            const { ElevenLabsClient } = await import("./utils/elevenLabs.js");
            const client = new ElevenLabsClient(elevenLabsKey);
            
            const audioBuffer = await client.synthesize({
              text,
              voice_settings: voiceProfile ? {
                stability: 0.75,
                similarity_boost: 0.8,
                style: 0.2,
                use_speaker_boost: true
              } : undefined
            });

            res.set({
              'Content-Type': 'audio/mpeg',
              'Content-Length': audioBuffer.length,
              'Content-Disposition': 'inline; filename="speech.mp3"'
            });
            
            res.send(audioBuffer);
          } catch (error) {
            console.error("ElevenLabs synthesis error:", error);
            res.status(500).json({ error: "ElevenLabs synthesis failed" });
          }
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

  // System Diagnostics routes
  app.get("/api/diagnostics", async (req, res) => {
    try {
      // Check ffmpeg availability
      let ffmpegAvailable = false;
      try {
        ffmpegAvailable = spawnSync('ffmpeg', ['-version']).status === 0;
      } catch {
        // ffmpeg not available
      }

      // System stats
      const cpuLoad = os.loadavg()[0];
      const mem = { 
        free: os.freemem(), 
        total: os.totalmem(), 
        rss: process.memoryUsage().rss 
      };
      const env = { 
        node: process.version, 
        pid: process.pid, 
        uptime_s: Math.floor(process.uptime()) 
      };
      const loop = { lag_ms: getLag() };

      // TTS route status
      const routes = {
        client: { enabled: true, healthy: true, note: 'WebSpeech (browser)' },
        local_neural: { enabled: false, healthy: false, note: 'planned' },
        elevenlabs: { 
          enabled: !!process.env.ELEVENLABS_API_KEY, 
          healthy: false, 
          note: process.env.ELEVENLABS_API_KEY ? 'stub' : 'no key' 
        },
        azure: { 
          enabled: !!(process.env.AZURE_TTS_KEY && process.env.AZURE_TTS_REGION), 
          healthy: false, 
          note: (process.env.AZURE_TTS_KEY && process.env.AZURE_TTS_REGION) ? 'stub' : 'no key' 
        }
      };

      // Self-ping for responsiveness check
      let selfPing = { ok: true, ms: 0 };
      try {
        const startTime = Date.now();
        const protocol = req.secure ? 'https' : 'http';
        const host = req.get('host') || 'localhost';
        await fetch(`${protocol}://${host}/api/diagnostics/ping`);
        selfPing = { ok: true, ms: Date.now() - startTime };
      } catch {
        selfPing = { ok: false, ms: 0 };
      }

      res.json({
        ok: true,
        env,
        cpuLoad,
        mem,
        loop,
        ffmpeg: ffmpegAvailable ? 'available' : 'missing',
        routes,
        selfPing,
        session: sessionCounters
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get diagnostics" });
    }
  });

  // Simple ping endpoint for self-diagnostics
  app.get("/api/diagnostics/ping", (req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Session counter increment endpoint
  app.post("/api/diagnostics/incr", (req, res) => {
    try {
      const { key } = z.object({ key: z.string() }).parse(req.body);
      if (key && key in sessionCounters && key !== 'start') {
        incrementCounter(key as keyof typeof sessionCounters);
      }
      res.json({ ok: true, session: sessionCounters });
    } catch {
      res.status(400).json({ error: "Invalid increment request" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
