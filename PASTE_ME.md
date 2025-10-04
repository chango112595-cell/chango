# PASTE_ME.md — ChangoAI (UI Preserved) • Isolated Voice + Debug + Security

**Promise:** No UI changes. This file only adds isolated modules (voice, permissions, diagnostics/debug). You just paste files and add **two lines** in your existing init/boot effect.

---

## Add these files (new; do not replace your UI)

```
client/
  debug/DebugBus_safe.ts
  diagnostics/DiagnosticsSafe.ts
  lib/permissions_safe.ts
  voice/
    gate_safe.ts
    stt_safe.ts
    tts_safe.ts
    alwaysListen_safe.ts
  llm/orchestrator_safe.ts
  types/global-speech.d.ts
```

---

## client/debug/DebugBus_safe.ts
```ts
type Level = 'ok'|'info'|'warn'|'error';
type Event = { tag: string; level: Level; msg: string; data?: any; ts?: number };

const listeners = new Set<(e: Event) => void>();
const flags = new Map<string, boolean>();

export const DebugBusSafe = {
  on(fn:(e:Event)=>void){ listeners.add(fn); return ()=>listeners.delete(fn); },
  emit(e: Event){
    e.ts = e.ts || Date.now();
    for (const fn of listeners) { try{ fn(e); }catch{} }
    const line = `[${new Date(e.ts).toISOString()}][${e.level}] ${e.tag}: ${e.msg}`;
    (e.level==='error'?console.error:e.level==='warn'?console.warn:console.log)(line, e.data??"");
  },
  defineFlags(names: string[]){ names.forEach(n=>flags.set(n,false)); },
  flag(name: string, val: boolean){ flags.set(name,val); DebugBusSafe.emit({tag:'FLAG',level:'info',msg:`${name}=${val}`}); },
  snapshot(){ return Object.fromEntries(flags.entries()); }
};
```

---

## client/diagnostics/DiagnosticsSafe.ts
```ts
import { DebugBusSafe } from '../debug/DebugBus_safe';

type Probe = {
  name: string;
  everyMs: number;
  run: () => Promise<void> | void;
};

const probes: Probe[] = [
  {
    name: 'heartbeat',
    everyMs: 5000,
    run: () => {
      DebugBusSafe.emit({ tag: 'Diag', level: 'ok', msg: 'heartbeat' });
    }
  },
  {
    name: 'mem_estimate',
    everyMs: 8000,
    run: () => {
      // rough estimate; browser-only
      // @ts-ignore
      const mem: any = (performance as any).memory;
      if (mem) {
        DebugBusSafe.emit({ tag:'Diag', level:'info', msg:`mem used ~${Math.round(mem.usedJSHeapSize/1e6)}MB` });
      }
    }
  }
];

let started = false;
export function startDiagnosticsSafe(){
  if (started) return;
  started = true;
  probes.forEach(p => {
    setInterval(() => {
      try { const r = p.run(); if (r instanceof Promise) r.catch(()=>{}); }
      catch {}
    }, p.everyMs);
  });
  DebugBusSafe.emit({ tag:'Diag', level:'ok', msg:'diagnostics started' });
}
```

---

## client/lib/permissions_safe.ts
```ts
export type MicState = 'unknown'|'granted'|'denied'|'blocked'|'prompt';
let audioUnlocked = false;

export async function unlockAudioContext(ctx: AudioContext) {
  if (ctx.state === 'suspended') await ctx.resume();
  audioUnlocked = true;
}
export function isAudioUnlocked(){ return audioUnlocked; }

export async function checkMicPermission(): Promise<MicState> {
  try {
    // @ts-ignore
    if (navigator.permissions?.query) {
      // @ts-ignore
      const s = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (s.state==='granted') return 'granted';
      if (s.state==='denied')   return 'denied';
      return 'prompt';
    }
  } catch {}
  try {
    const strm = await navigator.mediaDevices.getUserMedia({ audio:true });
    strm.getTracks().forEach(t=>t.stop());
    return 'granted';
  } catch(e:any){
    const n = e?.name||'';
    if (n==='NotAllowedError'||n==='SecurityError') return 'denied';
    if (n==='NotFoundError') return 'blocked';
    return 'prompt';
  }
}

export async function requestMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true, channelCount:1, sampleRate:44100 }
  });
}
```

