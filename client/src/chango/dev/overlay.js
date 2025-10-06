// Hidden dev overlay; draws phoneme timeline when enabled; non-interactive; no UI changes.
import { eventBus as bus } from "../core/eventBus.js";
export class PhonemeOverlay {
  constructor() {
    this.enabled = this._shouldEnable();
    this.root = null; this.canvas = null; this.ctx = null;
    if (this.enabled) this._mount();
    bus.on("tts:timeline", (payload) => { if (this.enabled) this._draw(payload); });
  }
  _shouldEnable() {
    // Why: keep default off; opt-in via query or localStorage.
    const qs = new URLSearchParams(location.search);
    if (qs.get("changoDev") === "1") return true;
    try { return localStorage.getItem("changoDev") === "1"; } catch { return false; }
  }
  _mount() {
    this.root = document.createElement("div");
    Object.assign(this.root.style, { position: "fixed", left: "0", right: "0", bottom: "0", height: "120px", pointerEvents: "none", zIndex: "2147483647", background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.35))", display: "none" });
    this.canvas = document.createElement("canvas"); this.canvas.width = window.innerWidth; this.canvas.height = 120;
    this.root.appendChild(this.canvas); document.body.appendChild(this.root);
    this.ctx = this.canvas.getContext("2d");
    window.addEventListener("resize", () => { this.canvas.width = window.innerWidth; this._redraw(); });
  }
  show() { if (this.root) this.root.style.display = "block"; }
  hide() { if (this.root) this.root.style.display = "none"; }
  _draw({ items }) {
    if (!this.ctx) return; this.show();
    const ctx = this.ctx; ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    const total = items.reduce((s, i) => s + i.dur, 0);
    let x = 10; const h = 60; const y = 40; const scale = Math.max(1, (this.canvas.width - 20) / (total * 1000));
    for (const it of items) {
      const w = Math.max(2, it.dur * 1000 * scale);
      ctx.fillStyle = it.ph === "pau" ? "rgba(200,200,200,0.4)" : "rgba(140,200,255,0.7)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "white"; ctx.font = "12px ui-monospace";
      ctx.fillText(it.ph, x + 2, y + 14);
      x += w + 4;
    }
  }
  _redraw() {} // simple; draw only on new timeline
}