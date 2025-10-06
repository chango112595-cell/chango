/* Network Scanner — run: ChangoNet.scan()
   - Detect duplicate <script type="module"> URLs.
   - HEAD request each; fallback GET; flag non-2xx/3xx.
   - Download net-scan.json and log summary.
*/
function abs(url){
  try{ return new URL(url, location.href).href; }catch{ return url; }
}
async function headOrGet(url){
  try{
    const r=await fetch(url,{ method:"HEAD", cache:"no-store" });
    if(r.ok || (r.status>=300 && r.status<400)) return { ok:true, status:r.status };
    // Some hosts disallow HEAD; try GET
    const g=await fetch(url,{ method:"GET", cache:"no-store" });
    return { ok:g.ok || (g.status>=300 && g.status<400), status:g.status };
  }catch(e){ return { ok:false, status:0, err:String(e) }; }
}
function dlJSON(filename, data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
}
async function scan(){
  const nodes=[...document.querySelectorAll('script[type="module"][src]')];
  const list=nodes.map(n=>abs(n.getAttribute("src")));
  const counts=list.reduce((m,u)=>(m[u]=(m[u]||0)+1,m),{});
  const duplicates=Object.entries(counts).filter(([,c])=>c>1).map(([u,c])=>({ url:u, count:c }));
  const results=[];
  for(const url of [...new Set(list)]){
    const res=await headOrGet(url);
    results.push({ url, ok:res.ok, status:res.status, err:res.err||null });
  }
  const failing=results.filter(r=>!r.ok);
  const report={ ts:new Date().toISOString(), total:list.length, unique:results.length, duplicates, failing, results };
  // console summary
  console.groupCollapsed("[ChangoNet] scan");
  console.log("Total scripts:", report.total, "Unique:", report.unique);
  if(duplicates.length){ console.warn("Duplicates:", duplicates); } else { console.log("No duplicates ✅"); }
  if(failing.length){ console.error("Failures:", failing); } else { console.log("No 404s/failed fetch ✅"); }
  console.groupEnd();
  // download
  dlJSON("net-scan.json", report);
  return report;
}
if(!window.ChangoNet) window.ChangoNet={};
window.ChangoNet.scan = scan;
export { scan };