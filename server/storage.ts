import { type VoiceProfile, type InsertVoiceProfile, type SystemSettings, type InsertSystemSettings, type CuriosityLog, type InsertCuriosityLog } from "@shared/schema";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { PROFILES, ensureDirs } from "./utils/paths";

// Voice profile data structure from learned audio
export interface LearnedVoiceProfile {
  id: string;
  features: {
    duration: number;
    pauseRatio: number;
    f0: number;
    wpm: number;
    sibilance: number;
    rhoticity: number;
    rms: number;
    spectralCentroid: number;
  };
  mappedAccent: string;
  accentConfidences: {
    neutral: number;
    brit_rp: number;
    southern_us: number;
    spanish_en: number;
    caribbean: number;
  };
  parameters: {
    rate: number;
    pitch: number;
    volume: number;
    emphasis: number;
  };
  createdAt: string;
  originalFilename?: string;
}

export interface IStorage {
  // Voice Profiles
  getVoiceProfile(id: string): Promise<VoiceProfile | undefined>;
  getVoiceProfilesByType(accentType: string): Promise<VoiceProfile[]>;
  getAllVoiceProfiles(): Promise<VoiceProfile[]>;
  createVoiceProfile(profile: InsertVoiceProfile): Promise<VoiceProfile>;
  updateVoiceProfile(id: string, profile: Partial<InsertVoiceProfile>): Promise<VoiceProfile | undefined>;
  deleteVoiceProfile(id: string): Promise<boolean>;

  // Voice Profile Learning (file-based operations)
  learnVoiceProfile(profileData: LearnedVoiceProfile): Promise<LearnedVoiceProfile>;
  getLearnedVoiceProfile(id: string): Promise<LearnedVoiceProfile | undefined>;
  getAllLearnedVoiceProfiles(): Promise<LearnedVoiceProfile[]>;

  // System Settings
  getSystemSettings(userId?: string): Promise<SystemSettings | undefined>;
  upsertSystemSettings(settings: InsertSystemSettings): Promise<SystemSettings>;

  // Curiosity Logs
  getCuriosityLogs(limit?: number): Promise<CuriosityLog[]>;
  addCuriosityLog(log: InsertCuriosityLog): Promise<CuriosityLog>;
}

export class MemStorage implements IStorage {
  private voiceProfiles: Map<string, VoiceProfile>;
  private systemSettings: Map<string, SystemSettings>;
  private curiosityLogs: CuriosityLog[];

  constructor() {
    this.voiceProfiles = new Map();
    this.systemSettings = new Map();
    this.curiosityLogs = [];
  }

  // Voice Profiles
  async getVoiceProfile(id: string): Promise<VoiceProfile | undefined> {
    // First check in-memory profiles
    let profile = this.voiceProfiles.get(id);
    if (profile) return profile;
    
    // Try to get from learned profiles (file-based)
    const learnedProfile = await this.getLearnedVoiceProfile(id);
    if (learnedProfile) {
      // Convert learned profile to VoiceProfile format
      return {
        id: learnedProfile.id,
        name: learnedProfile.originalFilename || 'Learned Profile',
        accentType: learnedProfile.mappedAccent,
        intensity: 0.5,
        baseRate: learnedProfile.parameters.rate,
        basePitch: learnedProfile.parameters.pitch,
        baseVolume: learnedProfile.parameters.volume,
        audioFeatures: {
          features: learnedProfile.features,
          accentConfidences: learnedProfile.accentConfidences,
          parameters: learnedProfile.parameters
        },
        createdAt: new Date(learnedProfile.createdAt),
      };
    }
    
    return undefined;
  }

  async getVoiceProfilesByType(accentType: string): Promise<VoiceProfile[]> {
    return Array.from(this.voiceProfiles.values()).filter(
      (profile) => profile.accentType === accentType
    );
  }

  async getAllVoiceProfiles(): Promise<VoiceProfile[]> {
    // Get in-memory profiles
    const memProfiles = Array.from(this.voiceProfiles.values());
    
    // Get learned profiles from file system
    const learnedProfiles = await this.getAllLearnedVoiceProfiles();
    
    // Convert learned profiles to VoiceProfile format
    const convertedProfiles = learnedProfiles.map(lp => ({
      id: lp.id,
      name: lp.originalFilename || 'Learned Profile',
      accentType: lp.mappedAccent,
      intensity: 0.5,
      baseRate: lp.parameters.rate,
      basePitch: lp.parameters.pitch,
      baseVolume: lp.parameters.volume,
      audioFeatures: {
        features: lp.features,
        accentConfidences: lp.accentConfidences,
        parameters: lp.parameters
      },
      createdAt: new Date(lp.createdAt),
    } as VoiceProfile));
    
    // Combine and return all profiles
    return [...memProfiles, ...convertedProfiles];
  }

