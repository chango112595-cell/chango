/* Inject a "SelfTest" tab into the existing Debug Monitor — non-destructive. */
import { bus } from "../core/eventBus.js";

function findMonitor(){
  return document.querySelector("[data-chango-debug]") ||
         document.querySelector(".debug-monitor") ||
         document.getElementById("debug") ||
         null;
}
function ensureTabsBar(root){
  let bar = root.querySelector(".chango-tabs-inject");
  if (!bar){
    bar = document.createElement("div");
    bar.className = "chango-tabs-inject";
    bar.style.display = "flex";
    bar.style.gap = "8px";
    bar.style.padding = "6px 8px";
    root.appendChild(bar);
  }
  return bar;
}
function mkBtn(label){
  const b=document.createElement("button");
  b.textContent=label;
  b.style.all="unset";
  b.style.cursor="pointer";
  b.style.padding="6px 10px";
  b.style.border="1px solid rgba(0,255,255,.35)";
  b.style.borderRadius="6px";
  b.style.fontFamily="ui-monospace, monospace";
  return b;
}
function mkPanel(){
  const pre=document.createElement("pre");
  pre.className="chango-selftest-panel";
  pre.style.margin="8px";
  pre.style.padding="8px";
  pre.style.height="180px";
  pre.style.overflow="auto";
  pre.style.background="rgba(0,0,0,.35)";
  pre.style.border="1px solid rgba(0,255,255,.25)";
  pre.style.borderRadius="6px";
  pre.style.font="12px/1.4 ui-monospace, monospace";
  pre.textContent="SelfTest idle. Run Chango.selftest() in console.";
  return pre;
}

function init(){
  const host = findMonitor();
  if (!host) return; // silently skip if monitor not present
  const bar = ensureTabsBar(host);
  const btn = mkBtn("SelfTest");
  const panel = mkPanel();
  panel.style.display="none";
  host.appendChild(panel);
  btn.addEventListener("click", ()=>{
    panel.style.display = panel.style.display==="none" ? "block" : "none";
  });
  bar.appendChild(btn);

  // Stream logs/results
  bus.on("selftest:log", ({line})=>{
    panel.textContent += `\n${line}`;
    panel.scrollTop = panel.scrollHeight;
  });
  bus.on("selftest:result", (sum)=>{
    panel.textContent += `\n\nResult: ${sum.ok?"PASS ✅":"FAIL ❌"} in ${sum.took_ms}ms`;
    if (!sum.ok){
      for (const r of sum.results.filter(r=>!r.ok)){
        panel.textContent += `\n - ${r.step}: ${r.err||"failed"}`;
      }
    }
    panel.scrollTop = panel.scrollHeight;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}