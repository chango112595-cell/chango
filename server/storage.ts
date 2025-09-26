import { type VoiceProfile, type InsertVoiceProfile, type SystemSettings, type InsertSystemSettings, type CuriosityLog, type InsertCuriosityLog } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Voice Profiles
  getVoiceProfile(id: string): Promise<VoiceProfile | undefined>;
  getVoiceProfilesByType(accentType: string): Promise<VoiceProfile[]>;
  getAllVoiceProfiles(): Promise<VoiceProfile[]>;
  createVoiceProfile(profile: InsertVoiceProfile): Promise<VoiceProfile>;
  updateVoiceProfile(id: string, profile: Partial<InsertVoiceProfile>): Promise<VoiceProfile | undefined>;
  deleteVoiceProfile(id: string): Promise<boolean>;

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
    return this.voiceProfiles.get(id);
  }

  async getVoiceProfilesByType(accentType: string): Promise<VoiceProfile[]> {
    return Array.from(this.voiceProfiles.values()).filter(
      (profile) => profile.accentType === accentType
    );
  }

  async getAllVoiceProfiles(): Promise<VoiceProfile[]> {
    return Array.from(this.voiceProfiles.values());
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
