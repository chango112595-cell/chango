import { bus } from "../core/eventBus.js";
import { flag } from "../core/once.js";
if(flag("monitor_tab_selftest")){
  function findHost(){ return document.querySelector("[data-chango-debug]")||document.querySelector(".debug-monitor")||document.getElementById("debug"); }
  function mkBtn(){ const b=document.createElement("button"); b.textContent="SelfTest"; Object.assign(b.style,{all:"unset",cursor:"pointer",padding:"6px 10px",border:"1px solid rgba(0,255,255,.35)",borderRadius:"6px",fontFamily:"ui-monospace"}); return b; }
  function mkBar(){ const d=document.createElement("div"); d.className="chango-tabs-inject"; Object.assign(d.style,{display:"flex",gap:"8px",padding:"6px 8px"}); return d; }
  function mkPanel(){ const pre=document.createElement("pre"); pre.className="chango-selftest-panel"; Object.assign(pre.style,{margin:"8px",padding:"8px",height:"180px",overflow:"auto",background:"rgba(0,0,0,.35)",border:"1px solid rgba(0,255,255,.25)",borderRadius:"6px",font:"12px/1.4 ui-monospace"}); pre.textContent="SelfTest idle."; return pre; }
  function init(){ const host=findHost(); if(!host) return; let bar=host.querySelector(".chango-tabs-inject"); if(!bar){ bar=mkBar(); host.appendChild(bar); }
    const btn=mkBtn(); const runBtn=mkBtn(); runBtn.textContent="▶ Run"; const panel=mkPanel(); panel.style.display="none"; host.appendChild(panel);
    btn.addEventListener("click",()=>{ panel.style.display=panel.style.display==="none"?"block":"none"; }); runBtn.addEventListener("click",()=>{ window.Chango?.selftest && window.Chango.selftest(); });
    bar.appendChild(btn); bar.appendChild(runBtn);
    bus.on("selftest:log",({line})=>{ panel.textContent+=`\n${line}`; panel.scrollTop=panel.scrollHeight; });
    bus.on("selftest:result",(sum)=>{ panel.textContent+=`\n\nResult: ${sum.ok?"PASS ✅":"FAIL ❌"} (${sum.took_ms}ms)`; panel.scrollTop=panel.scrollHeight; }); }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
}