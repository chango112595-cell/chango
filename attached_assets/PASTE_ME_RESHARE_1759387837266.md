# PASTE_ME.md — Chango AI (Jarvis Mode) • Local‑Only Voice • Always‑Listening • Futuristic HUD

This single file patches your current project **without third‑party TTS**, removes **Hands‑Free UI**, makes STT **always‑listening** (after one permission tap), fixes the **cancel recursion**, plugs in a **Jarvis‑style conversation engine**, and replaces the top bar with a **compact status capsule**. Everything is **isolated** and reversible.

> Apply each section by path. If a file doesn’t exist, create it. Keep your existing hologram/sphere and advanced local TTS — this only orchestrates and stabilizes it.

---

## 0) Feature Flags (central dials)
**File:** `src/config/featureFlags.ts`
```ts
export const Features = {
  HandsFreeUI: false,           // hide old hands-free widgets/logic
  WakeWord: false,              // disable "chango" hotword
  AlwaysListening: true,        // continuous STT (auto-restart)
  AnswerOnlyWhenAsked: true,    // speak only to user-initiated input
  CompactHeader: true,          // futuristic status capsule
  GuardedCancel: true,          // fix speech cancel stack loops
} as const;
export type FeatureKey = keyof typeof Features;
export const isOn = (k: FeatureKey) => !!Features[k];
```

---

## 1) Local‑only TTS Orchestrator (no Azure/Eleven)
**File:** `src/voice/tts/interfaces.ts`
```ts
export type VoiceGender = "male" | "female" | "neutral";
export type AccentCode = string;

export interface VoiceProfile {
  id: string;
  label: string;
  gender: VoiceGender;
  accent: AccentCode;
  rate?: number;
  pitch?: number;   // semitone delta
  volume?: number;  // 0..1
  params?: Record<string, any>;
}

export interface TTSSpeakOptions { text: string; profile?: VoiceProfile; }

export interface TTSProvider {
  id: string;
  name: string;
  isAvailable(): boolean;
  speak(opts: TTSSpeakOptions): Promise<void>;
  stop(): Promise<void>;
}
```

**File:** `src/voice/tts/orchestrator.ts`
```ts
import { TTSProvider, TTSSpeakOptions, VoiceProfile } from "./interfaces";

class VoiceOrchestrator {
  private provider!: TTSProvider;
  private defaultProfile: VoiceProfile = {
    id: "jarvis.default",
    label: "Jarvis • Default • en-US",
    gender: "neutral",
    accent: "en-US",
    rate: 1, pitch: 0, volume: 1,
  };

  registerLocal(provider: TTSProvider) { this.provider = provider; }
  isReady() { return !!this.provider && this.provider.isAvailable(); }

  async speak(opts: TTSSpeakOptions) {
    if (!this.isReady()) throw new Error("Local TTS not available");
    const merged = { ...opts, profile: opts.profile ?? this.defaultProfile };
    await this.provider.speak(merged);
  }
  async stop() { if (this.isReady()) await this.provider.stop(); }
}

export const voiceOrchestrator = new VoiceOrchestrator();
```

**File:** `src/voice/tts/providers/localNeural.ts`
```ts
import { TTSProvider, TTSSpeakOptions } from "../interfaces";

// Wire these to your existing advanced local pipeline:
declare function synthLocal(text: string, profile?: any): Promise<void>;
declare function stopLocal(): Promise<void>;
declare function localAvailable(): boolean;

export const LocalNeuralProvider: TTSProvider = {
  id: "local-neural",
  name: "Local Neural (Advanced)",
  isAvailable() { return typeof localAvailable === "function" ? localAvailable() : true; },
  async speak(opts: TTSSpeakOptions) { await synthLocal(opts.text, opts.profile); },
  async stop() { try { await stopLocal(); } catch {} },
};
```

**File:** `src/app/initTTS.ts`
```ts
import { voiceOrchestrator } from "../voice/tts/orchestrator";
import { LocalNeuralProvider } from "../voice/tts/providers/localNeural";

export function initTTS() {
  voiceOrchestrator.registerLocal(LocalNeuralProvider);
}
```

---

