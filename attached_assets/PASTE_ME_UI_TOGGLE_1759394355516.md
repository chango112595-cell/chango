# PASTE_ME_UI_TOGGLE.md — Compact Futuristic Header + Toggleable Hologram Sphere

This adds a **UI mode switch** so you can choose between:
- **HUD Header** (compact, futuristic capsule bar), or
- **Hologram Sphere** (floating Jarvis-style orb that idles/activates).

Everything is isolated and reversible.

---

## 0) Feature flags
**File:** `src/config/featureFlags.ts` (ADD keys if missing)
```ts
export const Features = {
  HandsFreeUI: false,
  WakeWord: true,
  AlwaysListening: true,
  AnswerOnlyWhenAsked: true,
  CompactHeader: true,
  GuardedCancel: true,

  // NEW
  UiModeToggle: true,          // enables header <-> sphere switch
} as const;
export type FeatureKey = keyof typeof Features;
export const isOn = (k: FeatureKey) => !!Features[k];
```

---

## 1) UI mode store (persists to localStorage)
**File:** `src/state/uiMode.ts`
```ts
import { create } from "zustand";

export type UIMode = "header" | "sphere";
type State = { mode: UIMode; setMode: (m: UIMode)=>void };

const KEY = "chango.uiMode";

export const useUIMode = create<State>((set)=>{
  let initial: UIMode = "header";
  try { initial = (localStorage.getItem(KEY) as UIMode) || "header"; } catch {}
  return {
    mode: initial,
    setMode: (m)=>{
      try { localStorage.setItem(KEY, m); } catch {}
      set({ mode: m });
    }
  };
});
```

---

## 2) Compact futuristic header (reuse or install)
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

---

## 3) Hologram Sphere component + styles
**File:** `src/components/HologramSphere.tsx`
```tsx
import React from "react";
import { useEffect, useRef } from "react";

type Props = {
  state?: "idle" | "listening" | "speaking" | "error";
};

// Pure CSS/Canvas glow, no heavy libs
export default function HologramSphere({ state="idle" }: Props){
  const ref = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if (!ref.current) return;
    const el = ref.current;
    el.dataset.state = state;
  }, [state]);

  return (
    <div className="ch-sphere-wrap">
      <div ref={ref} className="ch-sphere">
        <div className="ring ring-a"></div>
        <div className="ring ring-b"></div>
        <div className="core"></div>
      </div>
    </div>
  );
}
```

**File:** `src/components/hologram.css`
```css
.ch-sphere-wrap{
  position: fixed; right: 20px; bottom: 24px; z-index: 30;
  width: 120px; height: 120px; pointer-events: none;
}
.ch-sphere{ position: relative; width: 100%; height: 100%; filter: drop-shadow(0 0 12px rgba(0,255,200,.35)); }
.core{
  position:absolute; inset: 28% 28%; border-radius:50%;
  background: radial-gradient(circle at 50% 35%, rgba(0,255,170,.7), rgba(0,100,255,.25) 60%, transparent 61%);
  box-shadow: 0 0 20px rgba(0,255,170,.45), inset 0 0 24px rgba(0,255,200,.35);
  animation: corePulse 2.4s ease-in-out infinite;
}
.ring{
  position:absolute; inset:0; border-radius:50%;
  border: 1px solid rgba(0,255,200,.28);
  box-shadow: inset 0 0 22px rgba(0,255,200,.18);
}
.ring-a{ animation: ringSpinA 12s linear infinite; }
.ring-b{ animation: ringSpinB 18s linear infinite; }

@keyframes ringSpinA{ from{ transform: rotateX(60deg) rotateZ(0deg); } to{ transform: rotateX(60deg) rotateZ(360deg);} }
@keyframes ringSpinB{ from{ transform: rotateY(60deg) rotateZ(0deg); } to{ transform: rotateY(60deg) rotateZ(360deg);} }
@keyframes corePulse{ 0%,100%{ transform: scale(1); opacity:.9 } 50%{ transform: scale(1.06); opacity:1 } }

/* state colors */
.ch-sphere[data-state="idle"] .core{ box-shadow: 0 0 18px rgba(0,255,170,.45), inset 0 0 24px rgba(0,255,200,.35); }
.ch-sphere[data-state="listening"] .core{ box-shadow: 0 0 22px rgba(0,255,255,.55), inset 0 0 26px rgba(0,255,255,.45); }
.ch-sphere[data-state="speaking"] .core{ box-shadow: 0 0 28px rgba(255,215,0,.6), inset 0 0 28px rgba(255,215,0,.45); }
.ch-sphere[data-state="error"] .core{ box-shadow: 0 0 26px rgba(255,60,60,.65), inset 0 0 28px rgba(255,60,60,.45); }
```

---

## 4) UI switcher (toggle Header ↔ Sphere)
**File:** `src/components/UiModeSwitch.tsx`
```tsx
import React from "react";
import { useUIMode } from "../state/uiMode";

export default function UiModeSwitch(){
  const { mode, setMode } = useUIMode();
  return (
    <div className="fixed right-4 top-4 z-40 flex gap-2 items-center
                    bg-black/40 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-md">
      <span className="text-xs opacity-70">UI</span>
      <button
        onClick={()=>setMode("header")}
        className={"text-xs px-2 py-1 rounded-full border " + (mode==="header" ? "border-cyan-300" : "border-transparent opacity-60")}>
        Header
      </button>
      <button
        onClick={()=>setMode("sphere")}
        className={"text-xs px-2 py-1 rounded-full border " + (mode==="sphere" ? "border-cyan-300" : "border-transparent opacity-60")}>
        Sphere
      </button>
    </div>
  );
}
```

---

## 5) Wire it up in your layout
**File:** `src/App.tsx` (or your main HUD page)
```tsx
import React from "react";
import HeaderBar from "./components/HeaderBar";
import HologramSphere from "./components/HologramSphere";
import "./components/hologram.css";
import UiModeSwitch from "./components/UiModeSwitch";
import { useUIMode } from "./state/uiMode";
import { isOn } from "./config/featureFlags";

export default function App(){
  const { mode } = useUIMode();

  return (
    <div className="min-h-screen bg-black text-white">
      {mode === "header" && isOn("CompactHeader") && (
        <div className="p-3">
          <HeaderBar />
        </div>
      )}

      {/* Your existing HUD content goes here */}
      <div className="p-4">
        {/* ... keep your current panels / chat / controls ... */}
      </div>

      {mode === "sphere" && <HologramSphere state="idle" />}

      {isOn("UiModeToggle") && <UiModeSwitch />}
    </div>
  );
}
```

> The sphere’s `state` can be wired to your voice lifecycle later (`idle/listening/speaking/error`). For now it idles beautifully.

---

## 6) Quick test
1) App loads → tap **UI: Sphere** → floating orb appears (bottom-right).  
2) Tap **UI: Header** → back to compact status bar.  
3) Nothing else changes in your voice pipeline.

---

## 7) Rollback
Delete the new files and remove the few imports; everything else stays intact.
