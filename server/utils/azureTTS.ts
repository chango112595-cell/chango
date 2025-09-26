// Azure Text-to-Speech integration utilities
import { z } from "zod";

const AzureTTSRequestSchema = z.object({
  text: z.string().min(1).max(10000),
  voice: z.string().optional(),
  language: z.string().optional(),
  gender: z.enum(["Male", "Female"]).optional(),
  rate: z.string().optional(),
  pitch: z.string().optional(),
});

export type AzureTTSRequest = z.infer<typeof AzureTTSRequestSchema>;

interface AzureVoice {
  Name: string;
  DisplayName: string;
  LocalName: string;
  ShortName: string;
  Gender: "Male" | "Female";
  Locale: string;
  LocaleName: string;
  StyleList?: string[];
  SampleRateHertz: string;
  VoiceType: "Neural" | "Standard";
  Status: string;
}

class AzureTTSClient {
  private apiKey: string;
  private region: string;
  private baseUrl: string;

  constructor(apiKey: string, region: string) {
    this.apiKey = apiKey;
    this.region = region;
    this.baseUrl = `https://${region}.tts.speech.microsoft.com`;
  }

  async getAccessToken(): Promise<string> {
    const tokenUrl = `https://${this.region}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': '0'
      }
    });

    if (!response.ok) {
      throw new Error(`Azure token error: ${response.status} ${response.statusText}`);
    }

    return await response.text();
  }

  async getVoices(): Promise<AzureVoice[]> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`${this.baseUrl}/cognitiveservices/voices/list`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Azure voices API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async synthesize(request: AzureTTSRequest): Promise<Buffer> {
    const accessToken = await this.getAccessToken();
    
    // Default voice selection
    const voice = request.voice || 'en-US-AriaNeural';
    const language = request.language || 'en-US';
    const rate = request.rate || '0%';
    const pitch = request.pitch || '0%';

    // Create SSML
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}">
        <voice name="${voice}">
          <prosody rate="${rate}" pitch="${pitch}">
            ${this.escapeXml(request.text)}
          </prosody>
        </voice>
      </speak>
    `.trim();

    const response = await fetch(`${this.baseUrl}/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        'User-Agent': 'Chango-AI-TTS',
      },
      body: ssml,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure TTS error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async getVoicesByLanguage(locale: string): Promise<AzureVoice[]> {
    const voices = await this.getVoices();
    return voices.filter(voice => voice.Locale === locale);
  }

  async getNeuralVoices(): Promise<AzureVoice[]> {
    const voices = await this.getVoices();
    return voices.filter(voice => voice.VoiceType === 'Neural');
  }
}

export { AzureTTSClient, AzureTTSRequestSchema };