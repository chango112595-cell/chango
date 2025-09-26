// OpenAI audio analysis integration using the JavaScript OpenAI blueprint
import OpenAI from "openai";
import fs from "fs";
import { z } from "zod";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const AudioAnalysisSchema = z.object({
  text: z.string(),
  duration: z.number(),
  language: z.string(),
  confidence: z.number(),
  speaker_characteristics: z.object({
    gender: z.string(),
    age_range: z.string(),
    accent: z.string(),
    emotion: z.string(),
    speech_rate: z.string(),
    pitch_level: z.string(),
  }),
  voice_features: z.object({
    fundamental_frequency: z.number(),
    spectral_centroid: z.number(),
    spectral_rolloff: z.number(),
    zero_crossing_rate: z.number(),
    mfcc_features: z.array(z.number()),
  }),
  quality_metrics: z.object({
    clarity: z.number(),
    background_noise: z.string(),
    recording_quality: z.string(),
  }),
});

export type AudioAnalysis = z.infer<typeof AudioAnalysisSchema>;

interface VoiceProfileAnalysis {
  accentType: string;
  confidence: number;
  characteristics: {
    pitch: number;
    rate: number;
    intensity: number;
    formants: number[];
  };
  recommendations: string[];
}

export class OpenAIAudioAnalyzer {
  async transcribeAudio(audioBuffer: Buffer, filename: string = "audio.wav"): Promise<{ text: string, duration: number }> {
    // Write buffer to temporary file for OpenAI API
    const tempPath = `/tmp/${filename}`;
    fs.writeFileSync(tempPath, audioBuffer);
    
    try {
      const audioReadStream = fs.createReadStream(tempPath);
      
      const transcription = await openai.audio.transcriptions.create({
        file: audioReadStream,
        model: "whisper-1",
      });

      return {
        text: transcription.text,
        duration: 0, // Duration not available from Whisper API response
      };
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  async analyzeVoiceCharacteristics(audioBuffer: Buffer, transcribedText?: string): Promise<VoiceProfileAnalysis> {
    // First transcribe if text not provided
    let text = transcribedText;
    if (!text) {
      const transcriptionResult = await this.transcribeAudio(audioBuffer);
      text = transcriptionResult.text;
    }

    // Use GPT-5 to analyze voice characteristics based on transcribed text and patterns
    const analysisPrompt = `
      Analyze the following transcribed speech for voice characteristics and accent detection:
      
      Text: "${text}"
      
      Based on the speech patterns, word choices, and linguistic markers in this text, provide a detailed analysis in JSON format:
      {
        "accentType": "detected accent (e.g., 'british_rp', 'southern_us', 'neutral', 'australian', etc.)",
        "confidence": 0.85,
        "characteristics": {
          "pitch": 0.7,
          "rate": 0.6,
          "intensity": 0.8,
          "formants": [800, 1200, 2400]
        },
        "recommendations": [
          "Specific accent training suggestions",
          "Voice coaching recommendations"
        ]
      }
      
      Consider:
      - Vocabulary choices that indicate regional dialect
      - Sentence structure patterns
      - Probable pronunciation patterns
      - Speech rhythm indicators
      - Cultural/linguistic markers
      
      Provide confidence scores between 0-1 and practical recommendations.
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: "You are an expert speech pathologist and accent coach. Analyze speech patterns and provide detailed voice characteristics analysis."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        response_format: { type: "json_object" },
      });

      const analysis = JSON.parse(response.choices[0].message.content || "{}");
      
      return {
        accentType: analysis.accentType || "neutral",
        confidence: Math.min(Math.max(analysis.confidence || 0.5, 0), 1),
        characteristics: {
          pitch: Math.min(Math.max(analysis.characteristics?.pitch || 0.5, 0), 1),
          rate: Math.min(Math.max(analysis.characteristics?.rate || 0.5, 0), 1),
          intensity: Math.min(Math.max(analysis.characteristics?.intensity || 0.5, 0), 1),
          formants: Array.isArray(analysis.characteristics?.formants) 
            ? analysis.characteristics.formants.slice(0, 3) 
            : [800, 1200, 2400]
        },
        recommendations: Array.isArray(analysis.recommendations) 
          ? analysis.recommendations 
          : ["Continue practicing with varied speech patterns"]
      };
    } catch (error) {
      console.error("OpenAI analysis error:", error);
      
      // Fallback analysis
      return {
        accentType: "neutral",
        confidence: 0.3,
        characteristics: {
          pitch: 0.5,
          rate: 0.5,
          intensity: 0.5,
          formants: [800, 1200, 2400]
        },
        recommendations: ["Voice analysis temporarily unavailable - using basic profile"]
      };
    }
  }

  async generateVoiceProfile(audioBuffer: Buffer): Promise<{
    name: string;
    accentType: string;
    audioFeatures: any;
    confidence: number;
  }> {
    try {
      const analysis = await this.analyzeVoiceCharacteristics(audioBuffer);
      
      return {
        name: `Custom ${analysis.accentType} Profile`,
        accentType: analysis.accentType,
        audioFeatures: {
          analysisTimestamp: new Date().toISOString(),
          confidence: analysis.confidence,
          characteristics: analysis.characteristics,
          recommendations: analysis.recommendations,
          extractedFeatures: {
            pitch: analysis.characteristics.pitch,
            rate: analysis.characteristics.rate,
            intensity: analysis.characteristics.intensity,
            formants: analysis.characteristics.formants
          }
        },
        confidence: analysis.confidence
      };
    } catch (error) {
      console.error("Voice profile generation error:", error);
      throw new Error("Failed to generate voice profile using AI analysis");
    }
  }
}