declare module 'wav-decoder' {
  /**
   * Decoded audio data from a WAV file
   */
  export interface AudioData {
    /**
     * Audio sample data for each channel
     * Each channel is represented as a Float32Array of audio samples
     */
    channelData: Float32Array[];
    
    /**
     * Sample rate of the audio in Hz (e.g., 44100, 48000)
     */
    sampleRate: number;
    
    /**
     * Optional: Number of channels (derived from channelData.length)
     */
    numberOfChannels?: number;
    
    /**
     * Optional: Total length of the audio in samples
     */
    length?: number;
  }

  /**
   * Decode a WAV file from an ArrayBuffer
   * @param buffer - The ArrayBuffer containing the WAV file data
   * @returns Promise resolving to the decoded audio data
   */
  export function decode(buffer: ArrayBuffer): Promise<AudioData>;
}