## 2) Voice Bus — safe cancel + async events
**File:** `src/voice/voiceBus.ts`
```ts
export type VoiceEvent =
  | { type: "start" }
  | { type: "end" }
  | { type: "error"; err: unknown }
  | { type: "cancel"; source?: "user" | "system" }
  | { type: "muteChange"; muted: boolean }
  | { type: "userSpeechRecognized"; text: string }
  | { type: "userTextSubmitted"; text: string };

type Listener = (ev: VoiceEvent) => void;

export class VoiceBusManager {
  private listeners = new Set<Listener>();
  private _isCancelling = false;
  private _cancelScheduled = false;
  public mute = false;
  public power = true;

  on(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  emitAsync(ev: VoiceEvent) {
    const fns = Array.from(this.listeners);
    for (const fn of fns) queueMicrotask(() => { try { fn(ev); } catch {} });
  }

  setMute(m: boolean) {
    this.mute = m;
    this.emitAsync({ type: "muteChange", muted: m });
    if (m && !this._isCancelling) this.cancelSpeak("system");
  }

  cancelSpeak(source: "user" | "system" = "user") {
    if (this._cancelScheduled) return;
    this._cancelScheduled = true;
    queueMicrotask(() => {
      this._cancelScheduled = false;
      if (this._isCancelling) return;
      this._isCancelling = true;
      try { if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel(); }
      finally { this._isCancelling = false; }
      this.emitAsync({ type: "cancel", source });
    });
  }

  emitUserSpeech(text: string) { this.emitAsync({ type: "userSpeechRecognized", text }); }
  emitUserText(text: string)   { this.emitAsync({ type: "userTextSubmitted", text }); }
}

export const voiceBus = new VoiceBusManager();
```

---

## 3) Always‑Listening STT (no push‑to‑talk, auto‑restart)
**File:** `src/voice/always_listen.ts`
```ts
import { voiceBus } from "./voiceBus";
import { isOn } from "../config/featureFlags";

type SR = SpeechRecognition & {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
};

function getSR(): SR | null {
  const SRImpl: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  return SRImpl ? new SRImpl() : null;
}

let rec: SR | null = null;
let enabled = true;
let restarting = false;
let hadUserGesture = false;

export async function startAlwaysListening() {
  if (!isOn("AlwaysListening")) return;
  if (!getSR()) { console.warn("SpeechRecognition not available."); return; }
  if (!hadUserGesture) await requireOneTapToEnable();
  if (rec) return;

  rec = getSR();
  rec!.lang = "en-US";
  rec!.continuous = true;
  rec!.interimResults = false;
  rec!.maxAlternatives = 1;

  rec!.onresult = (e: any) => {
    const res = e?.results?.[e.resultIndex];
    const alt = res && res[0];
    const text = alt?.transcript ? String(alt.transcript).trim() : "";
    if (text) voiceBus.emitUserSpeech(text);
  };
  rec!.onend = () => { if (enabled && !restarting) { restarting = true; setTimeout(()=>{ try{ rec?.start(); }catch{} restarting=false; },150); } };
  rec!.onerror = () => { if (enabled) setTimeout(()=>{ try{ rec?.start(); }catch{} }, 300); };

  try { rec!.start(); } catch {}

  document.addEventListener("visibilitychange", () => {
    if (!rec) return;
    if (document.hidden) { try { rec!.stop(); } catch {} }
    else if (enabled) { try { rec!.start(); } catch {} }
  });
}

export function stopAlwaysListening(){ enabled = false; try{ rec?.stop(); }catch{} }

function requireOneTapToEnable(): Promise<void> {
  return new Promise((resolve) => {
    if (hadUserGesture) return resolve();
    const btn = document.createElement("button");
    btn.textContent = "Enable Microphone";
    Object.assign(btn.style, {
      position: "fixed", inset: "0", margin: "auto", width: "220px", height: "54px",
      zIndex: "999999", borderRadius: "10px", border: "1px solid #888",
      background: "#111", color: "#fff", cursor: "pointer"
    });
    btn.onclick = () => { hadUserGesture = true; btn.remove(); resolve(); };
    document.body.appendChild(btn);
  });
}
```

**File:** `src/app/bootstrap.ts`
```ts
import { initTTS } from "./initTTS";
import { initConversationEngine } from "../modules/conversationEngine";
import { startAlwaysListening } from "../voice/always_listen";

export function bootstrapChango() {
  initTTS();
  initConversationEngine();
  startAlwaysListening();
}
```

Call `bootstrapChango()` once from your root (e.g., `main.tsx` or `App.tsx`).

---

