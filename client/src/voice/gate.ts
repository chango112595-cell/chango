import { DebugBus } from '../debug/DebugBus';
let enabled = false;
let wake = 'chango';
export const VoiceGate = {
  enable(word: string){ enabled = true; wake = (word||'chango').toLowerCase(); DebugBus.flag('Gate', true); },
  disable(){ enabled = false; DebugBus.flag('Gate', false); },
  check(txt: string){
    if (!enabled) return { pass: true, cmd: txt };
    const raw = (txt||'').toLowerCase();
    const i = raw.indexOf(wake);
    if (i === -1) return { pass: false, cmd: '' };
    const cmd = raw.slice(i + wake.length).replace(/^[\s,.:;-]+/, '');
    return { pass: !!cmd, cmd };
  }
};