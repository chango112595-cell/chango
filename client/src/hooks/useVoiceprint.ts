import { useEffect, useMemo, useState } from 'react';
import { VoiceprintEngine } from '../voice/security/voiceprint';
import { VoiceSecurity } from '../state/voiceSecurity';
import { debugBus } from '../dev/debugBus';
import { FEATURES } from '../config/features';

export function useVoiceprint(){
  const [sec, setSec] = useState(VoiceSecurity.load());
  const eng = useMemo(()=> new VoiceprintEngine(),[]);
  useEffect(()=> VoiceSecurity.save(sec), [sec]);

  async function enroll(seconds=7){
    // Emit enrollment start event
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('useVoiceprint', 'enrollment_started', { seconds });
    }
    
    await eng.start();
    const vp = await eng.enroll(seconds);
    setSec(s=>({...s, enrolled: vp }));
    
    // Emit enrollment complete event
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('useVoiceprint', 'enrollment_completed', { 
        frames: vp.frames,
        sampleRate: vp.sr,
        createdAt: vp.createdAt 
      });
    }
    
    return vp;
  }

  async function checkMatch(){
    if(!sec.enrolled){ 
      // Emit check without enrollment
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('useVoiceprint', 'check_no_enrollment', { 
          requireMatch: sec.requireMatch 
        });
      }
      return {ok: !sec.requireMatch, score: 0}; 
    }
    
    await eng.start(sec.enrolled.sr);
    const score = eng.similarity(sec.enrolled);
    const ok = !sec.requireMatch || score >= sec.threshold;
    
    // Emit verification result
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('useVoiceprint', 'verification_result', { 
        ok,
        score,
        threshold: sec.threshold,
        requireMatch: sec.requireMatch
      });
    }
    
    return {ok, score};
  }

  function setRequireMatch(v:boolean){ 
    setSec(s=>({...s, requireMatch:v })); 
    
    // Emit security setting change
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('useVoiceprint', 'security_setting_changed', { 
        setting: 'requireMatch',
        value: v 
      });
    }
  }
  
  function setThreshold(v:number){ 
    setSec(s=>({...s, threshold:v })); 
    
    // Emit threshold change
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('useVoiceprint', 'security_setting_changed', { 
        setting: 'threshold',
        value: v 
      });
    }
  }

  return { sec, enroll, checkMatch, setRequireMatch, setThreshold };
}