// Headless adapter: binds to existing DOM via data-chango-* without altering layout
import { bus } from "../core/eventBus.js";

export class UIAdapter {
  constructor() {
    this.el = {
      enable: q('[data-chango-enable]'),
      speak:  q('[data-chango-speak]'),
      stop:   q('[data-chango-stop]'),
      text:   q('[data-chango-text]'),
      status: q('[data-chango-status]')
    };
  }
  mount({ speakFn, stopFn, unlockFn }) {
    this.el.enable && this.el.enable.addEventListener("click", unlockFn);
    this.el.speak  && this.el.speak.addEventListener("click", () => speakFn(this.text()));
    this.el.stop   && this.el.stop.addEventListener("click", stopFn);
    bus.on("status", s => this.status(s));
    bus.on("vad:start", () => this.status("listening…"));
    bus.on("vad:stop", () => this.status("idle"));
    bus.emit("status", "idle");
  }
  text(){ return this.el.text ? (this.el.text.value || this.el.text.textContent || "") : ""; }
  status(s){ if (!this.el.status) return; this.el.status.textContent = s; }
}
function q(sel){ return document.querySelector(sel); }