  async createVoiceProfile(insertProfile: InsertVoiceProfile): Promise<VoiceProfile> {
    const id = randomUUID();
    const profile: VoiceProfile = {
      id,
      name: insertProfile.name,
      accentType: insertProfile.accentType,
      intensity: insertProfile.intensity ?? 0.5,
      baseRate: insertProfile.baseRate ?? 1.0,
      basePitch: insertProfile.basePitch ?? 1.0,
      baseVolume: insertProfile.baseVolume ?? 1.0,
      audioFeatures: insertProfile.audioFeatures ?? null,
      createdAt: new Date(),
    };
    this.voiceProfiles.set(id, profile);
    return profile;
  }

  async updateVoiceProfile(id: string, updates: Partial<InsertVoiceProfile>): Promise<VoiceProfile | undefined> {
    const existing = this.voiceProfiles.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.voiceProfiles.set(id, updated);
    return updated;
  }

  async deleteVoiceProfile(id: string): Promise<boolean> {
    return this.voiceProfiles.delete(id);
  }

  // Voice Profile Learning (file-based operations)
  async learnVoiceProfile(profileData: LearnedVoiceProfile): Promise<LearnedVoiceProfile> {
    try {
      await ensureDirs();
      const profilePath = path.join(PROFILES, `${profileData.id}.json`);
      await fs.writeFile(profilePath, JSON.stringify(profileData, null, 2), 'utf8');
      return profileData;
    } catch (error) {
      throw new Error(`Failed to save learned voice profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getLearnedVoiceProfile(id: string): Promise<LearnedVoiceProfile | undefined> {
    try {
      const profilePath = path.join(PROFILES, `${id}.json`);
      const data = await fs.readFile(profilePath, 'utf8');
      return JSON.parse(data) as LearnedVoiceProfile;
    } catch (error) {
      // Return undefined if file doesn't exist
      if ((error as any).code === 'ENOENT') {
        return undefined;
      }
      throw new Error(`Failed to read learned voice profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllLearnedVoiceProfiles(): Promise<LearnedVoiceProfile[]> {
    try {
      await ensureDirs();
      const files = await fs.readdir(PROFILES);
      const profiles: LearnedVoiceProfile[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const profilePath = path.join(PROFILES, file);
            const data = await fs.readFile(profilePath, 'utf8');
            const profile = JSON.parse(data) as LearnedVoiceProfile;
            profiles.push(profile);
          } catch (error) {
            console.error(`Error reading profile ${file}:`, error);
            // Continue with other files even if one fails
          }
        }
      }
      
      // Sort by creation date (newest first)
      profiles.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      
      return profiles;
    } catch (error) {
      console.error('Error listing voice profiles:', error);
      return [];
    }
  }

  // System Settings
  async getSystemSettings(userId = "default"): Promise<SystemSettings | undefined> {
    return this.systemSettings.get(userId);
  }

  async upsertSystemSettings(insertSettings: InsertSystemSettings): Promise<SystemSettings> {
    const userId = insertSettings.userId || "default";
    const existing = this.systemSettings.get(userId);
    
    if (existing) {
      const updated = { ...existing, ...insertSettings };
      this.systemSettings.set(userId, updated);
      return updated;
    } else {
      const id = randomUUID();
      const settings: SystemSettings = {
        id,
        userId,
        theme: insertSettings.theme ?? "classic",
        currentTtsRoute: insertSettings.currentTtsRoute ?? "client",
        hologramMode: insertSettings.hologramMode ?? "awakened",
        hologramSize: insertSettings.hologramSize ?? 200,
        hologramSpeed: insertSettings.hologramSpeed ?? 0.8,
        hologramWander: insertSettings.hologramWander ?? false,
        curiosityLevel: insertSettings.curiosityLevel ?? 0.75,
        personalityVariance: insertSettings.personalityVariance ?? 0.75,
        learningRate: insertSettings.learningRate ?? 0.6,
      };
      this.systemSettings.set(userId, settings);
      return settings;
    }
  }

  // Curiosity Logs
  async getCuriosityLogs(limit = 10): Promise<CuriosityLog[]> {
    return this.curiosityLogs
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
      .slice(0, limit);
  }

  async addCuriosityLog(insertLog: InsertCuriosityLog): Promise<CuriosityLog> {
    const id = randomUUID();
    const log: CuriosityLog = {
      id,
      trigger: insertLog.trigger,
      response: insertLog.response,
      context: insertLog.context ?? null,
      timestamp: new Date(),
    };
    this.curiosityLogs.push(log);
    return log;
  }
}

export const storage = new MemStorage();