## 4) Jarvis Conversation Engine (simple intents + small talk)
**File:** `src/modules/conversationEngine/index.ts`
```ts
import { voiceBus } from "../../voice/voiceBus";
import { voiceOrchestrator } from "../../voice/tts/orchestrator";
import { VoiceProfile } from "../../voice/tts/interfaces";
import { isOn } from "../../config/featureFlags";

const defaultProfile: VoiceProfile = {
  id: "jarvis.warm.enUS", label: "Jarvis • Warm • en-US",
  gender: "neutral", accent: "en-US", rate: 1, pitch: 0, volume: 1,
};

function route(text: string): string {
  const t = (text || "").toLowerCase().trim();
  if (/(time|what.*time)/.test(t)) return `It is ${new Date().toLocaleTimeString()}.`;
  if (/(date|today)/.test(t)) return `Today is ${new Date().toLocaleDateString()}.`;
  if (/who.*you|what.*chango/.test(t)) return `I’m Chango — your adaptive assistant.`;
  if (/how.*you/.test(t)) return `Feeling sharp and online. What can I do for you?`;
  if (/thank(s)?/.test(t)) return `You’re welcome.`;
  return `I heard: “${text}”. Would you like me to act on that?`;
}

export function initConversationEngine() {
  const handle = async (text: string) => {
    const reply = route(text);
    if (voiceBus.mute || !voiceBus.power) return;
    if (isOn("AnswerOnlyWhenAsked")) {
      // already user-initiated via speech/text → permitted
    }
    try { await voiceOrchestrator.speak({ text: reply, profile: defaultProfile }); }
    catch (e) { console.warn("TTS error", e); }
  };

  voiceBus.on((ev) => {
    if (ev.type === "userSpeechRecognized" && ev.text) handle(ev.text);
    if (ev.type === "userTextSubmitted" && ev.text)   handle(ev.text);
  });
}
```

**Optional Ask Bar (text input)**  
**File:** `src/ui/AskBar.tsx`
```tsx
import React from "react";
import { voiceBus } from "../voice/voiceBus";
export default function AskBar(){
  const [q, setQ] = React.useState("");
  return (
    <div className="flex gap-2">
      <input className="border rounded px-2 py-1 flex-1"
             value={q} onChange={(e)=>setQ(e.target.value)}
             onKeyDown={(e)=>{ if(e.key==='Enter'&&q.trim()){ voiceBus.emitUserText(q); setQ(''); } }}
             placeholder="Ask me anything…" />
      <button className="border rounded px-3 py-1"
              onClick={()=>{ if(q.trim()){ voiceBus.emitUserText(q); setQ(''); } }}>
        Ask
      </button>
    </div>
  );
}
```

---

## 5) Compact Futuristic Header (replaces old top bar)
**File:** `src/components/HeaderBar.tsx`
```tsx
import React from "react";
export default function HeaderBar(){
  return (
    <div className="flex items-center justify-between p-2 rounded-xl
      bg-gradient-to-r from-blue-600/40 to-cyan-500/40 backdrop-blur-md
      border border-blue-400/30 shadow-lg">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
        <span className="font-bold tracking-wide text-cyan-200">Chango AI</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-200">
        <span className="uppercase tracking-wider text-cyan-300">System</span>
        <span className="text-green-400">● Online</span>
      </div>
    </div>
  );
}
```

Use it where the old header was (e.g., in `App.tsx`):
```tsx
import HeaderBar from "./components/HeaderBar";
// ...
<HeaderBar />
```

---

## 6) Remove Hands‑Free UI (no toggle anywhere)
Wherever the Hands‑Free card existed, delete it **or** gate it:
```tsx
import { isOn } from "../config/featureFlags";
{isOn("HandsFreeUI") ? <HandsFreeCard/> : null}
```

Also remove any `handsFree` state checks in your STT/voice code.

---

## 7) Bootstrap once
**File:** `src/main.tsx` or `src/App.tsx`
```tsx
import { bootstrapChango } from "./app/bootstrap";
bootstrapChango();
```

---

## 8) Quick Smoke Test
1) Load app → click **Enable Microphone** once (browser requirement).  
2) Say: “Chango, what time is it?” → speaks the time, keeps listening.  
3) Mute via your existing control → speech stops (no loops).  
4) Header capsule shows **● Online**.

---

## 9) Rollback map
Only these files changed/added:
```
src/config/featureFlags.ts
src/voice/tts/interfaces.ts
src/voice/tts/orchestrator.ts
src/voice/tts/providers/localNeural.ts
src/app/initTTS.ts
src/voice/voiceBus.ts
src/voice/always_listen.ts
src/app/bootstrap.ts
src/modules/conversationEngine/index.ts
src/ui/AskBar.tsx (optional)
src/components/HeaderBar.tsx
```
Revert them to undo the patch.

— End —
