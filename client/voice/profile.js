// Voice Profile API - Client-side interface for voice intelligence features

class VoiceProfileAPI {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Analyze audio sample for voice characteristics
   * @param {string} audioBase64 - Base64 encoded audio data
   * @param {string} note - Optional note about the recording
   * @returns {Promise<Object>} Analysis results with features
   */
  async analyzeSample(audioBase64, note = '') {
    try {
      const response = await fetch(`${this.baseUrl}/api/voice/intel/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioBase64,
          note
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze audio');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('[VoiceProfileAPI] Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Save voice profile with analyzed features
   * @param {string} name - Profile name
   * @param {Object} features - Voice features from analysis
   * @param {string} gender - Gender preset (neutral/female/male)
   * @param {string} accent - Accent preset
   * @returns {Promise<Object>} Saved profile info
   */
  async saveProfile(name, features, gender = 'neutral', accent = 'neutral') {
    try {
      const response = await fetch(`${this.baseUrl}/api/voice/intel/profile/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          features,
          gender,
          accent
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save profile');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('[VoiceProfileAPI] Save failed:', error);
      throw error;
    }
  }

  /**
   * List all saved voice profiles
   * @returns {Promise<Array>} List of profile summaries
   */
  async listProfiles() {
    try {
      const response = await fetch(`${this.baseUrl}/api/voice/intel/profile/list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to list profiles');
      }

      const result = await response.json();
      return result.profiles || [];
    } catch (error) {
      console.error('[VoiceProfileAPI] List failed:', error);
      throw error;
    }
  }

  /**
   * Get a specific voice profile by ID
   * @param {string} profileId - Profile ID
   * @returns {Promise<Object>} Full profile data
   */
  async getProfile(profileId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/voice/intel/profile/get/${profileId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Profile not found');
      }

      const result = await response.json();
      return result.profile;
    } catch (error) {
      console.error('[VoiceProfileAPI] Get profile failed:', error);
      throw error;
    }
  }

  /**
   * Delete a voice profile
   * @param {string} profileId - Profile ID to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteProfile(profileId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/voice/intel/profile/delete/${profileId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete profile');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('[VoiceProfileAPI] Delete failed:', error);
      throw error;
    }
  }

  /**
   * Get style presets for accent and gender
   * @param {string} accent - Accent type
   * @param {string} gender - Gender type
   * @param {Object} baseFeatures - Optional base features to modify
   * @returns {Promise<Object>} Style adjustments and modified features
   */
  async getStyle(accent = 'neutral', gender = 'neutral', baseFeatures = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api/voice/intel/style`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accent,
          gender,
          baseFeatures
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get style');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('[VoiceProfileAPI] Get style failed:', error);
      throw error;
    }
  }

  /**
   * Record audio from microphone
   * @param {number} duration - Recording duration in milliseconds
   * @returns {Promise<string>} Base64 encoded audio
   */
  async recordAudio(duration = 3000) {
    return new Promise((resolve, reject) => {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const mediaRecorder = new MediaRecorder(stream);
          const chunks = [];

          mediaRecorder.ondataavailable = (e) => {
            chunks.push(e.data);
          };

          mediaRecorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const reader = new FileReader();
            
            reader.onloadend = () => {
              const base64 = reader.result;
              stream.getTracks().forEach(track => track.stop());
              resolve(base64);
            };

            reader.onerror = () => {
              stream.getTracks().forEach(track => track.stop());
              reject(new Error('Failed to convert audio to base64'));
            };

            reader.readAsDataURL(blob);
          };

          mediaRecorder.onerror = (error) => {
            stream.getTracks().forEach(track => track.stop());
            reject(error);
          };

          mediaRecorder.start();

          // Stop recording after duration
          setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, duration);
        })
        .catch(error => {
          console.error('[VoiceProfileAPI] Microphone access failed:', error);
          reject(error);
        });
    });
  }

  /**
   * Apply profile to voice synthesis
   * @param {Object} profile - Voice profile to apply
   * @returns {Object} Prosody adjustments for synthesis
   */
  applyProfileToSynthesis(profile) {
    if (!profile || !profile.features) {
      return {
        pitch: 1.0,
        rate: 1.0,
        volume: 1.0
      };
    }

    const features = profile.features;
    
    // Convert features to synthesis adjustments
    const pitchAdjustment = features.pitchHint ? (features.pitchHint / 150) : 1.0;
    const rateAdjustment = features.speakingRate || 1.0;
    const volumeAdjustment = features.energy ? (0.8 + features.energy * 0.4) : 1.0;

    return {
      pitch: Math.max(0.5, Math.min(2.0, pitchAdjustment)),
      rate: Math.max(0.5, Math.min(2.0, rateAdjustment)),
      volume: Math.max(0.5, Math.min(1.5, volumeAdjustment)),
      gender: profile.gender || 'neutral',
      accent: profile.accent || 'neutral'
    };
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceProfileAPI;
}

// Export for browser use
if (typeof window !== 'undefined') {
  window.VoiceProfileAPI = VoiceProfileAPI;
}