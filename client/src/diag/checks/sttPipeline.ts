import { registerHealthCheck } from '../healthRegistry';
import { voiceBus } from '../../voice/voiceBus';

let lastUserSpeech = Date.now();
voiceBus.on('userSpeechRecognized', (ev) => { 
  lastUserSpeech = Date.now(); 
});

registerHealthCheck({
  name: 'stt.pipeline',
  cadenceMs: 1000,
  run: () => {
    const tooLongSilent = Date.now() - lastUserSpeech > 15000; // 15s
    if(!tooLongSilent) return { ok: true };
    return {
      ok: false,
      event: { id:'stt.pipeline.idle', domain:'stt', severity:'warn', msg:'STT appears idle for 15s', fixable:true },
      fix: async () => {
        try{
          // ask STT to restart if exposed
          await (window as any).__chango?.stt?.restart?.();
          return true;
        }catch{ return false; }
      }
    };
  }
});