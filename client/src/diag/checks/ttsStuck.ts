import { registerHealthCheck } from '../healthRegistry';

let lastSpeak = 0;
(window as any).__chango = (window as any).__chango || {};
(window as any).__chango.ttsSpoke = () => { lastSpeak = Date.now(); };

registerHealthCheck({
  name: 'tts.stuck',
  cadenceMs: 1000,
  run: () => {
    const speaking = !!window.speechSynthesis?.speaking;
    if(!speaking) return { ok: true };
    // if speaking for > 12s continuously, assume stuck
    if(Date.now() - lastSpeak > 12000){
      return {
        ok:false,
        event:{ id:'tts.stuck.long', domain:'tts', severity:'error', msg:'TTS seems stuck >12s', fixable:true },
        fix: async () => { try{ window.speechSynthesis?.cancel(); return true; }catch{ return false; } }
      };
    }
    return { ok:true };
  }
});