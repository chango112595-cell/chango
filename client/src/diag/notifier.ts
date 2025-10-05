import { diagBus, HealthEvent } from './diagBus';

type Policy = {
  speak: (e:HealthEvent) => boolean; // should TTS speak it?
  toast: (e:HealthEvent) => boolean; // UI toast?
};

const policy: Policy = {
  speak: (e) => {
    // Always speak critical issues
    if (e.severity === 'critical') return true;
    
    // Speak conversation engine errors
    if (e.domain === 'core' && e.severity === 'error') return true;
    
    // Speak other non-UI errors
    if (e.severity === 'error' && e.domain !== 'ui') return true;
    
    return false;
  },
  toast: (e) => e.severity !== 'info'
};

// Plug into your TTS + UI toast safely via adapters
type Adapters = { speak:(s:string)=>void; toast:(s:string, sev:HealthEvent['severity'])=>void; log:(...a:any[])=>void; };
export function attachDiagNotifier(ad: Adapters){
  diagBus.on(e=>{
    ad.log?.('[Diag]', e.severity, e.domain, e.msg);
    if(policy.toast(e)) ad.toast?.(e.msg, e.severity);
    
    if(policy.speak(e)) {
      // Create more specific messages for conversation engine issues
      let message = '';
      
      if (e.domain === 'core') {
        switch(e.id) {
          case 'conversation.engine.not.initialized':
            message = 'Critical: Conversation engine is not initialized. I cannot process messages.';
            break;
          case 'conversation.not.responding':
            message = 'Error: I am not receiving responses to your messages. Please check the system.';
            break;
          case 'conversation.response.timeout':
            message = 'Warning: Message response timed out. The system may be overloaded.';
            break;
          case 'conversation.high.failure.rate':
            message = 'Error: Multiple message processing failures detected.';
            break;
          default:
            message = `Conversation error: ${e.msg}`;
        }
      } else if (e.domain === 'mic' && e.id === 'mic.permission.denied') {
        message = 'Microphone permission denied. Please grant permission to use voice commands.';
      } else if (e.domain === 'tts' && e.id === 'tts.stuck.long') {
        message = 'Text-to-speech system appears stuck. Attempting recovery.';
      } else if (e.domain === 'stt' && e.id === 'stt.pipeline.idle') {
        message = 'Speech recognition is idle. Attempting to restart.';
      } else {
        message = `System alert: ${e.msg}`;
      }
      
      ad.speak?.(message);
    }
  });
}