// Utility function to increment session counters
export const incrementSessionCounter = async (key: string): Promise<void> => {
  try {
    await fetch('/api/diagnostics/incr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ key })
    });
  } catch (error) {
    // Silently fail - session tracking is not critical functionality
    console.debug(`Failed to increment session counter for ${key}:`, error);
  }
};

// Specific counter functions for different events
export const trackTtsUtterance = () => incrementSessionCounter('ttsClientUtterances');
export const trackProfileLearned = () => incrementSessionCounter('profilesLearned');
export const trackCheckpointMade = () => incrementSessionCounter('checkpointsMade');