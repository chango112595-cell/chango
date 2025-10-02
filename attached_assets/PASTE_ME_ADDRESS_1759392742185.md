# PASTE_ME_ADDRESS.md — Reply **only** when directly addressed (“Chango, …”)

This patch tightens the listening gate so Chango speaks **only** when you explicitly address him (wake‑word) or when you submit text in the Ask bar. Background speech won’t trigger replies.

It assumes you already applied the Jarvis patch (always‑listening STT, local TTS, conversation engine).

---

## 0) Feature flags — enforce direct address
**File:** `src/config/featureFlags.ts` (ADD/ADJUST)
```ts
export const Features = {
  HandsFreeUI: false,
  WakeWord: true,                 // REQUIRED: direct address with “Chango”
  AlwaysListening: true,          // STT keeps running, but gated
  AnswerOnlyWhenAsked: true,      // speak only on allowed inputs
  CompactHeader: true,
  GuardedCancel: true,

  // NEW: extra safety (no generic passive answers)
  AnswerOnlyWhenAddressed: true,
} as const;
export type FeatureKey = keyof typeof Features;
export const isOn = (k: FeatureKey) => !!Features[k];
```
> With `AnswerOnlyWhenAddressed = true`, generic questions/commands without the wake‑word are blocked from speech. You can still type via the Ask bar.

---

## 1) Gate — require wake‑word unless text is typed
**File:** `src/modules/listening/gate.ts` (REPLACE)
```ts
import { isOn } from "../../config/featureFlags";

const WAKE = /^(?:\s*(hey|ok|yo)\s+)?chango[\s,.:;-]*/i;
const DIRECT_QUESTION = /(\?|^(what|who|when|where|why|how)\b)/i;
const DIRECT_COMMAND  = /\b(set|open|start|show|play|define|explain|summarize|translate|call|text|create|make)\b/i;

export type GateResult = { allowed: boolean; text: string; reason: "wake"|"typed"|"blocked" };

// 'typed' pathway will be used by AskBar (userTextSubmitted)
export function passGate(raw: string, typed = false): GateResult {
  const input = (raw||"").trim();
  if (!input) return { allowed:false, text:"", reason:"blocked" };

  // If user typed, always allow (explicit intent)
  if (typed) return { allowed:true, text:input, reason:"typed" };

  // Enforce direct address
  if (isOn("WakeWord") && isOn("AnswerOnlyWhenAddressed")) {
    if (WAKE.test(input)) {
      const text = input.replace(WAKE, "").trim();
      return { allowed: !!text, text, reason:"wake" };
    }
    // Block generic questions/commands when not addressed to Chango
    return { allowed:false, text:"", reason:"blocked" };
  }

  // Fallback behavior (less strict)
  if (isOn("WakeWord") && WAKE.test(input)) {
    const text = input.replace(WAKE, "").trim();
    return { allowed: !!text, text, reason:"wake" };
  }
  if (DIRECT_QUESTION.test(input) || DIRECT_COMMAND.test(input)) {
    return { allowed:true, text:input, reason:"wake" };
  }
  return { allowed:false, text:"", reason:"blocked" };
}
```

---

## 2) Conversation engine — pass `typed=true` for AskBar
**File:** `src/modules/conversationEngine/index.ts` (PATCH inside `initConversationEngine`)
```ts
import { passGate } from "../listening/gate";

export function initConversationEngine(){
  const handle = async (raw: string, typed = false) => {
    const g = passGate(raw, typed);
    if (!g.allowed) return;
    await respond(g.text);
  };

  voiceBus.on(ev => {
    if (ev.type === "userSpeechRecognized" && ev.text) handle(ev.text, false);
    if (ev.type === "userTextSubmitted"  && ev.text) handle(ev.text, true); // typed intent
  });
}
```

---

## 3) Optional: mini debug overlay (see blocks in real time)
**File:** `src/dev/DebugOverlay.tsx` (same as earlier debug overlay). Mount it temporarily to verify events.

---

## 4) Quick test
1) Say **“What time is it?”** → **No reply** (blocked).
2) Say **“Chango, what time is it?”** → **Speaks the time**.
3) Type **“What time is it?”** in Ask bar → **Speaks the time**.

That’s it — Chango now answers **only** when you directly address him.
