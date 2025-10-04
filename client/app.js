let route='client', voices=[], state={voiceURI:null,rate:1,pitch:1,volume:1};
let lastUtteranceRaw='', lastUtteranceSaid='';
const el=id=>document.getElementById(id); const status=msg=>el('status').textContent='status: '+msg;
const setBadge=()=>document.getElementById('routeBadge').textContent='Route: '+route[0].toUpperCase()+route.slice(1);

document.getElementById('themeBtn').onclick=()=>{
  const r=document.documentElement;
  if(r.classList.contains('theme-classic')){ r.classList.remove('theme-classic'); r.classList.add('theme-hud'); localStorage.setItem('chango_theme','hud');}
  else { r.classList.remove('theme-hud'); r.classList.add('theme-classic'); localStorage.setItem('chango_theme','classic');}
  status('theme changed');
};

function loadVoices(){ voices=speechSynthesis.getVoices(); const sel=document.getElementById('selVoice'); if(!sel) return;
  sel.innerHTML=''; voices.forEach(v=>{ const o=document.createElement('option'); o.value=v.voiceURI; o.text=`${v.name} (${v.lang})${v.default?' • default':''}`;; sel.appendChild(o);
  if(v.default && !state.voiceURI) state.voiceURI=v.voiceURI;}); if(state.voiceURI) sel.value=state.voiceURI;}
if('speechSynthesis' in window){ speechSynthesis.onvoiceschanged=loadVoices; setTimeout(loadVoices,200); } else { status('Web Speech API not available'); }

document.addEventListener('click',e=>{ if(e.target.matches('[data-route]')){ route=e.target.getAttribute('data-route'); setBadge(); }});
if(el('btnEnable')) el('btnEnable').onclick=()=>{ const u=new SpeechSynthesisUtterance(''); speechSynthesis.speak(u); status('voice ready'); };
['rate','pitch','volume'].forEach(k=>{ const n=el(k); if(n) n.oninput=e=>state[k]=parseFloat(e.target.value); });

const RNG=()=>Math.random(); const chance=p=>RNG()<p; const jitter=(v,a)=>Math.max(0, v + (RNG()*2-1)*a);
function injectPauses(t,i){ return t.replace(/,\s*/g,()=> (chance(0.6)?", ":",  ")).replace(/\.\s*/g,()=> (chance(0.5)?". ":" .  ")); }
const ACCENTS={ neutral:{name:"Neutral",rules:(t,i)=>injectPauses(t,i),rateJ:.03,pitchJ:.02,volJ:0},
  brit_rp:{name:"British RP",rules:(t,i)=>{let x=t; if(i>0) x=x.replace(/([aeiouAEIOU])r\b/g,(m,v)=> v + (chance(i*.8)?"":"r")); if(i>.5) x=x.replace(/\bbath\b/gi,"bahth"); return injectPauses(x,i);},rateJ:.02,pitchJ:.03,volJ:0},
  southern_us:{name:"Southern US",rules:(t,i)=>{let x=t; if(i>.4){x=x.replace(/\byou all\b/gi,"y'all"); x=x.replace(/\bgoing to\b/gi,"gonna"); } return injectPauses(x,i);},rateJ:.06,pitchJ:.015,volJ:0},
  spanish_en:{name:"Spanish-influenced English",rules:(t,i)=>{let x=t; if(i>.3) x=x.replace(/\bvery\b/gi,"bery"); if(i>.5) x=x.replace(/th/gi,(m)=> chance(.6*i)?(m===m.toUpperCase()?"D":"d"):(m===m.toUpperCase()?"T":"t")); return injectPauses(x,i);},rateJ:.03,pitchJ:.03,volJ:0},
  caribbean:{name:"Caribbean",rules:(t,i)=>{let x=t; if(i>.3) x=x.replace(/th/gi,(m)=> chance(.6*i)?(m===m.toUpperCase()?"D":"d"):(m===m.toUpperCase()?"T":"t")); return injectPauses(x,i);},rateJ:.05,pitchJ:.02,volJ:0}};
function applyAccent(text){ const profile=(document.getElementById('accentProfile')||{}).value||"neutral";
  const intensity=parseFloat((document.getElementById('accentIntensity')||{value:'0.5'}).value||'0.5');
  const a=ACCENTS[profile]||ACCENTS.neutral; let t=a.rules(text,intensity);
  return { text:t, rate:jitter(1,a.rateJ), pitch:jitter(1,a.pitchJ), volume:jitter(1,a.volJ), profile, intensity }; }

function pickVoice(){ const sel=document.getElementById('selVoice'); if(sel && sel.value){ return speechSynthesis.getVoices().find(v=>v.voiceURI===sel.value) || speechSynthesis.getVoices()[0]; }
  return speechSynthesis.getVoices().find(v=>v.default) || speechSynthesis.getVoices()[0]; }

function speakClient(text,over={}){ const u=new SpeechSynthesisUtterance(text); const v=pickVoice(); if(v) u.voice=v;
  u.rate=over.rate??1; u.pitch=over.pitch??1; u.volume=over.volume??1;
  u.onstart=()=>status('speaking…'); u.onend=()=>status('idle'); u.onerror=e=>status('error: '+e.error); speechSynthesis.speak(u); }

