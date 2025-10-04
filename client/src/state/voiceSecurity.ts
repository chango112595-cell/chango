export type SecurityState = {
  requireMatch: boolean;
  threshold: number;
  enrolled?: import('../voice/security/voiceprint').Voiceprint;
};

const KEY='chango.voice.security.v1';

export const VoiceSecurity = {
  load(): SecurityState{
    try{ return JSON.parse(localStorage.getItem(KEY) || '') as SecurityState; }catch{}
    return { requireMatch:false, threshold:0.82 };
  },
  save(s:SecurityState){ localStorage.setItem(KEY, JSON.stringify(s)); }
};