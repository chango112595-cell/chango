// lib/orchestrator.ts
import { shouldWake } from './voice/wakeword';
import { sendToLLM } from '../llm/orchestrator';
import { voiceBus } from '../voice/voiceBus';
import { debugBus } from '../dev/debugBus';
import { isDuplicate } from './voice/dupGuard';

let speakingLock = false;

// Helper function to add messages to chat store if it exists
function addBotMessage(reply: string) {
  // Check if chatStore is available in the global scope
  if (typeof (window as any).chatStore !== 'undefined') {
    (window as any).chatStore.addBot(reply);
  }
}

export async function handleUserUtterance(text: string, opts: { wakewordOn: boolean }) {
  if (!text?.trim()) return;

  // Check for duplicate user utterance
  if (isDuplicate(text)) {
    debugBus.info('Gate', 'drop_duplicate_utterance');
    return;
  }

  // wakeword gate
  if (!shouldWake(text, opts.wakewordOn)) {
    debugBus.info('Orchestrator', 'Ignored - no wake word', { text });
    return;
  }

  // prevent double-processing while speaking
  if (speakingLock) {
    debugBus.warn('Orchestrator', 'Speaking lock active, ignoring', { text });
    return;
  }
  
  speakingLock = true;
  debugBus.info('Orchestrator', 'Processing utterance', { text });
  
  try {
    const reply = await sendToLLM(text); // your LLM/router
    
    // Check for duplicate bot reply
    if (isDuplicate(reply)) {
      debugBus.info('Gate', 'drop_duplicate_bot');
      return;
    }
    
    addBotMessage(reply);
    voiceBus.emitSpeak(reply, 'system'); // emit speak event for TTS to handle
  } catch (error) {
    debugBus.error('Orchestrator', 'Error processing utterance', { error });
  } finally {
    speakingLock = false;
    debugBus.info('Orchestrator', 'Speaking lock released');
  }
}

// Export for debugging/testing
export function isSpeaking(): boolean {
  return speakingLock;
}

export function resetSpeakingLock(): void {
  speakingLock = false;
}