async function speak(text){ lastUtteranceRaw=text; const styled=applyAccent(text); lastUtteranceSaid=styled.text;
  return speakClient(styled.text,styled); // server routes reserved; client is default & instant
}

if(el('btnTest')) el('btnTest').onclick=()=>speak("Hello, I'm Chango. How can I help you today?");
if(el('btnSpeak')) el('btnSpeak').onclick=()=>{ const t=(document.getElementById('sayText')||{}).value?.trim(); if(t) speak(t); };
if(el('btnStop')) el('btnStop').onclick=()=>speechSynthesis.cancel();
if(el('btnRepeatWithAccent')) el('btnRepeatWithAccent').onclick=()=>{ if(lastUtteranceRaw) speak(lastUtteranceRaw); };

// Mic → Profile
let mediaRecorder=null, chunks=[], recording=false;
async function initMic(){ const stream=await navigator.mediaDevices.getUserMedia({ audio:true });
  mediaRecorder=new MediaRecorder(stream,{mimeType:'audio/webm'});
  mediaRecorder.ondataavailable=e=>{ if(e.data.size>0) chunks.push(e.data); };
  mediaRecorder.onstop=async()=>{ try{ const blob=new Blob(chunks,{type:'audio/webm'}); chunks=[];
      const fd=new FormData(); fd.append('audio',blob,'sample.webm'); const name=(document.getElementById('profileName')?.value||'').trim(); if(name) fd.append('name',name);
      const res=await fetch('/voice_profile/learn',{ method:'POST', body:fd }); const js=await res.json();
      if(!res.ok||!js.ok){ document.getElementById('scanStatus').textContent='analyze error'; return; }
      document.getElementById('scanStatus').textContent=`profile saved: ${js.profile?.id||'(unnamed)'}`; await refreshProfiles();
  }catch(e){ document.getElementById('scanStatus').textContent='upload error'; }};}
if(el('btnRec')){ el('btnRec').onmousedown=async()=>{ try{ if(!mediaRecorder) await initMic(); if(recording) return; chunks=[]; mediaRecorder.start(); recording=true; document.getElementById('scanStatus').textContent='voice scan: recording... (release to stop)';
} catch(e){ document.getElementById('scanStatus').textContent='mic error'; }};
  el('btnRec').onmouseup=()=>{ if(mediaRecorder&&recording){ mediaRecorder.stop(); recording=false; document.getElementById('scanStatus').textContent='voice scan: processing...'; }}}
if(el('btnAnalyze')) el('btnAnalyze').onclick=()=>{ document.getElementById('scanStatus').textContent='analysis requires a fresh recording (hold Record)'; };
async function refreshProfiles(){ try{ const r=await fetch('/voice_profile/list'); const js=await r.json(); const sel=document.getElementById('selProfiles'); if(!sel) return; sel.innerHTML='';
    (js.profiles||[]).forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.textContent=`${p.id} — ${p.summary}`; sel.appendChild(o); });
    document.getElementById('scanStatus').textContent=`profiles: ${js.profiles?.length||0} found`;
  }catch{ document.getElementById('scanStatus').textContent='failed to list profiles'; } }
if(el('btnRefreshProfiles')) el('btnRefreshProfiles').onclick=refreshProfiles;
if(el('btnUseProfile')) el('btnUseProfile').onclick=async()=>{ const id=(document.getElementById('selProfiles')||{}).value; if(!id){ document.getElementById('scanStatus').textContent='pick a profile'; return; }
  try{ const r=await fetch('/voice_profile/get/'+encodeURIComponent(id)); const js=await r.json(); if(!r.ok||!js.ok){ document.getElementById('scanStatus').textContent='failed to fetch profile'; return; }
    const p=js.profile||{}; if(p.mapped){ const ap=document.getElementById('accentProfile'), ai=document.getElementById('accentIntensity');
      if(ap && p.mapped.profile) ap.value=p.mapped.profile; if(ai && typeof p.mapped.intensity==='number') ai.value=p.mapped.intensity;
      document.getElementById('scanStatus').textContent=`using profile: ${p.id}`; } else { document.getElementById('scanStatus').textContent='profile has no mapping'; }
  }catch{ document.getElementById('scanStatus').textContent='error applying profile'; }};
refreshProfiles();

// Hologram + curiosity
document.getElementById('themeBtn').click = document.getElementById('themeBtn').click;
(function(){ const toggleBtn=el('holoToggle'), sizeCtl=el('holoSize'), speedCtl=el('holoSpeed'), modeSel=el('holoMode'), wanderCtl=el('holoWander');
  if(!toggleBtn || !window.ChangoHolo) return; let on=false;
  toggleBtn.onclick=()=>{ on=!on; if(on){ ChangoHolo.show(); toggleBtn.textContent='Hide'; } else { ChangoHolo.hide(); toggleBtn.textContent='Toggle'; } };
  sizeCtl?.addEventListener('input', e=> ChangoHolo.setSize(e.target.value));
  speedCtl?.addEventListener('input', e=> ChangoHolo.setSpeed(e.target.value));
  modeSel?.addEventListener('change', e=> ChangoHolo.setMode(e.target.value));
  wanderCtl?.addEventListener('change', e=> (ChangoHolo.state.wander=!!e.target.checked));
})();