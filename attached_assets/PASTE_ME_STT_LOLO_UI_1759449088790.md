# PASTE_ME_STT_LOLO_UI.md — Fix STT (red), restore replies, keep only bottom Ask bar, wake‑word “lolo”

Apply these patches to get Chango responding again, with STT green, wake‑word **lolo**, and only the **bottom** Ask bar visible.

---

## 0) Feature flags (ensure)
**File:** `src/config/featureFlags.ts`
```ts
export const Features = {
  HandsFreeUI: false,
  WakeWord: true,
  AlwaysListening: true,
  AnswerOnlyWhenAsked: true,
  AnswerOnlyWhenAddressed: true,   // only speech addressed with wake-word passes
  CompactHeader: true,
  GuardedCancel: true,
  DebugOverlay: true,
  DebugBus: true,
  AutoHeal: true,
} as const;
export type FeatureKey = keyof typeof Features;
export const isOn = (k: FeatureKey) => !!Features[k];
```

---

## 1) Centralize wake‑word = “lolo”
**File:** `src/config/wakeword.ts`
```ts
export const Wakeword = {
  phrase: "lolo",
  regex: /^(?:\s*(hey|ok|yo)\s+)?lolo[\s,.:;-]*/i,
};
export type WakewordConfig = typeof Wakeword;
```

---

## 2) STT engine — robust init + events (fixes red STT)
**File:** `src/voice/always_listen.ts` (REPLACE or patch core)
```ts
// Robust, idempotent always-listen with logs + emits
import { voiceBus } from "./voiceBus";
import { dbg } from "../dev/debugBus";
import { beat } from "../dev/health/monitor";

let rec: SpeechRecognition | null = null;
let arming = false;

function getRecognizer(): SpeechRecognition | null {
  const w: any = window as any;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  return SR ? new SR() : null;
}

export function startAlwaysListening(){
  if (arming) return;
  arming = true;
  try{
    if (!rec){
      rec = getRecognizer();
      if (!rec){
        dbg.error("STT","unsupported","No Web Speech API available");
        arming = false;
        return;
      }
      rec.continuous = true;
      rec.interimResults = true;
      try { rec.lang = navigator.language || "en-US"; } catch {}
      dbg.info("STT","init","continuous");
    }

    rec.onstart = ()=>{ dbg.info("STT","start"); };
    rec.onend = ()=>{
      dbg.warn("STT","end","restart");
      setTimeout(()=>{ try{ rec && rec.start(); }catch(e){} }, 400);
    };
    rec.onerror = (e:any)=>{
      dbg.error("STT","error", String(e?.error || e?.message || e));
      // recover from common errors
      setTimeout(()=>{ try{ rec && rec.start(); }catch(_){} }, 600);
    };
    rec.onresult = (e:any)=>{
      const res = e?.results?.[e.resultIndex];
      const text = res && res[0]?.transcript ? String(res[0].transcript).trim() : "";
      if (text){
        dbg.info("STT","heard", text.slice(0,160));
        beat("stt");
        voiceBus.emitUserSpeech(text);
      }
    };

    try{ rec.start(); }catch{ /* already started */ }
  } finally {
    setTimeout(()=>{ arming = false; }, 100);
  }
}
```

---

## 3) Gate — require “lolo …” for speech; typing always allowed
**File:** `src/modules/listening/gate.ts` (REPLACE)
```ts
import { isOn } from "../../config/featureFlags";
import { Wakeword } from "../../config/wakeword";

export type GateResult = { allowed: boolean; text: string; reason: "wake"|"typed"|"blocked" };

export function passGate(raw: string, typed = false): GateResult {
  const input = (raw||"").trim();
  if (!input) return { allowed:false, text:"", reason:"blocked" };

  if (typed) return { allowed:true, text:input, reason:"typed" };

  if (isOn("WakeWord") && isOn("AnswerOnlyWhenAddressed")) {
    if (Wakeword.regex.test(input)) {
      const text = input.replace(Wakeword.regex, "").trim();
      return { allowed: !!text, text, reason:"wake" };
    }
    return { allowed:false, text:"", reason:"blocked" };
  }

  return { allowed:false, text:"", reason:"blocked" };
}
```

---

