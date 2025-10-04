import { useEffect, useMemo, useState } from 'react';
import { VoiceprintEngine } from '../voice/security/voiceprint';
import { VoiceSecurity } from '../state/voiceSecurity';

export function useVoiceprint(){
  const [sec, setSec] = useState(VoiceSecurity.load());
  const eng = useMemo(()=> new VoiceprintEngine(),[]);
  useEffect(()=> VoiceSecurity.save(sec), [sec]);

  async function enroll(seconds=7){
    await eng.start();
    const vp = await eng.enroll(seconds);
    setSec(s=>({...s, enrolled: vp }));
    return vp;
  }

  async function checkMatch(){
    if(!sec.enrolled){ return {ok: !sec.requireMatch, score: 0}; }
    await eng.start(sec.enrolled.sr);
    const score = eng.similarity(sec.enrolled);
    const ok = !sec.requireMatch || score >= sec.threshold;
    return {ok, score};
  }

  function setRequireMatch(v:boolean){ setSec(s=>({...s, requireMatch:v })); }
  function setThreshold(v:number){ setSec(s=>({...s, threshold:v })); }

  return { sec, enroll, checkMatch, setRequireMatch, setThreshold };
}