---

## client/voice/gate_safe.ts
```ts
import { DebugBusSafe } from '../debug/DebugBus_safe';
let enabled=false; let wake='lolo';
export const VoiceGateSafe = {
  enable(word:string){ enabled=true; wake=(word||'lolo').toLowerCase(); DebugBusSafe.flag('Gate',true); },
  disable(){ enabled=false; DebugBusSafe.flag('Gate',false); },
  check(txt:string){
    if(!enabled) return {pass:true, cmd:txt};
    const raw=(txt||'').toLowerCase(); const i=raw.indexOf(wake);
    if(i===-1) return {pass:false, cmd:''};
    const cmd=raw.slice(i+wake.length).replace(/^[\s,.:;-]+/,'');
    return {pass:!!cmd, cmd};
  }
};
```

---

## client/voice/stt_safe.ts
```ts
import { DebugBusSafe } from '../debug/DebugBus_safe';
import { VoiceGateSafe } from './gate_safe';
import { speakSafe } from './tts_safe';
import { sendToLLMSafe } from '../llm/orchestrator_safe';

let rec: SpeechRecognition | null = null;

export async function startSTTSafe(){
  if (typeof window === 'undefined') return;
  stopSTTSafe();
  const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if(!SR) throw new Error('no_speech_recognition');

  rec = new SR(); rec.lang='en-US'; rec.continuous=true; rec.interimResults=true;

  rec.onresult = async (ev: SpeechRecognitionEvent) => {
    let final=''; for(let i=ev.resultIndex;i<ev.results.length;i++){ const r=ev.results[i]; if(r.isFinal) final+=r[0].transcript; }
    if(!final) return;
    const raw=final.trim(); DebugBusSafe.emit({tag:'STT',level:'info',msg:`heard="${raw.toLowerCase()}"`});
    const check=VoiceGateSafe.check(raw); if(!check.pass){ DebugBusSafe.emit({tag:'Gate',level:'info',msg:'ignored (no wake word)'}); return; }
    const reply = await sendToLLMSafe(check.cmd); DebugBusSafe.emit({tag:'Orch',level:'ok',msg:`reply="${(reply||'').slice(0,80)}..."`});
    await speakSafe(reply);
  };
  rec.onerror=(e:any)=>DebugBusSafe.emit({tag:'STT',level:'error',msg:e?.error||'stt_error'});
  rec.onend = ()=>{ DebugBusSafe.emit({tag:'STT',level:'warn',msg:'recognizer ended – auto-restart'}); try{ rec?.start(); }catch{} };

  try{ rec.start(); DebugBusSafe.emit({tag:'STT',level:'ok',msg:'recognizer started'}); }
  catch(e:any){ DebugBusSafe.emit({tag:'STT',level:'error',msg:`start failed: ${e?.message||e}`}); throw e; }
}

export function stopSTTSafe(){ try{ rec?.stop(); }catch{} rec=null; }
```

---