## 4) Conversation engine — wire typed vs speech; add logs
**File:** `src/modules/conversationEngine/index.ts` (PATCH)
```ts
import { passGate } from "../listening/gate";
import { dbg } from "../../dev/debugBus";
import { beat } from "../../dev/health/monitor";

export function initConversationEngine(){
  const handle = async (raw: string, typed = false) => {
    const g = passGate(raw, typed);
    if (!g.allowed) { dbg.info("NLP","gate.block", g.reason); return; }
    dbg.info("NLP","gate.pass", g.reason, g.text);
    beat("gate");
    const reply = await respond(g.text);   // your existing respond()
    dbg.info("TTS","speak", (reply||"").slice(0,160));
    beat("tts");
    await speak(reply);                    // your existing speak()
  };

  voiceBus.on(ev => {
    if (ev.type === "userSpeechRecognized" && ev.text) handle(ev.text, false);
    if (ev.type === "userTextSubmitted"  && ev.text) handle(ev.text, true);
  });
}
```

---

## 5) Bottom Ask bar = the only input (remove duplicate under chat)
1) **Hide/remove the chat‑panel input**  
   **File:** `src/components/chat/ChatPanel.tsx` (or equivalent)  
   - **Remove/Comment** the lower `<ChatInput/>` that sits under the messages list.

2) **Ensure the bottom dock Ask bar emits typed events**  
   **File:** `src/components/chat/BottomAskBar.tsx` (or your bottom input)
   ```tsx
   import React from "react";
   import { voiceBus } from "../../voice/voiceBus";

   export default function BottomAskBar(){
     const [val,setVal] = React.useState("");
     const submit = ()=>{
       const t = val.trim();
       if (!t) return;
       voiceBus.emitAsync?.({ type:"userTextSubmitted", text:t });
       setVal("");
     };
     return (
       <div className="fixed bottom-0 left-0 right-0 p-3 bg-black/40 backdrop-blur border-t border-white/10 z-40">
         <div className="max-w-3xl mx-auto flex gap-2">
           <input className="flex-1 bg-black/40 rounded border border-white/10 px-3 py-2"
                  value={val} onChange={e=>setVal(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Ask Chango…" />
           <button className="px-3 py-2 border border-cyan-400/60 rounded" onClick={submit}>Send</button>
         </div>
       </div>
     );
   }
   ```
   > If your `voiceBus` doesn’t expose `emitAsync`, emit with your bus’s API. Many setups accept `voiceBus.on/emit` — keep the event shape: `{ type: "userTextSubmitted", text }`.

3) **Remove duplicate CSS spacing** if the old input added bottom padding.

---

## 6) Voice bus helpers — keep mute/power safe + emit helpers
**File:** `src/voice/voiceBus.ts` (ensure these helpers exist)
```ts
export class VoiceBusManager {
  private listeners = new Set<(ev:any)=>void>();
  private _isCancelling=false;
  public mute=false; public power=true;

  on(fn:(ev:any)=>void){ this.listeners.add(fn); return ()=>this.listeners.delete(fn); }
  emitAsync(ev:any){ const f=[...this.listeners]; for(const fn of f) queueMicrotask(()=>fn(ev)); }

  setMute(v:boolean){ this.mute=v; this.emitAsync({type:"muteChange", muted:v}); if(v) this.cancelSpeak("system"); }
  setPower(v:boolean){ this.power=v; if(!v) this.cancelSpeak("system"); }

  cancelSpeak(source:"user"|"system"="user"){
    if(this._isCancelling) return;
    this._isCancelling=true;
    try{ if(typeof window!=="undefined" && window.speechSynthesis) window.speechSynthesis.cancel(); }
    finally{ this._isCancelling=false; }
    this.emitAsync({type:"cancel", source});
  }

  emitUserSpeech(text:string){ this.emitAsync({type:"userSpeechRecognized", text}); }
}
```

---

## 7) Bootstrap — ensure everything actually starts
**File:** `src/app/bootstrap.ts`
```ts
import { initTTS } from "./initTTS";
import { initConversationEngine } from "../modules/conversationEngine";
import { startAlwaysListening } from "../voice/always_listen";
import { startHealthWatch } from "../dev/health/monitor";

export function bootstrapChango(){
  initTTS();
  initConversationEngine();
  startAlwaysListening();
  startHealthWatch();
}
```
**File:** `src/main.tsx` (or `App.tsx`) — make sure it runs once
```ts
import { bootstrapChango } from "./app/bootstrap";
bootstrapChango();
```

---

## 8) Debug overlay — verify green STT
Mount this temporarily (if not already):
```tsx
{process.env.NODE_ENV !== "production" && <DebugOverlay/>}
```
You should see STT turn **green** after you speak; Gate shows pass only on **“lolo, …”** or typed.

---

## 9) Quick test
1) Talk normally → no reply (blocked).  
2) Say: **“lolo, what’s the time?”** → Chango replies.  
3) Type in bottom bar → Chango replies.  
4) STT dot turns green on speech; TTS shows “speak” before audio.

— end —
