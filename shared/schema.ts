import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const voiceProfiles = pgTable("voice_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  accentType: text("accent_type").notNull(),
  intensity: real("intensity").notNull().default(0.5),
  baseRate: real("base_rate").notNull().default(1.0),
  basePitch: real("base_pitch").notNull().default(1.0),
  baseVolume: real("base_volume").notNull().default(1.0),
  audioFeatures: jsonb("audio_features"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  theme: text("theme").notNull().default("classic"),
  currentTtsRoute: text("current_tts_route").notNull().default("client"),
  hologramMode: text("hologram_mode").notNull().default("awakened"),
  hologramSize: real("hologram_size").notNull().default(200),
  hologramSpeed: real("hologram_speed").notNull().default(0.8),
  hologramWander: boolean("hologram_wander").notNull().default(false),
  curiosityLevel: real("curiosity_level").notNull().default(0.75),
  personalityVariance: real("personality_variance").notNull().default(0.75),
  learningRate: real("learning_rate").notNull().default(0.6),
});

export const curiosityLogs = pgTable("curiosity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trigger: text("trigger").notNull(),
  response: text("response").notNull(),
  context: jsonb("context"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertVoiceProfileSchema = createInsertSchema(voiceProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
});

export const insertCuriosityLogSchema = createInsertSchema(curiosityLogs).omit({
  id: true,
  timestamp: true,
});

export type VoiceProfile = typeof voiceProfiles.$inferSelect;
export type InsertVoiceProfile = z.infer<typeof insertVoiceProfileSchema>;
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;
export type CuriosityLog = typeof curiosityLogs.$inferSelect;
export type InsertCuriosityLog = z.infer<typeof insertCuriosityLogSchema>;
