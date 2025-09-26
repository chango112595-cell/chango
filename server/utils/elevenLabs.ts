// ElevenLabs TTS integration utilities
import { z } from "zod";

const ElevenLabsVoiceSchema = z.object({
  voice_id: z.string(),
  name: z.string(),
  samples: z.any().optional(),
  category: z.string(),
  fine_tuning: z.object({
    language: z.string().optional(),
  }).optional(),
  labels: z.object({}).optional(),
  description: z.string().optional(),
  preview_url: z.string().optional(),
  available_for_tiers: z.array(z.string()),
  settings: z.object({
    stability: z.number(),
    similarity_boost: z.number(),
    style: z.number().optional(),
    use_speaker_boost: z.boolean().optional(),
  }).optional(),
});

const ElevenLabsTTSSchema = z.object({
  text: z.string().min(1).max(5000),
  voice_id: z.string().optional(),
  voice_settings: z.object({
    stability: z.number().min(0).max(1).optional(),
    similarity_boost: z.number().min(0).max(1).optional(),
    style: z.number().min(0).max(1).optional(),
    use_speaker_boost: z.boolean().optional(),
  }).optional(),
  model_id: z.string().optional(),
});

export type ElevenLabsVoice = z.infer<typeof ElevenLabsVoiceSchema>;
export type ElevenLabsTTSRequest = z.infer<typeof ElevenLabsTTSSchema>;

class ElevenLabsClient {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getVoices(): Promise<ElevenLabsVoice[]> {
    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: {
        'Xi-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices;
  }

  async synthesize(request: ElevenLabsTTSRequest): Promise<Buffer> {
    // Use default voice if not specified
    const voiceId = request.voice_id || 'pNInz6obpgDQGcFmaJgB'; // Adam voice
    
    const body = {
      text: request.text,
      model_id: request.model_id || 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true,
        ...request.voice_settings,
      },
    };

    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Xi-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs TTS error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async getVoice(voiceId: string): Promise<ElevenLabsVoice> {
    const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
      headers: {
        'Xi-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getUserInfo() {
    const response = await fetch(`${this.baseUrl}/user`, {
      headers: {
        'Xi-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}

export { ElevenLabsClient, ElevenLabsTTSSchema };