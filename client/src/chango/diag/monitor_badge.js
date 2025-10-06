/* Debug Monitor Status Badge — non-destructive injection. */
function findHost(){
  return document.querySelector("[data-chango-debug]")
      || document.querySelector(".debug-monitor")
      || document.getElementById("debug");
}
function mkRow(){
  const row=document.createElement("div");
  row.className="chango-monitor-badge";
  Object.assign(row.style,{
    display:"flex", alignItems:"center", gap:"10px",
    padding:"6px 8px", margin:"4px 8px 0",
    border:"1px solid rgba(0,255,255,.25)", borderRadius:"6px",
    background:"rgba(0,0,0,.35)", font:"12px ui-monospace,monospace"
  });
  const dot=document.createElement("span");
  Object.assign(dot.style,{ display:"inline-block", width:"10px", height:"10px",
    borderRadius:"50%", background:"#888" });
  const txt=document.createElement("span");
  txt.textContent="STT: —  |  Recoveries: —";
  row.append(dot, txt);
  return {row, dot, txt};
}
function colorByHealth(h){
  if(h>=90) return "#00d18f";   // ok
  if(h>=60) return "#ffcc00";   // warn
  return "#ff4d4d";             // danger
}
async function pullHUD(){
  try{
    const r=await fetch("/hud/status.json",{cache:"no-store"});
    if(!r.ok) return null;
    return r.json();
  }catch{ return null; }
}
function start(){
  const host=findHost(); if(!host) return;
  // Avoid duplicates
  if(host.querySelector(".chango-monitor-badge")) return;
  const {row,dot,txt}=mkRow(); host.insertBefore(row, host.firstChild);
  const tick=async ()=>{
    const data=await pullHUD(); if(!data) return;
    const h=Number(data?.metrics?.stt_health ?? 0);
    const rec=Number(data?.metrics?.stt_recoveries ?? 0);
    dot.style.background=colorByHealth(h);
    txt.textContent=`STT: ${h}%  |  Recoveries: ${rec}`;
  };
  tick(); setInterval(tick, 10000);
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start); else start();