## client/voice/tts_safe.ts
```ts
import { DebugBusSafe } from '../debug/DebugBus_safe';
export async function speakSafe(text: string){
  if (typeof window === 'undefined') return;
  if (!('speechSynthesis' in window)) { DebugBusSafe.emit({tag:'TTS',level:'warn',msg:'no WebSpeech'}); return; }
  let speaking = false;
  try{
    if (speaking){ window.speechSynthesis.cancel(); speaking=false; }
    const utter = new SpeechSynthesisUtterance(text||'');
    utter.rate=1; utter.pitch=1; utter.volume=1;
    utter.onstart=()=>{ speaking=true; DebugBusSafe.flag('TTS',true); };
    utter.onend=()=>{ speaking=false; DebugBusSafe.flag('TTS',false); };
    utter.onerror=(e:any)=>{ speaking=false; DebugBusSafe.emit({tag:'TTS',level:'error',msg:e?.error||'tts_error'}); };
    window.speechSynthesis.speak(utter);
  }catch(e:any){ DebugBusSafe.emit({tag:'TTS',level:'error',msg:e?.message||'tts_failed'}); }
}
```

---

## client/voice/alwaysListen_safe.ts
```ts
import { checkMicPermission, requestMicStream, unlockAudioContext } from '../lib/permissions_safe';
import { DebugBusSafe } from '../debug/DebugBus_safe';
import { startSTTSafe, stopSTTSafe } from './stt_safe';
import { VoiceGateSafe } from './gate_safe';

let running=false; let ctx: AudioContext | null = null;
async function ensureAudioUnlocked(){ if(!ctx) ctx=new (window.AudioContext||(window as any).webkitAudioContext)(); await unlockAudioContext(ctx); }

export async function startAlwaysListenSafe({ wakeWord='lolo', enabled=true }={}) {
  if(running||!enabled) return;
  try{
    await ensureAudioUnlocked();
    const state = await checkMicPermission();
    DebugBusSafe.emit({tag:'AlwaysListen',level:'info',msg:`perm=${state}`});
    if(state==='denied'||state==='blocked') throw new Error('mic_denied');

    const s = await requestMicStream(); s.getTracks().forEach(t=>t.stop());
    VoiceGateSafe.enable(wakeWord);
    await startSTTSafe();
    running=true; DebugBusSafe.flag('STT',true); DebugBusSafe.flag('Gate',true);
  }catch(e:any){
    running=false; DebugBusSafe.flag('STT',false); DebugBusSafe.flag('Gate',false);
    DebugBusSafe.emit({tag:'AlwaysListen',level:'error',msg:`startup_failed: ${e?.message||e}`});
  }
}

export async function stopAlwaysListenSafe(){
  try{ VoiceGateSafe.disable(); await stopSTTSafe(); }
  finally { running=false; DebugBusSafe.flag('STT',false); DebugBusSafe.flag('Gate',false); }
}
```

---

## client/llm/orchestrator_safe.ts
```ts
export async function sendToLLMSafe(q:string){
  const t=q.toLowerCase().trim();
  if(/time/.test(t)){ const n=new Date(); return `The current time is ${n.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}.`; }
  if(/date/.test(t)){ const n=new Date(); return `Today is ${n.toLocaleDateString()}.`; }
  if(/who\s*are\s*you/.test(t)||/your name/.test(t)) return "I'm Chango, online and listening.";
  return "Got it. What else should I do?";
}
```

---

## client/types/global-speech.d.ts
```ts
declare interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
declare interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onend?: (ev: Event) => any;
  onerror?: (ev: any) => any;
  onresult?: (ev: SpeechRecognitionEvent) => any;
}
declare var webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};
declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
} | undefined;
```

---

## Minimal wiring (no UI change)
Add these two lines inside **your existing init effect/boot file**:

```ts
import { DebugBusSafe } from '@/debug/DebugBus_safe';
import { startAlwaysListenSafe } from '@/voice/alwaysListen_safe';

DebugBusSafe.defineFlags(['STT','TTS','Gate','Orch']);
startAlwaysListenSafe({ enabled: true, wakeWord: 'lolo' });
```
> If you don’t use `@/`, change to relative imports like `./client/...`

---

### Sanity check
- Build: no alias/type errors (add Vite/TS alias if needed).  
- Logs: `perm=granted` → `recognizer started`.  
- Say: “**lolo what time is it**” → spoken time reply.

