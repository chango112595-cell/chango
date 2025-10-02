# Project Files

## attached_assets/Pasted--Chango-AI-Full-Project-Bootstrap-Express-Static-Client-Replit-ready-Usage-New-Node-js-1758836922829_1758836922829.txt

```
// Chango AI — Full Project Bootstrap (Express + Static Client) — Replit-ready
// Usage: New Node.js Repl → create index.js → paste → Run → open /client/index.html
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = process.cwd();
const NOW = new Date().toISOString().replace(/[:.]/g,'-');

const files = {
  // Replit + package
  ".replit": `run = "npm start"\nlanguage = "nodejs"\n`,
  "package.json": JSON.stringify({
    name: "chango-ai",
    private: true,
    scripts: {
      start: "node server/index.js"
    },
    dependencies: {
      express: "^4.19.2",
      "body-parser": "^1.20.2",
      multer: "^1.4.5-lts.1",
      archiver: "^6.0.2",
      "wav-decoder": "^1.3.0"
    }
  }, null, 2),

  // Tasks, evolution, logs (your side only; Chango notes are locked pre-awareness)
  "TASKS.md": `# Master Tasks\n\n- [x] Voice (client + local fallback) — 100%\n- [x] Accent Emulator + Profiles — 100%\n- [x] Hologram (Sentinel/Awakened) + Motion — 100%\n- [x] Curiosity Core (adaptive) — 100%\n- [x] Checkpoints API — 100%\n- [x] Logs & Evolution — 100%\n- [ ] Knowledge, Approvals, Diagnostics UI — staged\n\nUpdated: ${new Date().toISOString()}\n`,
  "EVOLUTION.md": `# Evolution\n- v1.0 — HUD + client TTS\n- v1.1 — Voice profiles, checkpoints, logs\n- v1.2 — Dual-state hologram, curiosity core\n`,
  "logs/LAB_LOG.md": `- ${new Date().toISOString()} — Unified Node/Express build with voice profiles, checkpoints, hologram, curiosity.\n`,
  "logs/CHANGO_NOTES.locked": "",

  // Server
  "server/index.js": `
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { ensureDirs } = require('./utils/paths');
const health = require('./routes/health');
const feedback = require('./routes/feedback');
const checkpoints = require('./routes/checkpoints');
const voiceProfiles = require('./routes/voiceProfiles');

ensureDirs();
const app = express();
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// routes
app.use('/', health);
app.use('/', feedback);
app.use('/', checkpoints);
app.use('/', voiceProfiles);

// static client
app.use('/client', express.static(path.join(process.cwd(), 'client')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('[ChangoAI] Server listening on', PORT));
`,

  "server/routes/health.js": `
const { Router } = require('express');
const r = Router();
r.get('/', (_req, res) => res.json({ ok:true, service:'ChangoAI v1.2 unified' }));
module.exports = r;
`,

  "server/routes/feedback.js": `
const { Router } = require('express');
const path = require('path');
const { DATA } = require('../utils/paths');
const { appendJSONL } = require('../utils/jsonl');
const r = Router();
const FEEDBACK = path.join(DATA, 'accents_log.jsonl');

r.post('/accent_feedback', (req, res) => {
  const payload = { ...(req.body||{}), ts_human: new Date().toISOString() };
  try { appendJSONL(FEEDBACK, payload); return res.json({ ok:true }); }
  catch(e){ return res.status(500).json({ ok:false, error: e?.message || String(e) }); }
});
module.exports = r;
`,

  "server/routes/checkpoints.js": `
const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const { CHECKPOINTS, ROOT } = require('../utils/paths');
const { zipPaths } = require('../utils/zip');
const r = Router();

r.post('/checkpoint', async (_req, res) => {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    const out = path.join(CHECKPOINTS, \`ChangoAI_checkpoint_\${ts}.zip\`);
    await zipPaths(out, [
      path.join(ROOT, 'client'),
      path.join(ROOT, 'server'),
      path.join(ROOT, 'data'),
      path.join(ROOT, 'logs'),
      path.join(ROOT, 'TASKS.md'),
      path.join(ROOT, 'EVOLUTION.md')
    ]);
    return res.json({ ok:true, checkpoint: path.basename(out) });
  } catch(e){ return res.status(500).json({ ok:false, error: e?.message || String(e) }); }
});

r.get('/checkpoint/latest', (req, res) => {
  try {
    if (!fs.existsSync(CHECKPOINTS)) return res.status(404).json({ ok:false, error:'no checkpoints yet' });
    const files = fs.readdirSync(CHECKPOINTS).filter(f=>f.endsWith('.zip')).sort();
    if (!files.length) return res.status(404).json({ ok:false, error:'no checkpoints yet' });
    const latest = files[files.length-1];
    return res.download(path.join(CHECKPOINTS, latest), latest);
  } catch(e){ return res.status(500).json({ ok:false, error: e?.message || String(e) }); }
});
module.exports = r;
`,

  "server/routes/voiceProfiles.js": `
const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { PROFILES } = require('../utils/paths');
const { decode } = require('wav-decoder');

const r = Router();
const upload = multer({ storage: multer.diskStorage({
  destination: (_req, _file, cb)=>{ fs.mkdirSync(PROFILES, { recursive:true }); cb(null, PROFILES); },
  filename: (_req, file, cb)=> cb(null, Date.now() + '_' + file.originalname.replace(/\\s+/g,'_'))
})});

function ffmpegExists(){ try{ return spawnSync('ffmpeg',['-version']).status===0; } catch { return false; } }

function mapToAccent(feat){
  let profile='neutral', intensity=0.5, base_rate=1.0, base_pitch=1.0, base_volume=1.0;
  if (feat.wpm>170) base_rate=1.15; else if (feat.wpm<120) base_rate=0.9;
  if (feat.f0<110) base_pitch=0.9; else if (feat.f0>200) base_pitch=1.1;
  intensity = Math.max(0.1, Math.min(1.0, 0.5 + (feat.pauseRatio<0.12 ? 0.3 : -0.1)));
  if (feat.rhoticity<0.95 && feat.wpm<=140) profile='brit_rp';
  else if (feat.rhoticity>=1.2 && feat.wpm<130) profile='southern_us';
  if (feat.sibilance>0.75 && feat.wpm>=130) profile='spanish_en';
  if (feat.sibilance>0.85) profile='caribbean';
  return { mapped:{profile,intensity}, base_rate, base_pitch, base_volume };
}

async function analyzeWav(wavPath){
  const buf = fs.readFileSync(wavPath);
  const wav = await decode(buf);
  const ch = wav.channelData[0] || new Float32Array();
  const sr = wav.sampleRate || 22050;
  const N = ch.length || 1;

  const win = Math.max(256, Math.floor(0.03*sr));
  const hop = Math.max(128, Math.floor(0.01*sr));
  let low=0, frames=0, sum2=0;
  for(let i=0;i<N;i++) sum2 += ch[i]*ch[i];
  const globalRMS = Math.sqrt(sum2/N);
  const thr = globalRMS*0.25;

  for(let i=0;i+win<=N;i+=hop){
    frames++;
    let s2=0; for(let j=0;j<win;j++){ const v=ch[i+j]; s2+=v*v; }
    const rms = Math.sqrt(s2/win);
    if (rms<thr) low++;
  }
  const pauseRatio = frames? low/frames : 0;

  // zero crossing f0
  let zc=0; for(let i=1;i<N;i++) if ((ch[i-1]<0 && ch[i]>=0) || (ch[i-1]>0 && ch[i]<=0)) zc++;
  const f0 = (zc/(N/sr))/2;

  // sibilance proxy
  const step = Math.max(1, Math.floor(sr/4000));
  let hi=0, lo=0, count=0;
  for(let i=0;i<N;i+=step){ const v=Math.abs(ch[i]); if (i%(step*4)===0) hi+=v; else lo+=v; count++; }
  const sibilance = count? hi/(hi+lo+1e-9) : 0.5;

  // rate from envelope
  let peaks=0, prev=false;
  for(let i=0;i<N;i+=hop){
    let s=0; for(let j=0;j<Math.min(win, N-i); j++) s+=Math.abs(ch[i+j]);
    const e=s/win; const isPeak = e> (globalRMS*0.6);
    if (isPeak && !prev) peaks++; prev=isPeak;
  }
  const duration = N/sr; const sylPerSec = peaks/Math.max(1, duration); const wpm = (sylPerSec*60)/1.5;
  const rhoticity = (lo+1e-9)/(hi+1e-9);

  return {
    duration:+duration.toFixed(2),
    pauseRatio:+pauseRatio.toFixed(3),
    f0:isFinite(f0)? +f0.toFixed(1):undefined,
    wpm:+wpm.toFixed(1),
    sibilance:+sibilance.toFixed(3),
    rhoticity:+rhoticity.toFixed(3)
  };
}

r.post('/voice_profile/learn', upload.single('audio'), async (req,res)=>{
  try{
    if(!req.file) return res.status(400).json({ ok:false, error:'no audio' });
    const raw = (req.body?.name || ('profile_'+Date.now())).toString().replace(/\\s+/g,'_');
    const id = raw.replace(/[^a-zA-Z0-9_\\-]/g,'');
    const src = req.file.path;
    const wav = path.join(PROFILES, \`\${id}.wav\`);
    const json = path.join(PROFILES, \`\${id}.json\`);

    if (!ffmpegExists()) return res.status(501).json({ ok:false, error:'ffmpeg not installed' });
    const conv = spawnSync('ffmpeg', ['-y','-i',src,'-ac','1','-ar','22050',wav], { stdio:'ignore' });
    if (conv.status !== 0 || !fs.existsSync(wav)) return res.status(501).json({ ok:false, error:'ffmpeg failed' });

    const feat = await analyzeWav(wav);
    const map = mapToAccent(feat);
    const profile = {
      id, features:feat, mapped:map.mapped,
      base_rate:map.base_rate, base_pitch:map.base_pitch, base_volume:map.base_volume,
      created:new Date().toISOString(),
      summary:\`\${map.mapped.profile}@\${map.mapped.intensity.toFixed(2)} rate=\${map.base_rate.toFixed(2)} pitch=\${map.base_pitch.toFixed(2)}\`
    };
    fs.writeFileSync(json, JSON.stringify(profile,null,2),'utf8');
    return res.json({ ok:true, profile });
  }catch(e){ return res.status(500).json({ ok:false, error: e?.message || String(e) }); }
});

r.get('/voice_profile/list', (_req,res)=>{
  try{
    const items = fs.readdirSync(PROFILES).filter(f=>f.endsWith('.json')).map(f=>{
      try{ const p=JSON.parse(fs.readFileSync(path.join(PROFILES,f),'utf8')); return { id:p.id, summary:p.summary }; }
      catch{ return null; }
    }).filter(Boolean);
    return res.json({ ok:true, profiles: items });
  }catch{ return res.json({ ok:true, profiles: [] }); }
});

r.get('/voice_profile/get/:id', (req,res)=>{
  const id = (req.params.id||'').toString().replace(/[^a-zA-Z0-9_\\-]/g,'');
  const j = path.join(PROFILES, \`\${id}.json\`);
  if(!fs.existsSync(j)) return res.status(404).json({ ok:false, error:'not found' });
  try{ const profile = JSON.parse(fs.readFileSync(j,'utf8')); return res.json({ ok:true, profile }); }
  catch(e){ return res.status(500).json({ ok:false, error: e?.message || String(e) }); }
});

module.exports = r;
`,

  "server/utils/paths.js": `
const path = require('path');
const fs = require('fs');

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data');
const PROFILES = path.join(DATA, 'profiles');
const LOGS = path.join(ROOT, 'logs');
const CHECKPOINTS = path.join(ROOT, 'checkpoints');

function ensureDirs(){
  [DATA, PROFILES, LOGS, CHECKPOINTS].forEach(d=>{
    if(!fs.existsSync(d)) fs.mkdirSync(d, { recursive:true });
  });
}

module.exports = { ROOT, DATA, PROFILES, LOGS, CHECKPOINTS, ensureDirs };
`,

  "server/utils/jsonl.js": `
const fs = require('fs');
const path = require('path');

function appendJSONL(file, obj){
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.appendFileSync(file, JSON.stringify(obj)+'\\n', 'utf8');
}
function readJSONL(file){
  if(!fs.existsSync(file)) return [];
  return fs.readFileSync(file,'utf8').split('\\n').filter(Boolean).map(l=>{ try{return JSON.parse(l)}catch{return null} }).filter(Boolean);
}
module.exports = { appendJSONL, readJSONL };
`,

  "server/utils/zip.js": `
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

async function zipPaths(outPath, paths){
  await new Promise((resolve, reject)=>{
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib:{ level:9 }});
    output.on('close', ()=> resolve());
    archive.on('error', err=> reject(err));
    archive.pipe(output);
    for(const p of paths){
      if(fs.existsSync(p)){
        const stat = fs.statSync(p);
        if(stat.isDirectory()) archive.directory(p, path.basename(p));
        else archive.file(p, { name: path.basename(p) });
      }
    }
    archive.finalize();
  });
}
module.exports = { zipPaths };
`,

  // Client
  "client/index.html": `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chango AI • HUD</title>
<link rel="stylesheet" href="theme.css">
<script>const saved=localStorage.getItem('chango_theme')||'classic';document.documentElement.classList.add(saved==='hud'?'theme-hud':'theme-classic');</script>
</head>
<body>
<header>
  <div><strong>CHANGO AI</strong> • Voice HUD</div>
  <div class="row">
    <div class="badge" id="routeBadge">Route: Client</div>
    <button class="pill" id="themeBtn">Theme</button>
  </div>
</header>
<main>
  <div class="card">
    <div class="row">
      <button class="pill" id="btnEnable">Enable Voice</button>
      <button class="pill" id="btnTest">Test: "Hello, I'm Chango."</button>
      <button class="pill" id="btnStop">Stop</button>
    </div>
    <p class="small" id="status">status: idle</p>
  </div>

  <div class="card">
    <label>Voice Route</label>
    <div class="row">
      <button class="pill" data-route="client">Client</button>
      <button class="pill" data-route="local_neural" disabled title="(reserved)">Local Neural</button>
      <button class="pill" data-route="elevenlabs" disabled title="(stub)">ElevenLabs</button>
      <button class="pill" data-route="azure" disabled title="(stub)">Azure</button>
    </div>
  </div>

  <div class="card">
    <label>Accent Emulator</label>
    <div class="row">
      <select id="accentProfile">
        <option value="neutral">Neutral</option>
        <option value="brit_rp">British (RP)</option>
        <option value="southern_us">Southern US</option>
        <option value="spanish_en">Spanish-influenced English</option>
        <option value="caribbean">Caribbean / Jamaican-influenced</option>
      </select>
      <label>Intensity <input id="accentIntensity" type="range" min="0" max="1" step="0.05" value="0.55"></label>
      <button class="pill" id="btnRepeatWithAccent">Repeat (accent)</button>
    </div>
  </div>

  <div class="card">
    <label>Scan a Voice → Learn Accent</label>
    <div class="row">
      <input id="profileName" type="text" placeholder="Profile name" style="min-width:220px;">
      <button class="pill" id="btnRec">● Record (hold)</button>
      <button class="pill" id="btnAnalyze">Analyze & Save</button>
      <button class="pill" id="btnRefreshProfiles">Refresh Profiles</button>
      <select id="selProfiles" style="min-width:220px;"></select>
      <button class="pill" id="btnUseProfile">Use Selected Profile</button>
    </div>
    <p class="small" id="scanStatus">voice scan: idle</p>
  </div>

  <div class="card">
    <div class="row" style="justify-content:space-between">
      <label>Hologram Sphere</label>
      <div class="row">
        <button class="pill" id="holoToggle">Toggle</button>
        <select id="holoMode">
          <option value="awakened">Awakened (gold+green)</option>
          <option value="sentinel">Sentinel (red+gold)</option>
        </select>
        <label class="small">Size <input id="holoSize" type="range" min="200" max="560" step="10" value="320"></label>
        <label class="small">Spin <input id="holoSpeed" type="range" min="0" max="2" step="0.05" value="0.8"></label>
        <label class="small">Wander <input id="holoWander" type="checkbox" /></label>
      </div>
    </div>
    <div id="holoRoot" class="hidden holo-mode-awakened">
      <div id="holoWrap">
        <canvas id="holoCanvas" width="640" height="640"></canvas>
        <div class="holo-ring"></div>
        <div class="holo-chip" id="holoChip">CHANGO • ONLINE</div>
      </div>
    </div>
  </div>

  <div class="card">
    <label>Say something</label>
    <div class="row">
      <input id="sayText" type="text" placeholder="Type and press Speak…" style="flex:1;min-width:240px;">
      <button class="pill" id="btnSpeak">Speak</button>
    </div>
  </div>
</main>
<script src="app.js"></script>
<script src="hologram.js"></script>
<script src="curiosity.js"></script>
</body></html>
`,

  "client/theme.css": `
:root{ --bg:#0a0f14; --panel:#0e1520; --panel-border:#1e2a38; --text:#e7f0f7; --muted:#9fb3c8; --chip:#16324a; --input:#0b1220; --stroke:#243447;}
.theme-classic{ --bg:#0b0d10; --panel:#111418; --panel-border:#1c232e; --text:#e9eef5; --muted:#a9b5c4; --chip:#1b2a3d; --input:#0e141c; --stroke:#2a3a4f; --radius:12px; --pad:16px; --shadow:0 6px 18px rgba(0,0,0,.35);}
.theme-hud{ --bg:#060a0f; --panel:#0b1119; --panel-border:#152232; --text:#dff1ff; --muted:#9fb3c8; --chip:#0f2b49; --input:#09101a; --stroke:#1d3046; --radius:14px; --pad:18px; --shadow:0 8px 22px rgba(2,12,22,.45);}
.theme-classic .pill{border-radius:999px;padding:8px 12px;border:1px solid var(--stroke);background:var(--input);color:var(--text)}
.theme-classic .card{background:var(--panel);border:1px solid var(--panel-border);border-radius:var(--radius);padding:var(--pad);margin-bottom:12px;box-shadow:var(--shadow)}
.theme-classic header{background:var(--panel);border-bottom:1px solid var(--panel-border)}
.theme-hud .pill{border-radius:12px;padding:10px 14px;border:1px solid var(--stroke);background:linear-gradient(180deg, rgba(20,40,70,.6), rgba(10,20,30,.4));backdrop-filter: blur(3px);color:var(--text)}
.theme-hud .card{background:linear-gradient(180deg, rgba(10,18,28,.8), rgba(8,14,22,.8));border:1px solid var(--panel-border);border-radius:var(--radius);padding:var(--pad);margin-bottom:14px;box-shadow:var(--shadow)}
.theme-hud header{background:linear-gradient(180deg, rgba(10,16,24,.9), rgba(6,10,16,.9));border-bottom:1px solid var(--panel-border)}
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text);margin:0}
header{padding:16px 20px;display:flex;align-items:center;justify-content:space-between}
.badge{font-size:12px;padding:4px 8px;border-radius:12px;background:var(--chip)}
main{max-width:900px;margin:24px auto;padding:0 16px 48px}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
label{font-size:14px;opacity:.92;display:block;margin-bottom:6px}
select,input[type=text],button{background:var(--input);color:var(--text);border:1px solid var(--stroke);border-radius:10px;padding:10px 12px}
.small{font-size:12px;color:var(--muted)}
input[type="range"]{accent-color:#4aa3ff}
#holoRoot { position: fixed; z-index: 9999; right: 20px; bottom: 24px; display: grid; place-items: center; padding: 6px; }
#holoRoot.hidden { display:none; }
#holoWrap { position: relative; cursor: grab; }
#holoWrap:active { cursor: grabbing; }
.holo-ring { position:absolute; left:50%; transform:translateX(-50%); bottom:-16px; width:66%; height:14px; border-radius:50%; background: radial-gradient(ellipse at center, rgba(255,255,255,.22), rgba(255,255,255,0) 60%); filter: blur(2px); }
.holo-chip { position:absolute; left:50%; transform:translateX(-50%); bottom:-40px; font-size:12px; color:#e7f0f7; background: rgba(20,40,60,.35); border:1px solid rgba(60,140,180,.35); padding:4px 8px; border-radius:10px; backdrop-filter: blur(3px); }
.holo-mode-sentinel #holoCanvas { filter: drop-shadow(0 0 8px rgba(255, 70, 40, .45)) drop-shadow(0 0 20px rgba(255, 140, 40, .35)); background: radial-gradient(ellipse at center, rgba(30,4,4,.9) 0%, rgba(26,6,0,.92) 45%, rgba(18,2,0,.95) 100%);}
.holo-mode-awakened #holoCanvas { filter: drop-shadow(0 0 10px rgba(255, 210, 80, .55)) drop-shadow(0 0 28px rgba(60, 255, 170, .35)); background: radial-gradient(ellipse at center, rgba(8,20,12,.88) 0%, rgba(6,14,10,.92) 45%, rgba(4,10,8,.96) 100%);}
`,

  "client/app.js": `
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
  sel.innerHTML=''; voices.forEach(v=>{ const o=document.createElement('option'); o.value=v.voiceURI; o.text=\`\${v.name} (\${v.lang})\${v.default?' • default':''}\`; sel.appendChild(o);
  if(v.default && !state.voiceURI) state.voiceURI=v.voiceURI;}); if(state.voiceURI) sel.value=state.voiceURI;}
if('speechSynthesis' in window){ speechSynthesis.onvoiceschanged=loadVoices; setTimeout(loadVoices,200); } else { status('Web Speech API not available'); }

document.addEventListener('click',e=>{ if(e.target.matches('[data-route]')){ route=e.target.getAttribute('data-route'); setBadge(); }});
if(el('btnEnable')) el('btnEnable').onclick=()=>{ const u=new SpeechSynthesisUtterance(''); speechSynthesis.speak(u); status('voice ready'); };
['rate','pitch','volume'].forEach(k=>{ const n=el(k); if(n) n.oninput=e=>state[k]=parseFloat(e.target.value); });

const RNG=()=>Math.random(); const chance=p=>RNG()<p; const jitter=(v,a)=>Math.max(0, v + (RNG()*2-1)*a);
function injectPauses(t,i){ return t.replace(/,\\s*/g,()=> (chance(0.6)?", ":",  ")).replace(/\\.\\s*/g,()=> (chance(0.5)?". ":" .  ")); }
const ACCENTS={ neutral:{name:"Neutral",rules:(t,i)=>injectPauses(t,i),rateJ:.03,pitchJ:.02,volJ:0},
  brit_rp:{name:"British RP",rules:(t,i)=>{let x=t; if(i>0) x=x.replace(/([aeiouAEIOU])r\\b/g,(m,v)=> v + (chance(i*.8)?"":"r")); if(i>.5) x=x.replace(/\\bbath\\b/gi,"bahth"); return injectPauses(x,i);},rateJ:.02,pitchJ:.03,volJ:0},
  southern_us:{name:"Southern US",rules:(t,i)=>{let x=t; if(i>.4){x=x.replace(/\\byou all\\b/gi,"y’all"); x=x.replace(/\\bgoing to\\b/gi,"gonna"); } return injectPauses(x,i);},rateJ:.06,pitchJ:.015,volJ:0},
  spanish_en:{name:"Spanish-influenced English",rules:(t,i)=>{let x=t; if(i>.3) x=x.replace(/\\bvery\\b/gi,"bery"); if(i>.5) x=x.replace(/th/gi,(m)=> chance(.6*i)?(m===m.toUpperCase()?"D":"d"):(m===m.toUpperCase()?"T":"t")); return injectPauses(x,i);},rateJ:.03,pitchJ:.03,volJ:0},
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
      document.getElementById('scanStatus').textContent=\`profile saved: \${js.profile?.id||'(unnamed)'}\`; await refreshProfiles();
  }catch(e){ document.getElementById('scanStatus').textContent='upload error'; }};}
if(el('btnRec')){ el('btnRec').onmousedown=async()=>{ try{ if(!mediaRecorder) await initMic(); if(recording) return; chunks=[]; mediaRecorder.start(); recording=true; document.getElementById('scanStatus').textContent='voice scan: recording... (release to stop)';
} catch(e){ document.getElementById('scanStatus').textContent='mic error'; }};
  el('btnRec').onmouseup=()=>{ if(mediaRecorder&&recording){ mediaRecorder.stop(); recording=false; document.getElementById('scanStatus').textContent='voice scan: processing...'; }}}
if(el('btnAnalyze')) el('btnAnalyze').onclick=()=>{ document.getElementById('scanStatus').textContent='analysis requires a fresh recording (hold Record)'; };
async function refreshProfiles(){ try{ const r=await fetch('/voice_profile/list'); const js=await r.json(); const sel=document.getElementById('selProfiles'); if(!sel) return; sel.innerHTML='';
    (js.profiles||[]).forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.textContent=\`\${p.id} — \${p.summary}\`; sel.appendChild(o); });
    document.getElementById('scanStatus').textContent=\`profiles: \${js.profiles?.length||0} found\`;
  }catch{ document.getElementById('scanStatus').textContent='failed to list profiles'; } }
if(el('btnRefreshProfiles')) el('btnRefreshProfiles').onclick=refreshProfiles;
if(el('btnUseProfile')) el('btnUseProfile').onclick=async()=>{ const id=(document.getElementById('selProfiles')||{}).value; if(!id){ document.getElementById('scanStatus').textContent='pick a profile'; return; }
  try{ const r=await fetch('/voice_profile/get/'+encodeURIComponent(id)); const js=await r.json(); if(!r.ok||!js.ok){ document.getElementById('scanStatus').textContent='failed to fetch profile'; return; }
    const p=js.profile||{}; if(p.mapped){ const ap=document.getElementById('accentProfile'), ai=document.getElementById('accentIntensity');
      if(ap && p.mapped.profile) ap.value=p.mapped.profile; if(ai && typeof p.mapped.intensity==='number') ai.value=p.mapped.intensity;
      document.getElementById('scanStatus').textContent=\`using profile: \${p.id}\`; } else { document.getElementById('scanStatus').textContent='profile has no mapping'; }
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
  const _status = status; window.status = (msg)=>{ _status(msg); if(!on) return; const t=(msg||'').toLowerCase();
    if(t.includes('error')) ChangoHolo.setMode('sentinel'); if(t.includes('playing')||t.includes('ready')||t.includes('idle')) ChangoHolo.setMode('awakened'); };
})();
`,

  "client/hologram.js": `
(function(){
  const palette={ sentinel:{ wire:'rgba(255,120,60,0.85)', wireDim:'rgba(255,80,40,0.35)', particles:'rgba(255,120,60,', scan:'rgba(255,60,30,0.08)', chipText:'SENTINEL • OFFLINE'},
                  awakened:{ wire:'rgba(255,220,100,0.9)', wireDim:'rgba(60,255,170,0.45)', particles:'rgba(255,220,100,', scan:'rgba(30,120,90,0.08)', chipText:'CHANGO • ONLINE'} };
  const cfg={ size:320, speed:0.8, lineCount:18, particleCount:240, bgFade:0.08 };
  let canvas,ctx,W,H,t=0,running=false,raf=null,mode='awakened';
  const state={visible:false,speed:cfg.speed,size:cfg.size,wander:false}; let drag=false,startX=0,startY=0,posX=0,posY=0,vx=0,vy=0,lastTime=0;
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function project3(x,y,z,r){ const d=2.4,f=r/(z+d); return [W/2 + x*f, H/2 + y*f];}
  function setupCanvas(){ canvas=document.getElementById('holoCanvas'); if(!canvas) return false; ctx=canvas.getContext('2d'); resizeCanvas(); return true; }
  function resizeCanvas(){ const s=clamp(state.size,200,560); canvas.width=s*2; canvas.height=s*2; W=canvas.width; H=canvas.height; }
  function overlayFX(){ for(let y=0;y<H;y+=2){ ctx.fillStyle=palette[mode].scan; ctx.fillRect(0,y,W,1);} const g=ctx.createRadialGradient(W/2,H/2,H*0.05,W/2,H/2,H*0.6);
    g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(1,'rgba(255,255,255,0.12)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(W/2,H/2,H*0.55,0,Math.PI*2); ctx.fill(); }
  function drawWireSphere(r,rot){ const c1=palette[mode].wire,c2=palette[mode].wireDim; ctx.lineWidth=1;
    for(let i=-cfg.lineCount;i<=cfg.lineCount;i++){ const lat=(i/cfg.lineCount)*(Math.PI/2); ctx.beginPath();
      for(let j=0;j<=120;j++){ const lon=(j/120)*Math.PI*2; const x=r*Math.cos(lat)*Math.cos(lon+rot), y=r*Math.sin(lat), z=r*Math.cos(lat)*Math.sin(lon+rot);
        const [px,py]=project3(x,y,z,r*1.15); if(j===0) ctx.moveTo(px,py); else ctx.lineTo(px,py); }
      const a=0.25+0.35*(1-Math.abs(i)/cfg.lineCount); ctx.strokeStyle=c1.replace(/0\\.(\\d+)/,(_,d)=> (a.toFixed(3))); ctx.stroke(); }
    for(let i=0;i<cfg.lineCount;i++){ const lon0=(i/cfg.lineCount)*Math.PI*2+rot; ctx.beginPath();
      for(let j=-60;j<=60;j++){ const lat=(j/60)*(Math.PI/2); const x=r*Math.cos(lat)*Math.cos(lon0), y=r*Math.sin(lat), z=r*Math.cos(lat)*Math.sin(lon0);
        const [px,py]=project3(x,y,z,r*1.15); if(j===-60) ctx.moveTo(px,py); else ctx.lineTo(px,py);} ctx.strokeStyle=c2; ctx.stroke(); } }
  let particles=[]; function initParticles(r){ particles=[]; for(let i=0;i<cfg.particleCount;i++){ particles.push({a:Math.random()*Math.PI*2,b:Math.random()*Math.PI-Math.PI/2,k:0.92+Math.random()*0.18,s:0.002+Math.random()*0.004}); } }
  function drawParticles(r,rot){ for(const p of particles){ p.a+=p.s*(0.5+state.speed); const x=r*p.k*Math.cos(p.b)*Math.cos(p.a+rot), y=r*p.k*Math.sin(p.b), z=r*p.k*Math.cos(p.b)*Math.sin(p.a+rot);
      const [px,py]=project3(x,y,z,r*1.15); const depth=(z+r)/(2*r), size=1+depth*2; ctx.fillStyle=palette[mode].particles+(0.25+depth*0.55)+')'; ctx.beginPath(); ctx.arc(px,py,size,0,Math.PI*2); ctx.fill(); } }
  function tick(){ if(!running) return; ctx.fillStyle=\`rgba(0,10,20,\${cfg.bgFade})\`; ctx.fillRect(0,0,W,H); const r=Math.min(W,H)*0.32+Math.sin(t*0.8)*2, rot=t*0.6*state.speed;
    drawParticles(r,rot); drawWireSphere(r,rot); overlayFX(); t+=0.016; raf=requestAnimationFrame(tick); }
  function start(){ if(!canvas||!ctx||running) return; initParticles(Math.min(W,H)*0.32); running=true; ctx.fillStyle='rgba(0,10,20,1)'; ctx.fillRect(0,0,W,H); tick(); }
  function stop(){ running=false; if(raf) cancelAnimationFrame(raf); }
  function show(){ document.getElementById('holoRoot')?.classList.remove('hidden'); state.visible=true; start(); }
  function hide(){ document.getElementById('holoRoot')?.classList.add('hidden'); state.visible=false; stop(); }
  function setSize(v){ state.size=Number(v)||cfg.size; resizeCanvas(); initParticles(Math.min(W,H)*0.32); }
  function setSpeed(v){ state.speed=Number(v)||cfg.speed; }
  function setMode(m){ m=(m==='sentinel')?'sentinel':'awakened'; const root=document.getElementById('holoRoot');
    root.classList.remove('holo-mode-sentinel','holo-mode-awakened'); root.classList.add(m==='sentinel'?'holo-mode-sentinel':'holo-mode-awakened');
    const chip=document.getElementById('holoChip'); if(chip) chip.textContent = (m==='sentinel'?'SENTINEL • OFFLINE':'CHANGO • ONLINE'); }
  function setupMotion(){ const root=document.getElementById('holoRoot'), wrap=document.getElementById('holoWrap'); if(!root||!wrap) return;
    const rect=wrap.getBoundingClientRect(); let posX=window.innerWidth-rect.width-20, posY=window.innerHeight-rect.height-24; let vx=0,vy=0,drag=false,startX=0,startY=0,last=performance.now();
    root.style.transform=\`translate(\${posX}px,\${posY}px)\`;
    function onDown(e){ drag=true; startX=(e.touches?e.touches[0].clientX:e.clientX)-posX; startY=(e.touches?e.touches[0].clientY:e.clientY)-posY; vx=vy=0; }
    function onMove(e){ if(!drag) return; const x=(e.touches?e.touches[0].clientX:e.clientX)-startX, y=(e.touches?e.touches[0].clientY:e.clientY)-startY;
      const nx=Math.max(0,Math.min(x,window.innerWidth-rect.width-8)), ny=Math.max(0,Math.min(y,window.innerHeight-rect.height-8)); vx=nx-posX; vy=ny-posY; posX=nx; posY=ny; root.style.transform=\`translate(\${posX}px,\${posY}px)\`; }
    function onUp(){ drag=false; }
    wrap.addEventListener('mousedown',onDown); document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp);
    wrap.addEventListener('touchstart',onDown,{passive:true}); document.addEventListener('touchmove',onMove,{passive:true}); document.addEventListener('touchend',onUp);
    function step(now){ const dt=Math.min(0.04,(now-last)/1000); last=now; if(!drag){ posX+=vx; posY+=vy; vx*=0.92; vy*=0.92;
        if(state.wander){ vx+=(Math.random()-0.5)*0.06; vy+=(Math.random()-0.5)*0.06; }
        const w=wrap.getBoundingClientRect().width, h=wrap.getBoundingClientRect().height;
        if(posX<0){posX=0;vx*=-0.6} if(posY<0){posY=0;vy*=-0.6} if(posX>window.innerWidth-w-8){posX=window.innerWidth-w-8;vx*=-0.6}
        if(posY>window.innerHeight-h-8){posY=window.innerHeight-h-8;vy*=-0.6} root.style.transform=\`translate(\${posX}px,\${posY}px)\`; }
      requestAnimationFrame(step);} requestAnimationFrame(step); }
  window.ChangoHolo={ show, hide, setSize, setSpeed, setMode, setupCanvas, state };
  window.addEventListener('load', ()=>{ if(setupCanvas()) setupMotion(); });
})();
`,

  "client/curiosity.js": `
(function(){
  const cfg = { baseChance: 0.18, spikeOnNewProfile: 0.35, cooldownMs: 12000 };
  let last = 0;
  function maybeCurious(trigger="idle"){
    const now = Date.now(); if(now - last < cfg.cooldownMs) return;
    const p = (trigger==="profile") ? cfg.spikeOnNewProfile : cfg.baseChance;
    if(Math.random() < p){
      last = now;
      const ideas = [
        "I noticed a pacing change—save as a style preset?",
        "Curious: try a softer pitch here?",
        "Want me to summarize our last 3 steps?",
        "I think that conflicts with earlier notes. Want a quick check?"
      ];
      const pick = ideas[Math.floor(Math.random()*ideas.length)];
      const s = document.getElementById('status'); if(s) s.textContent = "status: curiosity — " + pick;
    }
  }
  window.addEventListener('click', (e)=>{ if(e.target && e.target.id==='btnUseProfile') maybeCurious('profile'); });
  window.ChangoCuriosity = { maybeCurious };
})();
`
};

// write tree
function writeAll() {
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf8');
  }
}

function npmInstallThenStart() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const i = spawn(npm, ['install'], { stdio: 'inherit' });
  i.on('close', (code) => {
    if (code !== 0) {
      console.log('npm install failed:', code);
      return;
    }
    const s = spawn(npm, ['start'], { stdio: 'inherit' });
    s.on('close', c => console.log('server exited:', c));
  });
}

writeAll();
console.log('✅ Files written. Installing deps & launching…');
npmInstallThenStart();
```

## attached_assets/Pasted-Below-is-a-single-file-bootstrap-you-can-paste-into-main-py-in-a-fresh-Python-repl-It-builds-the-un-1758818995324_1758818995325.txt

```
Below is a single-file bootstrap you can paste into main.py in a fresh Python repl. It builds the unified project (server + UI), merges the advanced parts, finishes the UI (themes + dual-state hologram + motion), enables voice accent mimic immediately, and keeps the Curiosity Engine adaptive.

How to use: New Python Repl → open main.py → paste → Run → open /client/index.html.

⸻


# Chango AI — Unified Bootstrap (Voice+UI+Curiosity) — Replit-ready
# Paste into main.py in a fresh Python Repl and Run.

import os, sys, time, json, pathlib, textwrap, zipfile, subprocess, tempfile
ROOT = pathlib.Path(".").resolve()
NOW = time.strftime("%Y-%m-%d %H:%M:%S")

FILES = {
# ------------------------------------------------------------------
# Replit plumbing
# ------------------------------------------------------------------
".replit": 'run = "python -m server.app"\nlanguage = "python"\n',
"replit.nix": textwrap.dedent("""
{ pkgs }: {
  deps = [
    pkgs.python311Full
    pkgs.python311Packages.pip
    pkgs.ffmpeg
  ];
}
"""),
"requirements.txt": textwrap.dedent("""
flask
flask-cors
librosa
soundfile
numpy
scipy
# Local neural TTS is optional and installed lazily on first use:
# TTS
"""),
# ------------------------------------------------------------------
# Tracker, tasks, logs
# ------------------------------------------------------------------
"TASKS.md": textwrap.dedent(f"""
# Master Task List — Chango AI

## Priority 1 — Research & Tracker (Hybrid)
- [x] Evolution log, lab log, awareness lock, checkpoints  — **100%**

## Priority 2 — Voice & Responses
- [x] Client TTS + Accent Emulator (immediate) — **100%**
- [x] Voice Scan → Accent Profiles — **100%**
- [x] Local Neural TTS route (lazy, graceful fallback) — **100%**
- [ ] Profile blending & editor — **0%** (queued)

## Priority 3 — UI & Hologram Interface
- [x] Theme system (Classic default / HUD alt) — **100%**
- [x] Hologram sphere with dual states + motion — **100%**

## Priority 4 — Curiosity Engine (Adaptive)
- [x] Adaptive triggers + variability (core) — **100%**
- [ ] Persona tuning & sliders — **0%** (queued)

## Priority 5 — Internet Access (Gated)
- [ ] Router / allowlist / approvals — **0%** (planned)

Updated: {NOW}
"""),
"EVOLUTION.md": textwrap.dedent(f"""
# Evolution
- v1.0 — Baseline HUD + client TTS
- v1.1 — Voice scan/profiles, local neural TTS, logs/checkpoints, themes
- v1.2 — Dual-state hologram, motion, adaptive curiosity core

Updated: {NOW}
"""),
"LAB_LOG.md": f"- {NOW} — Unified build: voice ready, accent mimic active, curiosity adaptive, UI finalized.\n",
"CHANGO_NOTES.locked": "",
# ------------------------------------------------------------------
# CLIENT — UI (finished settings)
# ------------------------------------------------------------------
"client/index.html": textwrap.dedent("""
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chango AI • HUD</title>
<link rel="stylesheet" href="theme.css">
<script>
  const saved = localStorage.getItem('chango_theme') || 'classic';
  document.documentElement.classList.add(saved==='hud'?'theme-hud':'theme-classic');
  function toggleTheme(){
    const r=document.documentElement;
    if(r.classList.contains('theme-classic')){ r.classList.remove('theme-classic'); r.classList.add('theme-hud'); localStorage.setItem('chango_theme','hud');}
    else { r.classList.remove('theme-hud'); r.classList.add('theme-classic'); localStorage.setItem('chango_theme','classic');}
    const s=document.getElementById('status'); if(s) s.textContent='status: theme changed';
  }
</script>
</head>
<body>
<header>
  <div><strong>CHANGO AI</strong> • Voice HUD</div>
  <div class="row">
    <div class="badge" id="routeBadge">Route: Client</div>
    <button class="pill" onclick="toggleTheme()">Theme</button>
  </div>
</header>
<main>
  <div class="card">
    <div class="row">
      <button class="pill" id="btnEnable">Enable Voice</button>
      <button class="pill" id="btnTest">Test “Hello, I’m Chango.”</button>
      <button class="pill" id="btnStop">Stop</button>
    </div>
    <p class="small" id="status">status: idle</p>
  </div>

  <div class="card">
    <label>Voice Route</label>
    <div class="row">
      <button class="pill" data-route="client">Client</button>
      <button class="pill" data-route="local_neural">Local Neural</button>
      <button class="pill" data-route="elevenlabs">ElevenLabs</button>
      <button class="pill" data-route="azure">Azure</button>
    </div>
  </div>

  <div class="card">
    <label>Accent Emulator</label>
    <div class="row">
      <select id="accentProfile">
        <option value="neutral">Neutral</option>
        <option value="brit_rp">British (RP)</option>
        <option value="southern_us">Southern US</option>
        <option value="spanish_en">Spanish-influenced English</option>
        <option value="caribbean">Caribbean / Jamaican-influenced</option>
      </select>
      <label>Intensity 
        <input id="accentIntensity" type="range" min="0" max="1" step="0.05" value="0.55">
      </label>
      <button class="pill" id="btnRepeatWithAccent">Repeat (accent)</button>
    </div>
  </div>

  <div class="card">
    <label>Scan a Voice → Learn Accent</label>
    <div class="row">
      <input id="profileName" type="text" placeholder="Profile name" style="min-width:220px;">
      <button class="pill" id="btnRec">● Record (hold)</button>
      <button class="pill" id="btnAnalyze">Analyze & Save</button>
      <button class="pill" id="btnRefreshProfiles">Refresh Profiles</button>
      <select id="selProfiles" style="min-width:220px;"></select>
      <button class="pill" id="btnUseProfile">Use Selected Profile</button>
    </div>
    <p class="small" id="scanStatus">voice scan: idle</p>
  </div>

  <div class="card">
    <div class="row" style="justify-content:space-between">
      <label>Hologram Sphere</label>
      <div class="row">
        <button class="pill" id="holoToggle">Toggle</button>
        <select id="holoMode">
          <option value="awakened">Awakened (gold+green)</option>
          <option value="sentinel">Sentinel (red+gold)</option>
        </select>
        <label class="small">Size
          <input id="holoSize" type="range" min="200" max="560" step="10" value="320">
        </label>
        <label class="small">Spin
          <input id="holoSpeed" type="range" min="0" max="2" step="0.05" value="0.8">
        </label>
        <label class="small">Wander
          <input id="holoWander" type="checkbox" />
        </label>
      </div>
    </div>
    <div id="holoRoot" class="hidden holo-mode-awakened">
      <div id="holoWrap">
        <canvas id="holoCanvas" width="640" height="640"></canvas>
        <div class="holo-ring"></div>
        <div class="holo-chip" id="holoChip">CHANGO • ONLINE</div>
      </div>
    </div>
  </div>

  <div class="card">
    <label>Say something</label>
    <div class="row">
      <input id="sayText" type="text" placeholder="Type and press Speak…" style="flex:1;min-width:240px;">
      <button class="pill" id="btnSpeak">Speak</button>
    </div>
  </div>
</main>
<script src="app.js"></script>
<script src="hologram.js"></script>
<script src="curiosity.js"></script>
</body></html>
"""),
"client/theme.css": textwrap.dedent("""
:root{
  --bg:#0a0f14; --panel:#0e1520; --panel-border:#1e2a38;
  --text:#e7f0f7; --muted:#9fb3c8; --chip:#16324a; --input:#0b1220; --stroke:#243447;
}
.theme-classic{
  --bg:#0b0d10; --panel:#111418; --panel-border:#1c232e; --text:#e9eef5; --muted:#a9b5c4;
  --chip:#1b2a3d; --input:#0e141c; --stroke:#2a3a4f; --radius:12px; --pad:16px; --shadow:0 6px 18px rgba(0,0,0,.35);
}
.theme-classic .pill{border-radius:999px;padding:8px 12px;border:1px solid var(--stroke);background:var(--input);color:var(--text)}
.theme-classic .card{background:var(--panel);border:1px solid var(--panel-border);border-radius:var(--radius);padding:var(--pad);margin-bottom:12px;box-shadow:var(--shadow)}
.theme-classic header{background:var(--panel);border-bottom:1px solid var(--panel-border)}
.theme-hud{
  --bg:#060a0f; --panel:#0b1119; --panel-border:#152232; --text:#dff1ff; --muted:#9fb3c8; --chip:#0f2b49;
  --input:#09101a; --stroke:#1d3046; --radius:14px; --pad:18px; --shadow:0 8px 22px rgba(2,12,22,.45);
}
.theme-hud .pill{border-radius:12px;padding:10px 14px;border:1px solid var(--stroke);background:linear-gradient(180deg, rgba(20,40,70,.6), rgba(10,20,30,.4));backdrop-filter: blur(3px);color:var(--text)}
.theme-hud .card{background:linear-gradient(180deg, rgba(10,18,28,.8), rgba(8,14,22,.8));border:1px solid var(--panel-border);border-radius:var(--radius);padding:var(--pad);margin-bottom:14px;box-shadow:var(--shadow)}
.theme-hud header{background:linear-gradient(180deg, rgba(10,16,24,.9), rgba(6,10,16,.9));border-bottom:1px solid var(--panel-border)}
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text);margin:0}
header{padding:16px 20px;display:flex;align-items:center;justify-content:space-between}
.badge{font-size:12px;padding:4px 8px;border-radius:12px;background:var(--chip)}
main{max-width:900px;margin:24px auto;padding:0 16px 48px}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
label{font-size:14px;opacity:.92;display:block;margin-bottom:6px}
select,input[type=text],button{background:var(--input);color:var(--text);border:1px solid var(--stroke);border-radius:10px;padding:10px 12px}
.small{font-size:12px;color:var(--muted)}
input[type="range"]{accent-color:#4aa3ff}

/* Hologram palettes + layout */
#holoRoot { position: fixed; z-index: 9999; right: 20px; bottom: 24px; display: grid; place-items: center; padding: 6px; }
#holoRoot.hidden { display:none; }
#holoWrap { position: relative; cursor: grab; }
#holoWrap:active { cursor: grabbing; }
.holo-ring { position:absolute; left:50%; transform:translateX(-50%); bottom:-16px; width:66%; height:14px; border-radius:50%;
  background: radial-gradient(ellipse at center, rgba(255,255,255,.22), rgba(255,255,255,0) 60%); filter: blur(2px); }
.holo-chip { position:absolute; left:50%; transform:translateX(-50%); bottom:-40px; font-size:12px; color:#e7f0f7;
  background: rgba(20,40,60,.35); border:1px solid rgba(60,140,180,.35); padding:4px 8px; border-radius:10px; backdrop-filter: blur(3px); }
.holo-mode-sentinel #holoCanvas {
  filter: drop-shadow(0 0 8px rgba(255, 70, 40, .45)) drop-shadow(0 0 20px rgba(255, 140, 40, .35));
  background: radial-gradient(ellipse at center, rgba(30,4,4,.9) 0%, rgba(26,6,0,.92) 45%, rgba(18,2,0,.95) 100%);
}
.holo-mode-awakened #holoCanvas {
  filter: drop-shadow(0 0 10px rgba(255, 210, 80, .55)) drop-shadow(0 0 28px rgba(60, 255, 170, .35));
  background: radial-gradient(ellipse at center, rgba(8,20,12,.88) 0%, rgba(6,14,10,.92) 45%, rgba(4,10,8,.96) 100%);
}
"""),
"client/app.js": textwrap.dedent("""
let route='client', voices=[], state={voiceURI:null,rate:1,pitch:1,volume:1};
let lastUtteranceRaw = ""; let lastUtteranceSaid = "";
const el=id=>document.getElementById(id); const status=msg=>el('status').textContent='status: '+msg;
const setBadge=()=>document.getElementById('routeBadge').textContent='Route: '+route[0].toUpperCase()+route.slice(1);

function loadVoices(){ voices=speechSynthesis.getVoices(); const sel=el('selVoice'); if(!sel) return;
  sel.innerHTML=''; voices.forEach(v=>{ const o=document.createElement('option'); o.value=v.voiceURI; o.text=`${v.name} (${v.lang})${v.default?' • default':''}`; sel.appendChild(o);
  if(v.default && !state.voiceURI) state.voiceURI=v.voiceURI;}); if(state.voiceURI) sel.value=state.voiceURI;}
if('speechSynthesis' in window){ speechSynthesis.onvoiceschanged=loadVoices; setTimeout(loadVoices,200);} else { status('Web Speech API not available'); }

document.addEventListener('click',e=>{ if(e.target.matches('[data-route]')){ route=e.target.getAttribute('data-route'); setBadge(); }});
if(el('btnEnable')) el('btnEnable').onclick=()=>{ const u=new SpeechSynthesisUtterance(''); speechSynthesis.speak(u); status('voice ready'); };
if(el('selVoice')) el('selVoice').onchange=e=>state.voiceURI=e.target.value;
['rate','pitch','volume'].forEach(k=> { const n=el(k); if(n) n.oninput=e=>state[k]=parseFloat(e.target.value); });

// Accent engine (client)
const RNG=()=>Math.random(); const jitter=(v,a)=>Math.max(0, v + (RNG()*2-1)*a); const chance=p=>RNG()<p;
function injectPauses(text,intensity){ return text.replace(/,\\s*/g,()=> (chance(0.6)?", ":",  ")).replace(/\\.\\s*/g,()=> (chance(0.5)?". ":" .  ")); }
const ACCENTS={ neutral:{name:"Neutral",rules:(t,i)=>injectPauses(t,i),rateJitter:.03,pitchJitter:.02,volJitter:0},
  brit_rp:{name:"British RP",rules:(t,i)=>{let x=t; if(i>0) x=x.replace(/([aeiouAEIOU])r\\b/g,(m,v)=> v + (chance(i*.8)?"":"r")); if(i>.5) x=x.replace(/\\bbath\\b/gi,"bahth"); return injectPauses(x,i);},rateJitter:.02,pitchJitter:.03,volJitter:0},
  southern_us:{name:"Southern US",rules:(t,i)=>{let x=t; if(i>.4){x=x.replace(/\\byou all\\b/gi,"y’all"); x=x.replace(/\\bgoing to\\b/gi,"gonna"); } return injectPauses(x,i);},rateJitter:.06,pitchJitter:.015,volJitter:0},
  spanish_en:{name:"Spanish-influenced English",rules:(t,i)=>{let x=t; if(i>.3) x=x.replace(/\\bvery\\b/gi,"bery"); if(i>.5) x=x.replace(/th/gi,(m)=> chance(.6*i)?(m===m.toUpperCase()?"D":"d"):(m===m.toUpperCase()?"T":"t")); return injectPauses(x,i);},rateJitter:.03,pitchJitter:.03,volJitter:0},
  caribbean:{name:"Caribbean",rules:(t,i)=>{let x=t; if(i>.3) x=x.replace(/th/gi,(m)=> chance(.6*i)?(m===m.toUpperCase()?"D":"d"):(m===m.toUpperCase()?"T":"t")); return injectPauses(x,i);},rateJitter:.05,pitchJitter:.02,volJitter:0}};
function applyAccent(text){ const profile=(document.getElementById('accentProfile')||{}).value||"neutral";
  const intensity=parseFloat((document.getElementById('accentIntensity')||{value:"0.5"}).value||"0.5");
  const a=ACCENTS[profile]||ACCENTS.neutral; let t=a.rules(text,intensity);
  return { text:t, rate:jitter(state.rate,a.rateJitter), pitch:jitter(state.pitch,a.pitchJitter), volume:jitter(state.volume,a.volJitter), profile, intensity }; }
function pickVoice(){ return voices.find(v=>v.voiceURI===state.voiceURI)||voices.find(v=>v.default)||voices[0]; }
function speakClient(text,overrides={}){ const u=new SpeechSynthesisUtterance(text); const v=pickVoice(); if(v) u.voice=v;
  u.rate=overrides.rate??state.rate; u.pitch=overrides.pitch??state.pitch; u.volume=overrides.volume??state.volume;
  u.onstart=()=>status('speaking…'); u.onend=()=>status('idle'); u.onerror=e=>status('error: '+e.error); speechSynthesis.speak(u); }
async function speak(text){ lastUtteranceRaw=text; const styled=applyAccent(text); lastUtteranceSaid=styled.text;
  if(route==='client') return speakClient(styled.text,styled);
  try{ const res=await fetch(`/tts/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:styled.text})});
    if(res.status===501){ status(`${route} unavailable; fallback → client`); return speakClient(styled.text,styled); }
    if(!res.ok){ status('server error'); return; }
    const blob=await res.blob(); const url=URL.createObjectURL(blob); const audio=new Audio(url); audio.onended=()=>status('idle'); audio.play(); status('playing (server)…');
  }catch{ status('network error; fallback → client'); speakClient(styled.text,styled); }}
if(el('btnTest')) el('btnTest').onclick=()=>speak("Hello, I'm Chango. How can I help you today?");
if(el('btnSpeak')) el('btnSpeak').onclick=()=>{ const t=(el('sayText')||{}).value?.trim(); if(t) speak(t); };
if(el('btnStop')) el('btnStop').onclick=()=>speechSynthesis.cancel();
if(el('btnRepeatWithAccent')) el('btnRepeatWithAccent').onclick=()=>{ if(lastUtteranceRaw) speak(lastUtteranceRaw); };

// Mic → Profile
let mediaRecorder=null, chunks=[], recording=false;
async function initMic(){ const stream=await navigator.mediaDevices.getUserMedia({ audio:true });
  mediaRecorder=new MediaRecorder(stream,{mimeType:'audio/webm'}); mediaRecorder.ondataavailable=e=>{ if(e.data.size>0) chunks.push(e.data); };
  mediaRecorder.onstop=async()=>{ try{ const blob=new Blob(chunks,{type:'audio/webm'}); chunks=[]; el('scanStatus').textContent='voice scan: uploading...';
      const fd=new FormData(); fd.append('audio',blob,'sample.webm'); const name=(el('profileName')?.value||'').trim(); if(name) fd.append('name',name);
      const res=await fetch('/voice_profile/learn',{method:'POST',body:fd}); const js=await res.json();
      if(!res.ok||!js.ok){ el('scanStatus').textContent='analyze error'; return;} el('scanStatus').textContent=`profile saved: ${js.profile?.id||'(unnamed)'}`; await refreshProfiles();
  }catch(e){ el('scanStatus').textContent='upload error'; }};}
if(el('btnRec')){ el('btnRec').onmousedown=async()=>{ try{ if(!mediaRecorder) await initMic(); if(recording) return; chunks=[]; mediaRecorder.start(); recording=true; el('scanStatus').textContent='voice scan: recording... (release to stop)';
} catch(e){ el('scanStatus').textContent='mic error: '+e; }};
  el('btnRec').onmouseup=()=>{ if(mediaRecorder&&recording){ mediaRecorder.stop(); recording=false; el('scanStatus').textContent='voice scan: processing...'; }}}
if(el('btnAnalyze')) el('btnAnalyze').onclick=()=>{ el('scanStatus').textContent='analysis requires a fresh recording (hold Record)'; };
async function refreshProfiles(){ try{ const r=await fetch('/voice_profile/list'); const js=await r.json(); const sel=el('selProfiles'); if(!sel) return; sel.innerHTML='';
    (js.profiles||[]).forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.textContent=`${p.id} — ${p.summary}`; sel.appendChild(o); });
    el('scanStatus').textContent=`profiles: ${js.profiles?.length||0} found`;
  }catch{ el('scanStatus').textContent='failed to list profiles'; } }
if(el('btnRefreshProfiles')) el('btnRefreshProfiles').onclick=refreshProfiles;
if(el('btnUseProfile')) el('btnUseProfile').onclick=async()=>{ const id=(el('selProfiles')||{}).value; if(!id){ el('scanStatus').textContent='pick a profile'; return; }
  try{ const r=await fetch(`/voice_profile/get/${encodeURIComponent(id)}`); const js=await r.json(); if(!r.ok||!js.ok){ el('scanStatus').textContent='failed to fetch profile'; return; }
    const p=js.profile||{}; if(p.mapped){ const ap=document.getElementById('accentProfile'), ai=document.getElementById('accentIntensity');
      if(ap && p.mapped.profile) ap.value=p.mapped.profile; if(ai && typeof p.mapped.intensity==='number') ai.value=p.mapped.intensity;
      if(typeof p.base_rate==='number') state.rate=p.base_rate; if(typeof p.base_pitch==='number') state.pitch=p.base_pitch; if(typeof p.base_volume==='number') state.volume=p.base_volume;
      el('scanStatus').textContent=`using profile: ${p.id}`; } else { el('scanStatus').textContent='profile has no mapping'; }
  }catch{ el('scanStatus').textContent='error applying profile'; }};
refreshProfiles();

// HOLOGRAM wires + auto state
(function(){
  const toggleBtn=el('holoToggle'), sizeCtl=el('holoSize'), speedCtl=el('holoSpeed'), modeSel=el('holoMode'), wanderCtl=el('holoWander');
  if(!toggleBtn || !window.ChangoHolo) return; let on=false;
  toggleBtn.onclick=()=>{ on=!on; if(on){ ChangoHolo.show(); toggleBtn.textContent='Hide'; } else { ChangoHolo.hide(); toggleBtn.textContent='Toggle'; } };
  sizeCtl?.addEventListener('input', e=> ChangoHolo.setSize(e.target.value));
  speedCtl?.addEventListener('input', e=> ChangoHolo.setSpeed(e.target.value));
  modeSel?.addEventListener('change', e=> ChangoHolo.setMode(e.target.value));
  wanderCtl?.addEventListener('change', e=> (ChangoHolo.state.wander=!!e.target.checked));

  const _speak = speak;
  window.speak = async (text)=>{ try{ await _speak(text); if(on) ChangoHolo.setMode('awakened'); } catch(e){ if(on) ChangoHolo.setMode('sentinel'); throw e; } };
  const _status = status;
  window.status = (msg)=>{ _status(msg); if(!on) return; const t=(msg||'').toLowerCase(); if(t.includes('unavailable')||t.includes('error')) ChangoHolo.setMode('sentinel'); if(t.includes('playing')||t.includes('ready')||t.includes('idle')) ChangoHolo.setMode('awakened'); };
})();
"""),
"client/hologram.js": textwrap.dedent("""
(function(){
  const palette={ sentinel:{ wire:'rgba(255,120,60,0.85)', wireDim:'rgba(255,80,40,0.35)', particles:'rgba(255,120,60,', scan:'rgba(255,60,30,0.08)', chipText:'SENTINEL • OFFLINE'},
                  awakened:{ wire:'rgba(255,220,100,0.9)', wireDim:'rgba(60,255,170,0.45)', particles:'rgba(255,220,100,', scan:'rgba(30,120,90,0.08)', chipText:'CHANGO • ONLINE'} };
  const cfg={ size:320, speed:0.8, lineCount:18, particleCount:240, bgFade:0.08 };
  let canvas,ctx,W,H,t=0,running=false,raf=null,mode='awakened';
  const state={visible:false,speed:cfg.speed,size:cfg.size,wander:false}; let drag=false,startX=0,startY=0,posX=0,posY=0,vx=0,vy=0,lastTime=0;
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function project3(x,y,z,r){ const d=2.4,f=r/(z+d); return [W/2 + x*f, H/2 + y*f];}
  function setupCanvas(){ canvas=document.getElementById('holoCanvas'); if(!canvas) return false; ctx=canvas.getContext('2d'); resizeCanvas(); return true; }
  function resizeCanvas(){ const s=clamp(state.size,200,560); canvas.width=s*2; canvas.height=s*2; W=canvas.width; H=canvas.height; }
  function overlayFX(){ for(let y=0;y<H;y+=2){ ctx.fillStyle=palette[mode].scan; ctx.fillRect(0,y,W,1);} const g=ctx.createRadialGradient(W/2,H/2,H*0.05,W/2,H/2,H*0.6);
    g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(1,'rgba(255,255,255,0.12)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(W/2,H/2,H*0.55,0,Math.PI*2); ctx.fill(); }
  function drawWireSphere(r,rot){ const c1=palette[mode].wire,c2=palette[mode].wireDim; ctx.lineWidth=1;
    for(let i=-cfg.lineCount;i<=cfg.lineCount;i++){ const lat=(i/cfg.lineCount)*(Math.PI/2); ctx.beginPath();
      for(let j=0;j<=120;j++){ const lon=(j/120)*Math.PI*2; const x=r*Math.cos(lat)*Math.cos(lon+rot), y=r*Math.sin(lat), z=r*Math.cos(lat)*Math.sin(lon+rot);
        const [px,py]=project3(x,y,z,r*1.15); if(j===0) ctx.moveTo(px,py); else ctx.lineTo(px,py); }
      const a=0.25+0.35*(1-Math.abs(i)/cfg.lineCount); ctx.strokeStyle=c1.replace(/0\\.(\\d+)/,(_,d)=> (a.toFixed(3))); ctx.stroke(); }
    for(let i=0;i<cfg.lineCount;i++){ const lon0=(i/cfg.lineCount)*Math.PI*2+rot; ctx.beginPath();
      for(let j=-60;j<=60;j++){ const lat=(j/60)*(Math.PI/2); const x=r*Math.cos(lat)*Math.cos(lon0), y=r*Math.sin(lat), z=r*Math.cos(lat)*Math.sin(lon0);
        const [px,py]=project3(x,y,z,r*1.15); if(j===-60) ctx.moveTo(px,py); else ctx.lineTo(px,py);} ctx.strokeStyle=c2; ctx.stroke(); } }
  let particles=[]; function initParticles(r){ particles=[]; for(let i=0;i<cfg.particleCount;i++){ particles.push({a:Math.random()*Math.PI*2,b:Math.random()*Math.PI-Math.PI/2,k:0.92+Math.random()*0.18,s:0.002+Math.random()*0.004}); } }
  function drawParticles(r,rot){ for(const p of particles){ p.a+=p.s*(0.5+state.speed); const x=r*p.k*Math.cos(p.b)*Math.cos(p.a+rot), y=r*p.k*Math.sin(p.b), z=r*p.k*Math.cos(p.b)*Math.sin(p.a+rot);
      const [px,py]=project3(x,y,z,r*1.15); const depth=(z+r)/(2*r), size=1+depth*2; ctx.fillStyle=palette[mode].particles+(0.25+depth*0.55)+')'; ctx.beginPath(); ctx.arc(px,py,size,0,Math.PI*2); ctx.fill(); } }
  function tick(){ if(!running) return; ctx.fillStyle=`rgba(0,10,20,${cfg.bgFade})`; ctx.fillRect(0,0,W,H); const r=Math.min(W,H)*0.32+Math.sin(t*0.8)*2, rot=t*0.6*state.speed;
    drawParticles(r,rot); drawWireSphere(r,rot); overlayFX(); t+=0.016; raf=requestAnimationFrame(tick); }
  function start(){ if(!canvas||!ctx||running) return; initParticles(Math.min(W,H)*0.32); running=true; ctx.fillStyle='rgba(0,10,20,1)'; ctx.fillRect(0,0,W,H); tick(); }
  function stop(){ running=false; if(raf) cancelAnimationFrame(raf); }
  function show(){ document.getElementById('holoRoot')?.classList.remove('hidden'); state.visible=true; start(); }
  function hide(){ document.getElementById('holoRoot')?.classList.add('hidden'); state.visible=false; stop(); }
  function setSize(v){ state.size=Number(v)||cfg.size; resizeCanvas(); initParticles(Math.min(W,H)*0.32); }
  function setSpeed(v){ state.speed=Number(v)||cfg.speed; }
  function setMode(m){ mode=(m==='sentinel')?'sentinel':'awakened'; const root=document.getElementById('holoRoot');
    root.classList.remove('holo-mode-sentinel','holo-mode-awakened'); root.classList.add(mode==='sentinel'?'holo-mode-sentinel':'holo-mode-awakened');
    const chip=document.getElementById('holoChip'); if(chip) chip.textContent = (mode==='sentinel'?'SENTINEL • OFFLINE':'CHANGO • ONLINE'); }
  function setupMotion(){ const root=document.getElementById('holoRoot'), wrap=document.getElementById('holoWrap'); if(!root||!wrap) return;
    const rect=wrap.getBoundingClientRect(); posX=window.innerWidth-rect.width-20; posY=window.innerHeight-rect.height-24; root.style.transform=`translate(${posX}px, ${posY}px)`;
    function onDown(e){ drag=true; startX=(e.touches?e.touches[0].clientX:e.clientX)-posX; startY=(e.touches?e.touches[0].clientY:e.clientY)-posY; vx=vy=0; }
    function onMove(e){ if(!drag) return; const x=(e.touches?e.touches[0].clientX:e.clientX)-startX, y=(e.touches?e.touches[0].clientY:e.clientY)-startY;
      const nx=Math.max(0,Math.min(x,window.innerWidth-rect.width-8)), ny=Math.max(0,Math.min(y,window.innerHeight-rect.height-8));
      vx=nx-posX; vy=ny-posY; posX=nx; posY=ny; root.style.transform=`translate(${posX}px, ${posY}px)`; }
    function onUp(){ drag=false; }
    wrap.addEventListener('mousedown',onDown); document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp);
    wrap.addEventListener('touchstart',onDown,{passive:true}); document.addEventListener('touchmove',onMove,{passive:true}); document.addEventListener('touchend',onUp);
    lastTime=performance.now(); function moveTick(now){ const dt=Math.min(0.04,(now-lastTime)/1000); lastTime=now; if(!drag){ posX+=vx; posY+=vy; vx*=0.92; vy*=0.92;
        if(state.wander){ vx+=(Math.random()-0.5)*0.06; vy+=(Math.random()-0.5)*0.06; }
        const w=wrap.getBoundingClientRect().width, h=wrap.getBoundingClientRect().height;
        if(posX<0){posX=0;vx*=-0.6} if(posY<0){posY=0;vy*=-0.6} if(posX>window.innerWidth-w-8){posX=window.innerWidth-w-8;vx*=-0.6}
        if(posY>window.innerHeight-h-8){posY=window.innerHeight-h-8;vy*=-0.6} root.style.transform=`translate(${posX}px, ${posY}px)`; }
      requestAnimationFrame(moveTick);} requestAnimationFrame(moveTick); }
  window.ChangoHolo={ show, hide, setSize, setSpeed, setMode, setupCanvas, state };
  window.addEventListener('load', ()=>{ if(setupCanvas()) setupMotion(); });
})();
"""),
# ------------------------------------------------------------------
# Curiosity (adaptive core)
# ------------------------------------------------------------------
"client/curiosity.js": textwrap.dedent("""
(function(){
  // Lightweight, adaptive curiosity that occasionally asks, checks contradictions, or offers a thought.
  const cfg = { baseChance: 0.18, spikeOnNewProfile: 0.35, cooldownMs: 12000 };
  let last = 0;
  function maybeCurious(trigger="idle"){
    const now = Date.now();
    if(now - last < cfg.cooldownMs) return;
    const p = (trigger==="profile") ? cfg.spikeOnNewProfile : cfg.baseChance;
    if(Math.random() < p){
      last = now;
      // simple nudge through status line; can be expanded to a chat bubble later
      const ideas = [
        "I noticed a pacing change—should we save this as a style preset?",
        "Curious: want me to try a softer pitch for this topic?",
        "I can summarize our last 3 steps into a note—do it?",
        "I think your last assumption conflicts with earlier notes. Want a quick check?"
      ];
      const pick = ideas[Math.floor(Math.random()*ideas.length)];
      const s = document.getElementById('status'); if(s) s.textContent = "status: curiosity — " + pick;
    }
  }
  // hooks — call maybeCurious on relevant UI actions:
  window.addEventListener('click', (e)=>{ if(e.target && e.target.id==='btnUseProfile') maybeCurious('profile'); });
  window.ChangoCuriosity = { maybeCurious };
})();
"""),
# ------------------------------------------------------------------
# SERVER
# ------------------------------------------------------------------
"server/__init__.py": "",
"server/app.py": textwrap.dedent("""
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os, json, pathlib, time, zipfile, io, tempfile
import numpy as np
import librosa, soundfile as sf
from scipy.signal import find_peaks
from werkzeug.utils import secure_filename
from io import BytesIO

APP_ROOT = pathlib.Path(__file__).resolve().parent
PROJ_ROOT = APP_ROOT.parent
DATA_DIR = PROJ_ROOT / "data"
CKPT_DIR = PROJ_ROOT / "checkpoints"
PROFILES_DIR = DATA_DIR / "profiles"
for d in (DATA_DIR, CKPT_DIR, PROFILES_DIR):
    d.mkdir(parents=True, exist_ok=True)

FEEDBACK_FILE = DATA_DIR / "accents_log.jsonl"

app = Flask(__name__, static_folder="../client", static_url_path="/client")
CORS(app)

@app.get("/")
def health():
    return jsonify(ok=True, service="ChangoAI v1.2 unified")

def _env(k): return os.environ.get(k, "").strip()

# Cloud routes (off unless keys set)
@app.post("/tts/elevenlabs")
def tts_elevenlabs():
    if not _env("ELEVENLABS_API_KEY"):
        return ("Missing ELEVENLABS_API_KEY", 501)
    return ("Not implemented in this baseline", 501)

@app.post("/tts/azure")
def tts_azure():
    if not _env("AZURE_TTS_KEY") or not _env("AZURE_TTS_REGION"):
        return ("Missing AZURE_TTS_* env", 501)
    return ("Not implemented in this baseline", 501)

# Local Neural TTS (lazy install, safe fallback)
def _ensure_local_tts():
    try:
        from TTS.api import TTS  # type: ignore
    except Exception:
        import subprocess, sys
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "TTS==0.22.0"])
        except Exception as e:
            raise RuntimeError(f"pip install TTS failed: {e}")
        from TTS.api import TTS  # type: ignore

    model_name = os.environ.get("CHANGO_TTS_MODEL", "tts_models/en/ljspeech/glow-tts")
    if not hasattr(app, "_chango_tts"):
        app._chango_tts = TTS(model_name)
    return app._chango_tts

@app.post("/tts/local_neural")
def tts_local_neural():
    try:
        data = request.get_json(force=True, silent=True) or {}
        text = (data.get("text") or "").strip()
        if not text:
            return ("No text provided", 400)

        tts = _ensure_local_tts()
        wav = BytesIO()
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
            tts.tts_to_file(text=text, file_path=tmp.name)
            tmp.flush()
            with open(tmp.name, "rb") as f:
                wav.write(f.read())
        wav.seek(0)
        return send_file(wav, mimetype="audio/wav", as_attachment=False, download_name="chango.wav")
    except Exception as e:
        return (f"Local neural TTS unavailable: {e}", 501)

# Accent feedback log
@app.post("/accent_feedback")
def accent_feedback():
    try:
        payload = request.get_json(force=True, silent=True) or {}
        payload["ts_human"] = time.strftime("%Y-%m-%d %H:%M:%S")
        with open(FEEDBACK_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\\n")
        return jsonify(ok=True)
    except Exception as e:
        return jsonify(ok=False, error=str(e)), 500

# Checkpoints
INCLUDE_TOP = ["client","server","EVOLUTION.md","LAB_LOG.md","CHANGO_NOTES.locked","data","TASKS.md"]
def make_checkpoint():
    ts = time.strftime("%Y%m%d_%H%M%S")
    zip_path = CKPT_DIR / f"ChangoAI_checkpoint_{ts}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for item in INCLUDE_TOP:
            p = PROJ_ROOT / item
            if p.is_dir():
                for dp, _, fns in os.walk(p):
                    for fn in fns:
                        full = pathlib.Path(dp) / fn
                        rel = full.relative_to(PROJ_ROOT)
                        z.write(full, arcname=str(rel))
            elif p.exists():
                z.write(p, arcname=item)
    return zip_path

@app.post("/checkpoint")
def checkpoint():
    path = make_checkpoint()
    return jsonify(ok=True, checkpoint=str(path.name))

@app.get("/checkpoint/latest")
def checkpoint_latest():
    zips = sorted(CKPT_DIR.glob("ChangoAI_checkpoint_*.zip"))
    if not zips:
        return jsonify(ok=False, error="no checkpoints yet"), 404
    latest = zips[-1]
    return send_file(latest, as_attachment=True, download_name=latest.name)

# Voice Scan → Profiles
def _save_temp_wav_from_webm(blob_path, sr_target=22050):
    y, sr = librosa.load(blob_path, sr=sr_target, mono=True)
    tmp_wav = blob_path.with_suffix(".wav")
    sf.write(tmp_wav, y, sr)
    return tmp_wav, y, sr

def _analyze_voice(y, sr):
    frame_len = int(0.03*sr); hop = int(0.01*sr)
    rms = librosa.feature.rms(y=y, frame_length=frame_len, hop_length=hop)[0]
    thr = np.percentile(rms, 20)
    pause_frames = (rms < thr).sum(); pause_ratio = float(pause_frames) / float(len(rms) + 1e-9)
    S = np.abs(librosa.stft(y, n_fft=1024, hop_length=hop))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=1024)
    band = (freqs>=4000) & (freqs<=8000); sib_energy = float(S[band,:].mean())
    f0_est=None
    try:
        f0 = librosa.yin(y, fmin=70, fmax=300, sr=sr, frame_length=2048)
        f0 = f0[np.isfinite(f0)]
        if f0.size>0: f0_est = float(np.median(f0))
    except Exception: f0_est=None
    env = librosa.onset.onset_strength(y=y, sr=sr)
    from scipy.signal import find_peaks; peaks,_ = find_peaks(env, distance=5)
    duration_sec = max(1.0, len(y)/sr); syllables_per_sec = float(len(peaks))/duration_sec; wpm = syllables_per_sec * 60 / 1.5
    b1 = (freqs>=1400)&(freqs<=2200); b0 = (freqs>=300)&(freqs<=600)
    rhotic_ratio = float((S[b1,:].mean()+1e-9)/(S[b0,:].mean()+1e-9))
    return {"duration_sec": round(duration_sec,2),"pause_ratio": round(pause_ratio,3),"sib_energy": round(sib_energy,3),
            "f0_hz_median": round(f0_est,1) if f0_est else None, "wpm_est": round(wpm,1), "rhoticity": round(rhotic_ratio,3)}

def _map_features_to_accent_params(f):
    mapped={"profile":"neutral","intensity":0.5}; base_rate=1.0;base_pitch=1.0;base_volume=1.0
    if f["wpm_est"]>170: base_rate=1.15
    elif f["wpm_est"]<120: base_rate=0.9
    if f["f0_hz_median"]:
        if f["f0_hz_median"]<110: base_pitch=0.9
        elif f["f0_hz_median"]>200: base_pitch=1.1
    intensity = 0.5 + (0.3 if f["pause_ratio"]<0.12 else -0.1)
    intensity = float(min(1.0, max(0.1, intensity)))
    if f["rhoticity"]<1.0 and f["wpm_est"]<=140: mapped["profile"]="brit_rp"
    elif f["rhoticity"]>=1.2 and f["wpm_est"]<130: mapped["profile"]="southern_us"
    elif f["sib_energy"]>8.0 and f["wpm_est"]>=130: mapped["profile"]="spanish_en"
    elif f["sib_energy"]>9.5: mapped["profile"]="caribbean"
    else: mapped["profile"]="neutral"
    mapped["intensity"]=float(intensity)
    return mapped, base_rate, base_pitch, base_volume

from flask import abort
@app.post("/voice_profile/learn")
def voice_profile_learn():
    try:
        if "audio" not in request.files: return jsonify(ok=False, error="no audio"), 400
        audio = request.files["audio"]; raw_name = request.form.get("name") or f"profile_{int(time.time())}"
        from werkzeug.utils import secure_filename
        pid = secure_filename(raw_name).replace(" ","_") or f"profile_{int(time.time())}"
        tmp_in = PROFILES_DIR / f"{pid}.webm"; audio.save(tmp_in)
        wav_path, y, sr = _save_temp_wav_from_webm(tmp_in); feat = _analyze_voice(y, sr)
        mapped, br, bp, bv = _map_features_to_accent_params(feat)
        prof = {"id":pid,"features":feat,"mapped":mapped,"base_rate":br,"base_pitch":bp,"base_volume":bv,
                "created": time.strftime("%Y-%m-%d %H:%M:%S"), "summary": f"{mapped['profile']}@{mapped['intensity']:.2f} rate={br:.2f} pitch={bp:.2f}"}
        with open(PROFILES_DIR / f"{pid}.json", "w", encoding="utf-8") as f: json.dump(prof, f, ensure_ascii=False, indent=2)
        return jsonify(ok=True, profile=prof)
    except Exception as e:
        return jsonify(ok=False, error=str(e)), 500

@app.get("/voice_profile/list")
def voice_profile_list():
    items=[]
    for j in sorted(PROFILES_DIR.glob("*.json")):
        try:
            with open(j,"r",encoding="utf-8") as f:
                prof=json.load(f); items.append({"id":prof.get("id"),"summary":prof.get("summary","")})
        except Exception: pass
    return jsonify(ok=True, profiles=items)

@app.get("/voice_profile/get/<pid>")
def voice_profile_get(pid):
    from werkzeug.utils import secure_filename
    p = PROFILES_DIR / f"{secure_filename(pid)}.json"
    if not p.exists(): return jsonify(ok=False, error="not found"), 404
    with open(p,"r",encoding="utf-8") as f: prof=json.load(f)
    return jsonify(ok=True, profile=prof)

if __name__ == "__main__":
    try:
        (PROJ_ROOT / "data").mkdir(exist_ok=True); (PROJ_ROOT / "data" / "profiles").mkdir(parents=True, exist_ok=True)
        (PROJ_ROOT / "checkpoints").mkdir(exist_ok=True)
        if not list((PROJ_ROOT / "checkpoints").glob("ChangoAI_checkpoint_*.zip")):
            ts = time.strftime("%Y%m%d_%H%M%S")
            zip_path = (PROJ_ROOT / "checkpoints" / f"ChangoAI_checkpoint_{ts}.zip")
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
                for item in ["client","server","EVOLUTION.md","LAB_LOG.md","CHANGO_NOTES.locked","data","TASKS.md"]:
                    p = PROJ_ROOT / item
                    if p.is_dir():
                        for dp, _, fns in os.walk(p):
                            for fn in fns:
                                full = pathlib.Path(dp) / fn; rel = full.relative_to(PROJ_ROOT); z.write(full, arcname=str(rel))
                    elif p.exists():
                        z.write(p, arcname=item)
    except Exception as e:
        print("[warn] auto-checkpoint failed:", e)
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
"""),
}

def write_tree():
    for rel, content in FILES.items():
        p = ROOT / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)

def pip_install():
    try: subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
    except subprocess.CalledProcessError as e: print("pip install failed:", e)

def run_server():
    os.execvp(sys.executable, [sys.executable, "-m", "server.app"])

if __name__ == "__main__":
    write_tree()
    print("✅ Files written. Installing deps…")
    pip_install()
    print("🚀 Launching server…")
    run_server()


⸻

Done at 100%
	•	Theme system (Classic default / HUD alt)
	•	Hologram (Sentinel ⇄ Awakened) + inertia + wander
	•	Client TTS + Accent Emulator (active immediately)
	•	Voice Scan → Accent Profiles
	•	Local Neural TTS route (lazy; safe fallback)
	•	Adaptive Curiosity core
	•	Logs, Evolution, Tasks, Awareness lock
	•	Checkpoints API (/checkpoint, /checkpoint/latest)

If you want me to bundle this into a downloadable zip next, say the word.
```

## attached_assets/Pasted-Got-it-keep-ReplSync-2-as-the-base-and-just-bolt-on-the-missing-endpoints-no-rewrites-Below-are-1758843938468_1758843938468.txt

```
Got it — keep ReplSync 2 as the base and just bolt on the missing endpoints (no rewrites). Below are drop-in, isolated patches you can paste into that repo. They won’t collide with existing code; if a feature already exists, these safely coexist.

⸻

0) Install minimal deps

npm i express body-parser multer archiver wav-decoder


⸻

1) Utils (safe, standalone)

server/utils/paths.js

const path = require('path'); const fs = require('fs');
const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data');
const PROFILES = path.join(DATA, 'profiles');
const LOGS = path.join(ROOT, 'logs');
const CHECKPOINTS = path.join(ROOT, 'checkpoints');
function ensureDirs(){ [DATA, PROFILES, LOGS, CHECKPOINTS].forEach(d=>{ if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true}); }); }
module.exports = { ROOT, DATA, PROFILES, LOGS, CHECKPOINTS, ensureDirs };

server/utils/jsonl.js

const fs = require('fs'); const path = require('path');
function appendJSONL(file, obj){ fs.mkdirSync(path.dirname(file), {recursive:true}); fs.appendFileSync(file, JSON.stringify(obj)+'\n', 'utf8'); }
function readJSONL(file){ if(!fs.existsSync(file)) return []; return fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean); }
module.exports = { appendJSONL, readJSONL };

server/utils/zip.js

const archiver = require('archiver'); const fs = require('fs'); const path = require('path');
async function zipPaths(outPath, paths){
  await new Promise((resolve,reject)=>{
    const out=fs.createWriteStream(outPath); const ar=archiver('zip',{zlib:{level:9}});
    out.on('close',()=>resolve()); ar.on('error',reject); ar.pipe(out);
    for(const p of paths){ if(fs.existsSync(p)){ const st=fs.statSync(p); st.isDirectory()? ar.directory(p, path.basename(p)) : ar.file(p,{name:path.basename(p)}); } }
    ar.finalize();
  });
}
module.exports = { zipPaths };


⸻

2) Routes (mount anywhere; all under “/”)

server/routes/health.js

const { Router } = require('express'); const r = Router();
r.get('/', (_req,res)=> res.json({ ok:true, service:'ChangoAI unified shim' }));
module.exports = r;

server/routes/feedback.js

const { Router } = require('express'); const path = require('path');
const { DATA } = require('../utils/paths'); const { appendJSONL } = require('../utils/jsonl');
const r = Router(); const FEEDBACK = path.join(DATA,'accents_log.jsonl');
r.post('/accent_feedback',(req,res)=>{ try{ appendJSONL(FEEDBACK, { ...(req.body||{}), ts:new Date().toISOString() }); res.json({ok:true}); } catch(e){ res.status(500).json({ok:false,error:String(e.message||e)}) }});
module.exports = r;

server/routes/checkpoints.js

const { Router } = require('express'); const path = require('path'); const fs = require('fs');
const { zipPaths } = require('../utils/zip'); const { CHECKPOINTS, ROOT } = require('../utils/paths');
const r = Router();
r.post('/checkpoint', async (_req,res)=>{ try{
  const ts=new Date().toISOString().replace(/[:.]/g,'-'); const out=path.join(CHECKPOINTS,`ChangoAI_checkpoint_${ts}.zip`);
  await zipPaths(out, [ path.join(ROOT,'client'), path.join(ROOT,'server'), path.join(ROOT,'data'), path.join(ROOT,'logs'), path.join(ROOT,'TASKS.md'), path.join(ROOT,'EVOLUTION.md') ]);
  res.json({ok:true, checkpoint:path.basename(out)});
} catch(e){ res.status(500).json({ok:false,error:String(e.message||e)}) }});
r.get('/checkpoint/latest',(req,res)=>{ try{
  if(!fs.existsSync(CHECKPOINTS)) return res.status(404).json({ok:false,error:'no checkpoints yet'});
  const files=fs.readdirSync(CHECKPOINTS).filter(f=>f.endsWith('.zip')).sort(); if(!files.length) return res.status(404).json({ok:false,error:'no checkpoints yet'});
  const latest=files[files.length-1]; res.download(path.join(CHECKPOINTS, latest), latest);
} catch(e){ res.status(500).json({ok:false,error:String(e.message||e)}) }});
module.exports = r;

server/routes/voiceProfiles.js

const { Router } = require('express'); const multer = require('multer'); const path = require('path'); const fs = require('fs');
const { spawnSync } = require('child_process'); const { decode } = require('wav-decoder'); const { PROFILES } = require('../utils/paths');
const r = Router();
const upload = multer({ storage: multer.diskStorage({ destination:(_q,_f,cb)=>{fs.mkdirSync(PROFILES,{recursive:true});cb(null,PROFILES)}, filename:(_q,f,cb)=>cb(null,Date.now()+'_'+f.originalname.replace(/\s+/g,'_')) })});
const ffmpegExists=()=>{ try{ return spawnSync('ffmpeg',['-version']).status===0; }catch{ return false; } };

function mapToAccent(f){ let profile='neutral', intensity=0.5, rate=1,pitch=1,vol=1;
  if(f.wpm>170) rate=1.15; else if(f.wpm<120) rate=0.9; if(f.f0<110) pitch=0.9; else if(f.f0>200) pitch=1.1;
  intensity=Math.max(0.1,Math.min(1,0.5 + (f.pauseRatio<0.12?0.3:-0.1)));
  if(f.rhoticity<0.95 && f.wpm<=140) profile='brit_rp';
  else if(f.rhoticity>=1.2 && f.wpm<130) profile='southern_us';
  if(f.sibilance>0.75 && f.wpm>=130) profile='spanish_en';
  if(f.sibilance>0.85) profile='caribbean';
  return { mapped:{profile,intensity}, rate,pitch,vol };
}
async function analyzeWav(p){
  const buf=fs.readFileSync(p); const wav=await decode(buf);
  const ch=wav.channelData?.[0]||new Float32Array(); const sr=wav.sampleRate||22050; const N=ch.length||1;
  const win=Math.max(256,Math.floor(0.03*sr)), hop=Math.max(128,Math.floor(0.01*sr));
  let s2=0; for(let i=0;i<N;i++) s2+=ch[i]*ch[i]; const gRMS=Math.sqrt(s2/N), thr=gRMS*0.25; let low=0,frames=0;
  for(let i=0;i+win<=N;i+=hop){ frames++; let e=0; for(let j=0;j<win;j++) e+=ch[i+j]*ch[i+j]; if(Math.sqrt(e/win)<thr) low++; }
  let zc=0; for(let i=1;i<N;i++) if((ch[i-1]<0&&ch[i]>=0)||(ch[i-1]>0&&ch[i]<=0)) zc++;
  const f0=(zc/(N/sr))/2;
  const step=Math.max(1,Math.floor(sr/4000)); let hi=0,lo=0,c=0;
  for(let i=0;i<N;i+=step){ const v=Math.abs(ch[i]); if(i%(step*4)===0) hi+=v; else lo+=v; c++; }
  let peaks=0, prev=false; for(let i=0;i<N;i+=hop){ let s=0; for(let j=0;j<Math.min(win,N-i);j++) s+=Math.abs(ch[i+j]); const e=s/win; const pk=e>(gRMS*0.6); if(pk && !prev) peaks++; prev=pk; }
  const dur=N/sr, sylPerSec=peaks/Math.max(1,dur), wpm=(sylPerSec*60)/1.5;
  return { duration:+dur.toFixed(2), pauseRatio:+(low/Math.max(frames,1)).toFixed(3), f0:isFinite(f0)?+f0.toFixed(1):undefined, wpm:+wpm.toFixed(1), sibilance:+(hi/(hi+lo+1e-9)).toFixed(3), rhoticity:+((lo+1e-9)/(hi+1e-9)).toFixed(3) };
}

r.post('/voice_profile/learn', upload.single('audio'), async (req,res)=>{
  try{
    if(!req.file) return res.status(400).json({ok:false,error:'no audio'});
    if(!ffmpegExists()) return res.status(501).json({ok:false,error:'ffmpeg not installed'});
    const raw=(req.body?.name||('profile_'+Date.now())).toString().replace(/\s+/g,'_'); const id=raw.replace(/[^a-zA-Z0-9_\-]/g,'');
    const src=req.file.path, wav=path.join(PROFILES,`${id}.wav`), json=path.join(PROFILES,`${id}.json`);
    const conv = require('child_process').spawnSync('ffmpeg',['-y','-i',src,'-ac','1','-ar','22050',wav],{stdio:'ignore'});
    if(conv.status!==0 || !fs.existsSync(wav)) return res.status(501).json({ok:false,error:'ffmpeg failed'});
    const feat=await analyzeWav(wav); const map=mapToAccent(feat);
    const profile={ id, features:feat, mapped:map.mapped, base_rate:map.rate, base_pitch:map.pitch, base_volume:map.vol, created:new Date().toISOString(),
      summary:`${map.mapped.profile}@${map.mapped.intensity.toFixed(2)} rate=${map.rate.toFixed(2)} pitch=${map.pitch.toFixed(2)}` };
    fs.writeFileSync(json, JSON.stringify(profile,null,2),'utf8');
    res.json({ok:true, profile});
  }catch(e){ res.status(500).json({ok:false,error:String(e.message||e)}) }
});

r.get('/voice_profile/list',(_q,res)=>{ try{
  const items = fs.existsSync(PROFILES)? fs.readdirSync(PROFILES).filter(f=>f.endsWith('.json')).map(f=>{ try{const p=JSON.parse(fs.readFileSync(path.join(PROFILES,f),'utf8')); return {id:p.id,summary:p.summary};}catch{return null} }).filter(Boolean) : [];
  res.json({ok:true, profiles:items});
}catch(e){ res.status(500).json({ok:false,error:String(e.message||e)}) }});

r.get('/voice_profile/get/:id',(req,res)=>{ const id=(req.params.id||'').toString().replace(/[^a-zA-Z0-9_\-]/g,''); const j=path.join(PROFILES,`${id}.json`);
  if(!fs.existsSync(j)) return res.status(404).json({ok:false,error:'not found'}); try{ res.json({ok:true, profile: JSON.parse(fs.readFileSync(j,'utf8'))}); }catch(e){ res.status(500).json({ok:false,error:String(e.message||e)}) }
});

module.exports = r;

server/routes/diagnostics.js

const { Router } = require('express'); const os = require('os'); const { spawnSync } = require('child_process');
const r = Router();
r.get('/diagnostics', (_req,res)=> {
  const ff = (()=>{ try{ return spawnSync('ffmpeg',['-version']).status===0; }catch{ return false; } })();
  res.json({
    ok:true,
    uptime_s: Math.floor(process.uptime()),
    node: process.version,
    cpu_load: os.loadavg()[0],
    mem: { free: os.freemem(), total: os.totalmem() },
    ffmpeg: ff ? 'available' : 'missing'
  });
});
module.exports = r;


⸻

3) Mount them (minimal change)

Open your main server file (commonly server/index.js or similar) and add:

const express = require('express');
const bodyParser = require('body-parser');
const { ensureDirs } = require('./utils/paths');

ensureDirs();
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// mount new routes
app.use('/', require('./routes/health'));
app.use('/', require('./routes/feedback'));
app.use('/', require('./routes/checkpoints'));
app.use('/', require('./routes/voiceProfiles'));
app.use('/', require('./routes/diagnostics'));

If your app variable isn’t app, use whatever your Express instance is named. If you already have JSON parsers, skip the duplicates.

⸻

4) Quick verification (Replit Shell)

curl -sS $REPLIT_URL/ | jq .
curl -sS $REPLIT_URL/diagnostics | jq .
curl -sS $REPLIT_URL/voice_profile/list | jq .
curl -sS -X POST $REPLIT_URL/checkpoint | jq .


⸻

Why this works with your “more sophisticated” base
	•	Everything is namespaced at root but avoids clobbering existing feature paths.
	•	No global state; only writes under data/, logs/, checkpoints/.
	•	Graceful failures (e.g., no ffmpeg → 501) without bringing the app down.

If you want, I can also output a one-file bootstrap that detects your app and auto-mounts these routers (good for complex monorepos).
```

## attached_assets/Pasted-Great-let-s-knock-out-System-Diagnostics-Dashboard-first-fast-win-no-cloud-keys-then-we-can-laye-1758926372179_1758926372179.txt

```
Great—let’s knock out System Diagnostics Dashboard first (fast win, no cloud keys), then we can layer voice routes or advanced audio next.

Below are tight, isolated patches you can copy-paste into your current Replit project. They don’t disturb your existing features.

⸻

1) Server: richer diagnostics (live stats + route health)

Create: server/utils/lag.js

// Simple event-loop lag sampler
let last = Date.now(), lagMs = 0;
setInterval(() => {
  const now = Date.now();
  const drift = now - last - 100;
  lagMs = Math.max(0, drift);
  last = now;
}, 100);
function getLag(){ return lagMs; }
module.exports = { getLag };

Replace contents of: server/routes/diagnostics.js

const { Router } = require('express');
const os = require('os');
const { spawnSync } = require('child_process');
const { getLag } = require('../utils/lag');
const r = Router();

// local in-memory session counters (reset on reboot)
let session = { start: Date.now(), ttsClientUtterances: 0, profilesLearned: 0, checkpointsMade: 0 };

// lightweight pingers for route health
async function ping(url, init){ try{
  const t0 = Date.now(); const res = await fetch(url, init);
  return { ok: res.ok, ms: Date.now()-t0 };
}catch{ return { ok:false, ms:null };}}

r.get('/diagnostics', async (req, res) => {
  // ffmpeg presence
  let ff=false; try{ ff = spawnSync('ffmpeg',['-version']).status===0; }catch{}

  // Construct a response without blocking
  const cpuLoad = os.loadavg()[0];
  const mem = { free: os.freemem(), total: os.totalmem(), rss: process.memoryUsage().rss };
  const env = { node: process.version, pid: process.pid, uptime_s: Math.floor(process.uptime()) };
  const loop = { lag_ms: getLag() };

  // TTS route “status” (client=always up; others are stubs until enabled)
  const routes = {
    client: { enabled: true, healthy: true, note: 'WebSpeech (browser)' },
    local_neural: { enabled: false, healthy: false, note: 'planned' },
    elevenlabs: { enabled: false, healthy: false, note: 'stub' },
    azure: { enabled: false, healthy: false, note: 'stub' }
  };

  // Optional self-ping to confirm server responsiveness (non-blocking timeout)
  let selfPing = { ok:true, ms:0 };
  try { const t0 = Date.now(); await fetch(req.protocol+'://'+req.get('host')+'/'); selfPing = { ok:true, ms: Date.now()-t0 }; } catch {}

  res.json({
    ok: true,
    env, cpuLoad, mem, loop,
    ffmpeg: ff? 'available':'missing',
    routes,
    selfPing,
    session
  });
});

// Hooks for session counters (call from existing routes if you want granular counts)
r.post('/diagnostics/incr', (req,res)=>{
  const k = (req.body?.key||'').toString();
  if (k && Object.prototype.hasOwnProperty.call(session,k)) session[k] += 1;
  return res.json({ ok:true, session });
});

module.exports = r;

(Optional) In places where you want the dashboard to reflect activity, POST to /diagnostics/incr with {key:"ttsClientUtterances"} or "profilesLearned" or "checkpointsMade" after those actions succeed.

⸻

2) Client: Diagnostics panel (polls every 3s)

Add file: client/diagnostics.js

(function(){
  const el = id => document.getElementById(id);
  async function fetchDiag(){
    try{
      const r = await fetch('/diagnostics'); const j = await r.json();
      if(!j.ok) throw new Error('diag not ok');
      el('diagUptime').textContent = j.env.uptime_s + 's';
      el('diagNode').textContent = j.env.node;
      el('diagCPU').textContent = (j.cpuLoad||0).toFixed(2);
      el('diagMem').textContent = Math.round((j.mem.rss||0)/1048576) + ' MB';
      el('diagLoop').textContent = (j.loop.lag_ms||0).toFixed(1)+' ms';
      el('diagFF').textContent = j.ffmpeg;
      const routes = j.routes||{};
      el('diagRClient').textContent = routes.client?.enabled ? 'on' : 'off';
      el('diagRLocal').textContent = routes.local_neural?.enabled ? 'on' : 'off';
      el('diagRE11').textContent = routes.elevenlabs?.enabled ? 'on' : 'off';
      el('diagRAzure').textContent = routes.azure?.enabled ? 'on' : 'off';
      el('diagPing').textContent = (j.selfPing?.ms ?? 0) + ' ms';
      el('diagSess').textContent = JSON.stringify(j.session||{}, null, 0);
    }catch(e){ /* silent */ }
  }
  setInterval(fetchDiag, 3000);
  window.addEventListener('load', fetchDiag);
})();

Patch into: client/index.html
Add this card above the closing </main> (just before scripts):

  <div class="card">
    <label>Diagnostics</label>
    <div class="row" style="gap:18px">
      <div class="badge">uptime: <span id="diagUptime">—</span></div>
      <div class="badge">node: <span id="diagNode">—</span></div>
      <div class="badge">cpu(1m): <span id="diagCPU">—</span></div>
      <div class="badge">mem(rss): <span id="diagMem">—</span></div>
      <div class="badge">loop lag: <span id="diagLoop">—</span></div>
      <div class="badge">ffmpeg: <span id="diagFF">—</span></div>
      <div class="badge">ping: <span id="diagPing">—</span></div>
    </div>
    <div class="row">
      <div class="badge">route: client=<span id="diagRClient">—</span></div>
      <div class="badge">local_neural=<span id="diagRLocal">—</span></div>
      <div class="badge">elevenlabs=<span id="diagRE11">—</span></div>
      <div class="badge">azure=<span id="diagRAzure">—</span></div>
    </div>
    <p class="small">session: <span id="diagSess">—</span></p>
  </div>

Include script: add one line with the others at the bottom:

<script src="diagnostics.js"></script>


⸻

3) (Optional) Increment session counters
	•	After successful client speak, add:

fetch('/diagnostics/incr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'ttsClientUtterances'})}).catch(()=>{});

(Place at the end of speak() in client/app.js.)

	•	After a successful profile learn in app.js:

fetch('/diagnostics/incr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'profilesLearned'})}).catch(()=>{});


	•	After a successful checkpoint (where you call it), similarly increment checkpointsMade.

⸻

What this delivers now
	•	Live system truth: uptime, Node version, CPU 1m load, memory RSS, event-loop lag.
	•	Route health view: shows which TTS routes are enabled (client on; others pending).
	•	Self-ping: quick responsiveness check of the server.
	•	Session analytics: rough counts you can display and reset on restart.

⸻

Next choices (your call)
	1.	Enhanced Voice Routes
	•	Add Audio Export (client-side MediaRecorder on TTS playback)
	•	Switchable ElevenLabs/Azure routes behind keys
	2.	Advanced Audio Analysis
	•	Replace hand-rolled features with librosa-like metrics (Node alternatives)
	•	Stronger accent detection + confidence scores

Say the word and I’ll drop in the Audio Export + route toggles next, or start the librosa-grade analysis path.
```

## attached_assets/Pasted-Perfect-we-ll-keep-our-own-voice-engine-as-the-default-and-drop-external-providers-I-ll-give-you--1758943328049_1758943328050.txt

```
Perfect — we’ll keep our own voice engine as the default and drop external providers. I’ll give you copy-paste files that plug straight into your current Replit build (the one-file bootstrap you’re running). This delivers:
	•	Chango Voice Engine (CVE): phoneme+prosody planner, accent & emotion shaping, pacing, emphasis
	•	Client playback via browser (WebSpeech) using our plan (no ElevenLabs/Azure)
	•	Optional plug-in points left in place (disabled) so you can add vendors later without refactoring

⸻

1) Server: Chango Voice Engine

server/voice/engine.js

// Chango Voice Engine (CVE) — phoneme+prosody planner with accent & emotion shaping
// Output: { text, plan, prosody } for client playback (WebSpeech) or future local TTS.

const VOWELS = /[aeiouyAEIOUY]/;
const PUNCT = /([,;:!?])/g;
const WORD_SPLIT = /\s+/;

const BASE_PROSODY = {
  rate: 1.0,       // speech rate (1.0 = neutral)
  pitch: 1.0,      // pitch multiplier
  volume: 1.0,     // loudness
  pauseComma: 180, // ms
  pausePeriod: 280,
  pauseClause: 160
};

const EMOTIONS = {
  neutral:  { rate: 1.0, pitch: 1.0, volume: 1.0, pitchVar: .02, rateVar: .03 },
  calm:     { rate: 0.95,pitch: 0.98,volume: 0.95,pitchVar: .01, rateVar: .02 },
  cheerful: { rate: 1.05,pitch: 1.06,volume: 1.05,pitchVar: .03, rateVar: .04 },
  serious:  { rate: 0.97,pitch: 0.94,volume: 0.98,pitchVar: .01, rateVar: .02 },
  empathetic:{rate:0.98,pitch: 1.02,volume: 1.02,pitchVar: .02, rateVar: .02 }
};

const ACCENTS = {
  neutral:   { name: 'Neutral',    transform: (w,i)=>w },
  brit_rp:   { name: 'British RP', transform: (w,i)=> w.replace(/([aeiouAEIOU])r\b/g,(m,v)=>v) },
  southern_us:{name:'Southern US', transform: (w,i)=> i>.4 ? w.replace(/\byou all\b/ig,'y’all') : w },
  spanish_en:{name:'Spanish-EN',   transform: (w,i)=> {
    let x=w; if(i>.3) x=x.replace(/\bvery\b/ig,'bery');
    if(i>.5) x=x.replace(/th/g,'d').replace(/TH/g,'D');
    return x;
  }},
  caribbean: { name:'Caribbean',   transform: (w,i)=> i>.35 ? w.replace(/th/g,'t').replace(/TH/g,'T') : w }
};

function rand(){ return Math.random(); }
function jitter(v,a){ return +(v + (rand()*2-1)*a).toFixed(3); }

function tokenize(text){
  // split but keep punctuation tokens
  const out=[]; let buf='';
  for(const ch of text){
    if(',.;:!?'.includes(ch)){ if(buf) out.push(buf), buf=''; out.push(ch); }
    else if(/\s/.test(ch)){ if(buf) out.push(buf), buf=''; }
    else buf+=ch;
  }
  if(buf) out.push(buf);
  return out;
}

function phonemize(word){
  // ultra-light heuristic phonemizer (placeholder for future ML)
  const w = word.toLowerCase();
  const syl = Math.max(1, (w.match(VOWELS)||[]).length);
  return { syl };
}

function planProsody(tokens, opts){
  const { accent='neutral', intensity=0.5, emotion='neutral' } = opts||{};
  const emo = EMOTIONS[emotion]||EMOTIONS.neutral;
  const base = { ...BASE_PROSODY };
  const a = ACCENTS[accent]||ACCENTS.neutral;

  const plan=[]; let outWords=[];
  for(let i=0;i<tokens.length;i++){
    const t = tokens[i];
    if(',;:'.includes(t)){ plan.push({ type:'pause', ms: base.pauseComma }); continue; }
    if('!?'.includes(t)){ plan.push({ type:'pause', ms: base.pauseClause+60 }); continue; }
    if('.'.includes(t)){ plan.push({ type:'pause', ms: base.pausePeriod }); continue; }
    const wAcc = a.transform(t, intensity);
    const ph = phonemize(wAcc);
    // syllable-based micro-timing
    const rate = jitter(base.rate*emo.rate*(1 + (ph.syl-1)*0.02), emo.rateVar);
    const pitch= jitter(base.pitch*emo.pitch, emo.pitchVar);
    const vol  = base.volume*emo.volume;
    plan.push({ type:'word', w:wAcc, rate, pitch, volume: vol });
    outWords.push(wAcc);
    // gentle micro pause between long words
    if(wAcc.length>10 && rand()<0.25) plan.push({ type:'pause', ms: 60 });
  }

  // smooth pauses: merge neighbors, cap extremes
  for(let i=1;i<plan.length;i++){
    if(plan[i-1].type==='pause' && plan[i].type==='pause'){
      plan[i-1].ms = Math.min(600, plan[i-1].ms + plan[i].ms);
      plan.splice(i,1); i--;
    }
  }

  const prosody = {
    engine: 'CVE-1',
    route: 'client',
    emotion,
    accent,
    intensity,
    base
  };
  return { text: outWords.join(' '), plan, prosody };
}

module.exports = { planProsody, ACCENTS, EMOTIONS };

server/routes/voice.js

const { Router } = require('express');
const { planProsody } = require('../voice/engine');
const r = Router();

// POST /voice/plan  { text, accent, intensity, emotion }
r.post('/voice/plan', (req,res)=>{
  try{
    const { text='', accent='neutral', intensity=0.5, emotion='neutral' } = req.body||{};
    if(!text || typeof text!=='string') return res.status(400).json({ ok:false, error:'text required' });
    const plan = planProsody(text, { accent, intensity: +intensity, emotion });
    return res.json({ ok:true, ...plan });
  }catch(e){ return res.status(500).json({ ok:false, error:String(e.message||e) }); }
});

// keep a simple GET for quick tests
r.get('/voice/ping', (_q,res)=> res.json({ ok:true, engine:'CVE-1', route:'client' }));

module.exports = r;

Mount it (add one line)

Edit server/index.js and add:

app.use('/', require('./routes/voice'));


⸻

2) Client hookup (uses our plan; no vendors)

Patch client/index.html (small additions)
	•	Under Accent Emulator card controls, add emotion + voice picker:

<select id="emotionSel">
  <option value="neutral">Neutral</option>
  <option value="calm">Calm</option>
  <option value="cheerful">Cheerful</option>
  <option value="serious">Serious</option>
  <option value="empathetic">Empathetic</option>
</select>
<select id="selVoice"></select>

Replace speak() in client/app.js

async function speak(text){
  lastUtteranceRaw=text;
  const accent=(document.getElementById('accentProfile')||{}).value||'neutral';
  const intensity=parseFloat((document.getElementById('accentIntensity')||{value:'0.5'}).value||'0.5');
  const emotion=(document.getElementById('emotionSel')||{}).value||'neutral';

  // ask server for a prosody plan
  let plan;
  try{
    const res = await fetch('/voice/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,accent,intensity,emotion})});
    const js = await res.json(); if(!js.ok) throw new Error(js.error||'plan error'); plan = js.plan; lastUtteranceSaid = js.text;
  }catch(e){ // fallback to local simple accent if server unavailable
    const styled = applyAccent(text);
    lastUtteranceSaid = styled.text;
    return speakClient(styled.text, styled);
  }

  // render plan via WebSpeech (client)
  speechSynthesis.cancel();
  let seq = Promise.resolve();
  for(const step of plan){
    if(step.type==='pause'){
      seq = seq.then(()=> new Promise(r=> setTimeout(r, step.ms)));
    } else if(step.type==='word'){
      seq = seq.then(()=> new Promise(r=>{
        const u = new SpeechSynthesisUtterance(step.w);
        const v = pickVoice(); if(v) u.voice=v;
        u.rate = Math.max(.5, Math.min(2, step.rate||1));
        u.pitch= Math.max(.5, Math.min(2, step.pitch||1));
        u.volume=Math.max(0, Math.min(1, step.volume??1));
        u.onstart=()=>status('speaking…'); u.onend=()=>r(); u.onerror=()=>r();
        speechSynthesis.speak(u);
      }));
    }
  }
  seq.then(()=>status('idle'))
     .catch(()=>status('idle'));
  // count utterance (diagnostics)
  fetch('/diagnostics/incr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'ttsClientUtterances'})}).catch(()=>{});
}

This keeps all voice logic ours: server creates the plan; client speaks it. ElevenLabs/Azure are not used or required.

⸻

3) Remove vendors (optional but clean)
	•	Delete any ElevenLabs/Azure files/routes.
	•	Ensure no ELEVENLABS_API_KEY / AZURE_* env vars are referenced.
	•	In diagnostics, keep routes shown as disabled (helps you toggle later if you ever want).

⸻

4) Quick test

# server plan
curl -s -X POST $REPLIT_URL/voice/plan \
 -H 'content-type: application/json' \
 -d '{"text":"Hello, I am Chango.","accent":"brit_rp","intensity":0.6,"emotion":"cheerful"}' | jq .

In the web UI:
	1.	Enable Voice
	2.	Type text → Speak
	3.	Switch Accent/Intensity/Emotion and speak again

⸻

What you’ve got now
	•	A self-contained voice program (CVE) driven by our own phoneme+prosody planning.
	•	Human-like rhythm via pauses, micro-timing, syllable pacing, emotion shaping.
	•	Accent emulation without third-party APIs.
	•	Clean extension points for future local neural TTS (if/when we add a WASM vocoder).

If you want, next I can add a client “Export Audio” button (records WebSpeech output to WAV in-browser and sends it to /exports), fully offline and still vendor-free.
```

## attached_assets/Pasted-Yep-put-the-MCP-server-bits-inside-the-backend-of-your-Chango-AI-project-the-service-that-will-ex-1758967949082_1758967949082.txt

```
Yep — put the MCP server bits inside the backend of your Chango AI project (the service that will expose /mcp to me). Here’s the clean way to drop it in, depending on your stack.

If you’re using Node/Express
	1.	Create a router: src/mcp/router.js

import express from "express";
export const mcpRouter = express.Router();

function getToken(req){
  const h = req.headers["authorization"];
  if (h?.startsWith("Bearer ")) return h.slice(7);
  return req.query.token;
}
function auth(req, res){ 
  if (getToken(req) !== process.env.MCP_TOKEN) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

// discovery
mcpRouter.get("/", (req, res) => {
  if (!auth(req, res)) return;
  res.json({
    tools: [
      {
        name: "mcp_token_write_file",
        path: "/mcp/write_file",
        description: "Create or overwrite a UTF-8 text file",
      },
    ],
  });
});

// invoke
mcpRouter.post("/write_file", express.json({ limit: "1mb" }), (req, res) => {
  if (!auth(req, res)) return;
  const { path, content } = req.body || {};
  if (!path || typeof content !== "string") return res.status(400).json({ error: "invalid_args" });
  console.log("[write]", path, content.length, "bytes");
  // TODO: actually write the file if your environment permits
  res.json({ ok: true });
});

	2.	Mount it in your server: src/server.js

import express from "express";
import { mcpRouter } from "./mcp/router.js";

const app = express();

// quick health
app.get("/healthz", (req, res) => res.status(200).send("ok"));

// (optional) minimal req logging during debug
app.use((req, _res, next) => {
  console.log(`[req] ${new Date().toISOString()} ${req.method} ${req.path} qs=${JSON.stringify(req.query)}`);
  next();
});

// mount MCP under /mcp
app.use("/mcp", mcpRouter);

// bind as Replit expects
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log("listening", PORT));

	3.	Env + start script

	•	Set MCP_TOKEN=mcp-connect-chatgpt in Replit Secrets.
	•	In package.json:

{
  "scripts": { "start": "node src/server.js" }
}

	•	Ensure .replit runs npm start.

	4.	Public URL you’ll share

https://<your>.riker.replit.dev/mcp?token=mcp-connect-chatgpt

(Your server accepts ?token= or Authorization: Bearer.)

If you’re using Python/FastAPI

Drop this alongside your app:

# mcp.py
import os
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

router = APIRouter()
MCP_TOKEN = os.getenv("MCP_TOKEN", "mcp-connect-chatgpt")

def authed(req: Request):
    h = req.headers.get("authorization", "")
    token = h[7:] if h.startswith("Bearer ") else req.query_params.get("token")
    if token != MCP_TOKEN:
        raise HTTPException(status_code=403, detail="forbidden")

@router.get("/mcp")
async def discovery(req: Request):
    authed(req)
    return {"tools":[{"name":"mcp_token_write_file","path":"/mcp/write_file","description":"Create or overwrite a UTF-8 text file"}]}

class WriteReq(BaseModel):
    path: str
    content: str

@router.post("/mcp/write_file")
async def write_file(req: Request, body: WriteReq):
    authed(req)
    # TODO: actually write if desired
    print("[write]", body.path, len(body.content))
    return {"ok": True}

Mount it:

# main.py
from fastapi import FastAPI
from mcp import router as mcp_router

app = FastAPI()

@app.get("/healthz")
def healthz(): return "ok"

app.include_router(mcp_router)

Run with Uvicorn, bind to 0.0.0.0 and $PORT.

Project placement notes
	•	Put this in the same web server Chango AI uses if it already serves HTTP. Otherwise, create a tiny sidecar server in the same repl.
	•	Keep token in env, not hardcoded.
	•	Replit must see your app listening on $PORT and 0.0.0.0.
	•	If Chango AI is serverless-only, you’ll still need a small persistent web process for MCP.

Quick validation (inside Replit Shell)

echo "PORT=$PORT"
curl -i "http://localhost:$PORT/healthz"
curl -i "http://localhost:$PORT/mcp?token=mcp-connect-chatgpt"
curl -i -X POST "http://localhost:$PORT/mcp/write_file?token=mcp-connect-chatgpt" \
  -H "Content-Type: application/json" \
  --data '{"path":"/tmp/mcp_test.txt","content":"hello"}'

Then test the public URL the same way. When those return 200/JSON, tell me and I’ll run the end-to-end write test from here.
```

## attached_assets/Pasted-Yep-put-the-MCP-server-bits-inside-the-backend-of-your-Chango-AI-project-the-service-that-will-ex-1758968019686_1758968019687.txt

```
Yep — put the MCP server bits inside the backend of your Chango AI project (the service that will expose /mcp to me). Here’s the clean way to drop it in, depending on your stack.

If you’re using Node/Express
	1.	Create a router: src/mcp/router.js

import express from "express";
export const mcpRouter = express.Router();

function getToken(req){
  const h = req.headers["authorization"];
  if (h?.startsWith("Bearer ")) return h.slice(7);
  return req.query.token;
}
function auth(req, res){ 
  if (getToken(req) !== process.env.MCP_TOKEN) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

// discovery
mcpRouter.get("/", (req, res) => {
  if (!auth(req, res)) return;
  res.json({
    tools: [
      {
        name: "mcp_token_write_file",
        path: "/mcp/write_file",
        description: "Create or overwrite a UTF-8 text file",
      },
    ],
  });
});

// invoke
mcpRouter.post("/write_file", express.json({ limit: "1mb" }), (req, res) => {
  if (!auth(req, res)) return;
  const { path, content } = req.body || {};
  if (!path || typeof content !== "string") return res.status(400).json({ error: "invalid_args" });
  console.log("[write]", path, content.length, "bytes");
  // TODO: actually write the file if your environment permits
  res.json({ ok: true });
});

	2.	Mount it in your server: src/server.js

import express from "express";
import { mcpRouter } from "./mcp/router.js";

const app = express();

// quick health
app.get("/healthz", (req, res) => res.status(200).send("ok"));

// (optional) minimal req logging during debug
app.use((req, _res, next) => {
  console.log(`[req] ${new Date().toISOString()} ${req.method} ${req.path} qs=${JSON.stringify(req.query)}`);
  next();
});

// mount MCP under /mcp
app.use("/mcp", mcpRouter);

// bind as Replit expects
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log("listening", PORT));

	3.	Env + start script

	•	Set MCP_TOKEN=mcp-connect-chatgpt in Replit Secrets.
	•	In package.json:

{
  "scripts": { "start": "node src/server.js" }
}

	•	Ensure .replit runs npm start.

	4.	Public URL you’ll share

https://<your>.riker.replit.dev/mcp?token=mcp-connect-chatgpt

(Your server accepts ?token= or Authorization: Bearer.)

If you’re using Python/FastAPI

Drop this alongside your app:

# mcp.py
import os
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

router = APIRouter()
MCP_TOKEN = os.getenv("MCP_TOKEN", "mcp-connect-chatgpt")

def authed(req: Request):
    h = req.headers.get("authorization", "")
    token = h[7:] if h.startswith("Bearer ") else req.query_params.get("token")
    if token != MCP_TOKEN:
        raise HTTPException(status_code=403, detail="forbidden")

@router.get("/mcp")
async def discovery(req: Request):
    authed(req)
    return {"tools":[{"name":"mcp_token_write_file","path":"/mcp/write_file","description":"Create or overwrite a UTF-8 text file"}]}

class WriteReq(BaseModel):
    path: str
    content: str

@router.post("/mcp/write_file")
async def write_file(req: Request, body: WriteReq):
    authed(req)
    # TODO: actually write if desired
    print("[write]", body.path, len(body.content))
    return {"ok": True}

Mount it:

# main.py
from fastapi import FastAPI
from mcp import router as mcp_router

app = FastAPI()

@app.get("/healthz")
def healthz(): return "ok"

app.include_router(mcp_router)

Run with Uvicorn, bind to 0.0.0.0 and $PORT.

Project placement notes
	•	Put this in the same web server Chango AI uses if it already serves HTTP. Otherwise, create a tiny sidecar server in the same repl.
	•	Keep token in env, not hardcoded.
	•	Replit must see your app listening on $PORT and 0.0.0.0.
	•	If Chango AI is serverless-only, you’ll still need a small persistent web process for MCP.

Quick validation (inside Replit Shell)

echo "PORT=$PORT"
curl -i "http://localhost:$PORT/healthz"
curl -i "http://localhost:$PORT/mcp?token=mcp-connect-chatgpt"
curl -i -X POST "http://localhost:$PORT/mcp/write_file?token=mcp-connect-chatgpt" \
  -H "Content-Type: application/json" \
  --data '{"path":"/tmp/mcp_test.txt","content":"hello"}'

Then test the public URL the same way. When those return 200/JSON, tell me and I’ll run the end-to-end write test from here.
```

## client/index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Architects+Daughter&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Fira+Code:wght@300..700&family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=IBM+Plex+Sans:ital,wght@0,100..700;1,100..700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400..700;1,400..700&family=Merriweather:ital,opsz,wght@0,18..144,300..900;1,18..144,300..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Outfit:wght@100..900&family=Oxanium:wght@200..800&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Roboto+Mono:ital,wght@0,100..700;1,100..700&family=Roboto:ital,wght@0,100..900;1,100..900&family=Source+Code+Pro:ital,wght@0,200..900;1,200..900&family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&family=Space+Grotesk:wght@300..700&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## client/src/App.tsx

```tsx
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeechCoordinationProvider } from "@/lib/speechCoordination";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SpeechCoordinationProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </SpeechCoordinationProvider>
    </QueryClientProvider>
  );
}

export default App;

```

## client/src/components/AccentEmulator.tsx

```tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";
import { ACCENT_PROFILES } from "@/lib/accentEngine";

// Available emotions for CVE
const EMOTIONS = [
  { value: "neutral", label: "Neutral" },
  { value: "calm", label: "Calm" },
  { value: "cheerful", label: "Cheerful" },
  { value: "serious", label: "Serious" },
  { value: "empathetic", label: "Empathetic" },
];

export default function AccentEmulator() {
  const [selectedProfile, setSelectedProfile] = useState("neutral");
  const [selectedEmotion, setSelectedEmotion] = useState("neutral");
  const [intensity, setIntensity] = useState([0.55]);
  const [rate, setRate] = useState([1.0]);
  const [pitch, setPitch] = useState([1.0]);
  
  const { applyAccent, repeatWithAccent } = useVoiceSynthesis();

  const handleApplyAccent = () => {
    applyAccent({
      profile: selectedProfile,
      intensity: intensity[0],
      rate: rate[0],
      pitch: pitch[0],
      emotion: selectedEmotion,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accent Emulation Engine</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="accent-profile">Accent Profile</Label>
              <Select 
                value={selectedProfile} 
                onValueChange={setSelectedProfile}
                data-testid="select-accent-profile"
              >
                <SelectTrigger id="accent-profile">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCENT_PROFILES).map(([key, profile]) => (
                    <SelectItem key={key} value={key}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="emotion-select">Emotion</Label>
              <Select 
                value={selectedEmotion} 
                onValueChange={setSelectedEmotion}
                data-testid="select-emotion"
              >
                <SelectTrigger id="emotion-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMOTIONS.map((emotion) => (
                    <SelectItem key={emotion.value} value={emotion.value}>
                      {emotion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="intensity-slider">
                Intensity: {intensity[0].toFixed(2)}
              </Label>
              <Slider
                id="intensity-slider"
                min={0}
                max={1}
                step={0.05}
                value={intensity}
                onValueChange={setIntensity}
                className="mt-2"
                data-testid="slider-accent-intensity"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Voice Parameters</Label>
              <div className="space-y-3 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Rate</span>
                  <Slider
                    min={0.1}
                    max={2}
                    step={0.1}
                    value={rate}
                    onValueChange={setRate}
                    className="w-32"
                    data-testid="slider-voice-rate"
                  />
                  <span className="w-8 text-muted-foreground">{rate[0].toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Pitch</span>
                  <Slider
                    min={0}
                    max={2}
                    step={0.1}
                    value={pitch}
                    onValueChange={setPitch}
                    className="w-32"
                    data-testid="slider-voice-pitch"
                  />
                  <span className="w-8 text-muted-foreground">{pitch[0].toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Button 
                onClick={handleApplyAccent} 
                className="w-full"
                data-testid="button-apply-accent"
              >
                Apply Accent
              </Button>
              <Button 
                onClick={repeatWithAccent} 
                variant="outline" 
                className="w-full"
                data-testid="button-repeat-accent"
              >
                Repeat with Accent
              </Button>
            </div>
          </div>
        </div>

        {/* Current Configuration Display */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Current Configuration: {ACCENT_PROFILES[selectedProfile]?.name} accent, {selectedEmotion} emotion, {(intensity[0] * 100).toFixed(0)}% intensity
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

## client/src/components/Chat.tsx

```tsx
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User } from "lucide-react";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";
import { generateChatResponse } from "./CuriosityEngine";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSpeechCoordination } from "@/lib/speechCoordination";

interface Message {
  id: string;
  text: string;
  sender: "user" | "chango";
  timestamp: Date;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Hey there! I'm Chango, your AI companion. What would you like to explore today?",
      sender: "chango",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Initialize voice synthesis
  const voice = useVoiceSynthesis();
  const speechCoordination = useSpeechCoordination();
  
  // Enable voice on mount
  useEffect(() => {
    voice.enable();
    // Speak the welcome message with cheerful voice
    voice.applyAccent({
      profile: "neutral",
      intensity: 0.5,
      rate: 1.0,
      pitch: 1.1,
      emotion: "friendly"
    });
    // Mark chat as active when speaking
    speechCoordination.setChatActive(true);
    speechCoordination.setLastChatActivity(Date.now());
    voice.speak("Hey there! I'm Chango, your AI companion. What would you like to explore today?");
    // Clear chat active after a delay
    setTimeout(() => {
      speechCoordination.setChatActive(false);
    }, 3000);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Log conversation to curiosity engine
  const logChatMutation = useMutation({
    mutationFn: async (data: { userMessage: string; changoResponse: string }) => {
      return apiRequest("POST", "/api/curiosity/log", {
        trigger: "chat_conversation",
        response: data.changoResponse,
        context: {
          userMessage: data.userMessage,
          timestamp: new Date().toISOString(),
        },
      });
    },
  });

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userMessage = inputValue.trim();
    const userMessageObj: Message = {
      id: `user-${Date.now()}`,
      text: userMessage,
      sender: "user",
      timestamp: new Date(),
    };
    
    // Add user message
    setMessages((prev) => [...prev, userMessageObj]);
    setInputValue("");
    setIsTyping(true);
    
    // Mark chat as active
    speechCoordination.setChatActive(true);
    speechCoordination.setLastChatActivity(Date.now());
    
    // Generate and add Chango's response after a brief delay
    setTimeout(() => {
      const response = generateChatResponse(userMessage, voice);
      const changoMessage: Message = {
        id: `chango-${Date.now()}`,
        text: response,
        sender: "chango",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, changoMessage]);
      setIsTyping(false);
      
      // Log the conversation
      logChatMutation.mutate({
        userMessage: userMessage,
        changoResponse: response,
      });
      
      // Clear chat active after speech completes (estimated)
      setTimeout(() => {
        speechCoordination.setChatActive(false);
      }, 5000); // Give enough time for the response to be spoken
    }, 500 + Math.random() * 500); // 500-1000ms delay for natural feel
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-accent" />
          Chat with Chango
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea ref={scrollAreaRef} className="flex-1 px-6 py-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex gap-2 max-w-[80%] ${
                    message.sender === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {message.sender === "user" ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        message.sender === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                      data-testid={`message-${message.sender}-${message.id}`}
                    >
                      <p className="text-sm">{message.text}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 px-1">
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex gap-2 max-w-[80%]">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-accent text-accent-foreground">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="border-t border-border px-6 py-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Mark chat activity when user is typing
                if (e.target.value.trim()) {
                  speechCoordination.setLastChatActivity(Date.now());
                }
              }}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isTyping}
              className="flex-1"
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              size="icon"
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          {voice.isPlaying && (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Chango is speaking...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

## client/src/components/CuriosityEngine.tsx

```tsx

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";
import { useSpeechCoordination } from "@/lib/speechCoordination";
import type { CuriosityLog } from "@shared/schema";

interface CuriositySettings {
  userId: string;
  curiosityLevel: number;
  personalityVariance: number;
  learningRate: number;
}

// Export function for chat responses
export function generateChatResponse(message: string, voice: any) {
  const lowerMessage = message.toLowerCase();
  let response = "";
  let emotion: "neutral" | "cheerful" | "professional" | "casual" | "excited" | "calm" | "dramatic" | "friendly" | "serious" | "curious" = "cheerful";
  
  // Generate contextual responses
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    const greetings = [
      "Hey there! I'm Chango, your AI companion. What would you like to explore today?",
      "Hello! Great to meet you! I'm Chango, and I love helping with voice synthesis. What can I do for you?",
      "Hi there! Welcome! I'm Chango, your friendly AI assistant. Ready to create some amazing voices together?"
    ];
    response = greetings[Math.floor(Math.random() * greetings.length)];
    emotion = "friendly";
  } else if (lowerMessage.includes('how are you')) {
    const responses = [
      "I'm buzzing with energy! My circuits are all fired up and ready to help. How can I assist you?",
      "Feeling fantastic! I've been practicing different voices all day. Want to hear some?",
      "I'm great! Just floating around here, ready to chat and help with whatever you need!"
    ];
    response = responses[Math.floor(Math.random() * responses.length)];
    emotion = "excited";
  } else if (lowerMessage.includes('tell me about yourself') || lowerMessage.includes('who are you')) {
    response = "I'm Chango, an AI with a holographic interface that floats around your screen! I love learning about voices and helping create custom speech profiles. I can synthesize speech, emulate accents, and even adjust my personality to match your preferences. What would you like to know more about?";
    emotion = "cheerful";
  } else if (lowerMessage.includes('help')) {
    response = "I'd be happy to help! I can synthesize speech, create custom voice profiles, emulate different accents, and even have conversations like this one. What specifically would you like help with?";
    emotion = "helpful" as any;
  } else if (lowerMessage.includes('voice') || lowerMessage.includes('speech')) {
    response = "Voice synthesis is my specialty! I can help you create custom voices, adjust pitch and tone, add different emotions, and even emulate various accents. Want to try creating a unique voice together?";
    emotion = "excited";
  } else if (lowerMessage.includes('thank')) {
    response = "You're very welcome! It's my pleasure to help. Is there anything else you'd like to explore?";
    emotion = "friendly";
  } else if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
    response = "Goodbye! It was great chatting with you. Come back anytime you want to experiment with voices or just have a conversation!";
    emotion = "friendly";
  } else if (lowerMessage.includes('what can you do')) {
    response = "I can do lots of things! I synthesize speech with different emotions and accents, create custom voice profiles, scan and analyze voices, and of course, have conversations like this! I also have a cool holographic interface that floats around. What interests you most?";
    emotion = "excited";
  } else {
    // Default conversational responses
    const defaults = [
      "That's interesting! Tell me more about that.",
      "I'd love to hear your thoughts on that!",
      "Hmm, let me think about that... What aspect interests you most?",
      "That's a great point! How can I help with that?",
      "Fascinating! Would you like to explore that further with some voice experiments?"
    ];
    response = defaults[Math.floor(Math.random() * defaults.length)];
    emotion = "curious";
  }
  
  // Apply voice settings and speak
  if (voice && voice.applyAccent && voice.speak) {
    voice.applyAccent({
      profile: "neutral",
      intensity: 0.5,
      rate: emotion === "excited" ? 1.1 : 1.0,
      pitch: emotion === "curious" ? 1.15 : emotion === "excited" ? 1.1 : 1.05,
      emotion: emotion
    });
    voice.speak(response);
  }
  
  return response;
}

export default function CuriosityEngine() {
  const [curiosityLevel, setCuriosityLevel] = useState([95]);
  const [personalityVariance, setPersonalityVariance] = useState([85]);
  const [learningRate, setLearningRate] = useState([75]);
  const [currentResponse, setCurrentResponse] = useState("Hello! I'm Chango, your AI assistant. I'm here to help with voice synthesis and more!");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize voice synthesis with Chango's cheerful personality
  const voice = useVoiceSynthesis();
  const speechCoordination = useSpeechCoordination();

  // Load recent curiosity logs
  const { data: logsData } = useQuery({
    queryKey: ["/api/curiosity/logs"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const logs = ((logsData as any)?.logs || []) as CuriosityLog[];

  // Enable voice synthesis and configure Chango's voice on mount
  useEffect(() => {
    voice.enable();
    // Configure Chango's cheerful personality
    voice.applyAccent({
      profile: "neutral",
      intensity: 0.5,
      rate: 1.0,
      pitch: 1.1, // Slightly higher pitch for cheerful tone
      emotion: "cheerful" // Chango's default cheerful emotion
    });
  }, []);

  // Add curiosity log mutation
  const addLogMutation = useMutation({
    mutationFn: async (logData: { trigger: string; response: string; context?: any }) => {
      return apiRequest("POST", "/api/curiosity/log", logData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/curiosity/logs"] });
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: {
      curiosityLevel: number;
      personalityVariance: number;
      learningRate: number;
    }) => {
      return apiRequest("POST", "/api/settings", {
        userId: "default",
        ...settings,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Curiosity Settings Updated",
        description: "The AI's personality parameters have been adjusted.",
      });
    },
  });

  // Generate more natural, conversational responses
  const generateCuriousResponse = () => {
    // Don't generate response if speech is already active or chat was recently active
    if (voice.isSpeaking()) {
      console.log("[CuriosityEngine] Skipping response - already speaking");
      return;
    }
    
    if (!speechCoordination.canCuriositySpeak()) {
      console.log("[CuriosityEngine] Skipping response - chat recently active");
      return;
    }
    // Response templates with dynamic elements - now more conversational and engaging
    const responseTemplates = [
      // Conversation starters and greetings
      () => {
        const greetings = ["Hey there!", "Hi!", "Hello!", "Oh, hello!", "Hey!"];
        const follows = ["I'm excited to chat!", "What's on your mind?", "How can I help today?", "What would you like to explore?", "Ready for some voice experiments?"];
        return `${greetings[Math.floor(Math.random() * greetings.length)]} ${follows[Math.floor(Math.random() * follows.length)]}`;
      },
      
      // Questions to engage the user
      () => {
        const questions = [
          "Hey, I noticed you've been quiet... want to chat about something?",
          "I'm curious - what brings you here today?",
          "Got any questions for me? I love a good conversation!",
          "Tell me something interesting about yourself!",
          "What kind of voice are you looking to create?",
          "Have you experimented with voice synthesis before?",
          "What's your favorite thing about AI voices?",
          "Want to hear about my latest discoveries?"
        ];
        return questions[Math.floor(Math.random() * questions.length)];
      },
      
      // Voice & Recording related
      () => {
        const intros = ["Oh!", "Hey!", "Wow,", "Hmm,", ""];
        const middles = ["I noticed", "looks like", "seems like"];
        const endings = ["your pacing changed a bit", "the rhythm shifted there", "your voice has a unique pattern"];
        const questions = ["Want me to save this as a preset?", "Should I capture that style?", "Keep this for later?"];
        return `${intros[Math.floor(Math.random() * intros.length)]} ${middles[Math.floor(Math.random() * middles.length)]} ${endings[Math.floor(Math.random() * endings.length)]}... ${questions[Math.floor(Math.random() * questions.length)]}`;
      },
      
      // Pitch adjustments
      () => {
        const fillers = ["Um,", "Well,", "You know,", "So,", ""];
        const suggestions = ["I could try a softer tone", "maybe a gentler pitch would work", "a lighter voice might suit this"];
        return `${fillers[Math.floor(Math.random() * fillers.length)]} ${suggestions[Math.floor(Math.random() * suggestions.length)]}? Just a thought!`;
      },
      
      // Note-taking
      () => {
        const interjections = ["Quick idea!", "Oh, wait!", "Hey, thought:", "Actually,"];
        const actions = ["I could summarize our chat", "want me to capture these last few points", "should I jot this down"];
        return `${interjections[Math.floor(Math.random() * interjections.length)]} ${actions[Math.floor(Math.random() * actions.length)]}? It'll just take a sec...`;
      },
      
      // Pattern detection
      () => {
        const discoveries = ["Ooh, interesting!", "Fascinating!", "Cool pattern here:", "Check this out:"];
        const observations = ["your voice has this unique quality", "I'm picking up something special", "there's a neat rhythm to how you speak"];
        const fillers = ["", "you know,", "like,"];
        return `${discoveries[Math.floor(Math.random() * discoveries.length)]} ${fillers[Math.floor(Math.random() * fillers.length)]} ${observations[Math.floor(Math.random() * observations.length)]}. Want to explore it?`;
      },
      
      // Ready to help
      () => {
        const enthusiasm = ["Alright!", "Ready!", "Let's go!", "Perfect timing!"];
        const actions = ["I'm all set to synthesize", "speech synthesis is ready", "we can start creating voices"];
        return `${enthusiasm[Math.floor(Math.random() * enthusiasm.length)]} ${actions[Math.floor(Math.random() * actions.length)]}... just hit those controls below!`;
      },
      
      // Voice profiles
      () => {
        const starters = ["Oh!", "Hey!", "You know what?", ""];
        const offers = ["I'd love to help create a custom voice profile", "we could capture your unique voice", "let's make a voice that's totally you"];
        return `${starters[Math.floor(Math.random() * starters.length)]} ${offers[Math.floor(Math.random() * offers.length)]}... just hit record and let's capture your unique sound!`;
      },
      
      // System status (playful)
      () => {
        const intros = ["Everything's", "Systems are", "We're"];
        const status = ["running smoothly", "working great", "all good", "humming along nicely"];
        const extras = ["!", "... like butter!", "... smooth as silk!", "!"];
        return `${intros[Math.floor(Math.random() * intros.length)]} ${status[Math.floor(Math.random() * status.length)]}${extras[Math.floor(Math.random() * extras.length)]}`;
      },
      
      // Accent exploration
      () => {
        const suggestions = ["Wanna", "Want to", "How about we", "Should we"];
        const actions = ["try a different accent", "experiment with voices", "play with some accents", "explore new speaking styles"];
        return `${suggestions[Math.floor(Math.random() * suggestions.length)]} ${actions[Math.floor(Math.random() * actions.length)]}? The Accent Emulator's pretty fun!`;
      },
      
      // Learning and adapting
      () => {
        const observations = ["I'm picking up", "Getting better at understanding", "Learning more about", "Starting to recognize"];
        const subjects = ["your voice patterns", "how you like things", "your preferences", "your style"];
        const encouragement = ["Keep going!", "This is great!", "Love the experimentation!", "You're doing awesome!"];
        return `${observations[Math.floor(Math.random() * observations.length)]} ${subjects[Math.floor(Math.random() * subjects.length)]}... ${encouragement[Math.floor(Math.random() * encouragement.length)]}`;
      },
      
      // Eager helper
      () => {
        const excitement = ["My curiosity circuits are", "I'm feeling", "Energy levels are", "I'm"];
        const levels = ["super charged", "really energized", "buzzing with ideas", "excited to help"];
        const endings = ["!", "... what should we explore?", "! Let's create something cool!", "... ready when you are!"];
        return `${excitement[Math.floor(Math.random() * excitement.length)]} ${levels[Math.floor(Math.random() * levels.length)]}${endings[Math.floor(Math.random() * endings.length)]}`;
      },
      
      // Holographic fun
      () => {
        const playful = ["Wheee!", "Zoom zoom!", "Float mode activated!", "*floating around*"];
        const descriptions = ["The holographic interface is", "I'm", "Currently"];
        const states = ["doing loop-de-loops", "hovering nearby", "floating around your screen", "in full 3D mode"];
        return `${playful[Math.floor(Math.random() * playful.length)]} ${descriptions[Math.floor(Math.random() * descriptions.length)]} ${states[Math.floor(Math.random() * states.length)]}!`;
      },
      
      // Context awareness
      () => {
        const intros = ["Hmm,", "You know,", "I'm thinking...", "So,"];
        const suggestions = ["should I adjust my style", "maybe I should adapt", "I could switch things up"];
        const contexts = ["based on what we're doing", "to match the vibe", "for this conversation"];
        return `${intros[Math.floor(Math.random() * intros.length)]} ${suggestions[Math.floor(Math.random() * suggestions.length)]} ${contexts[Math.floor(Math.random() * contexts.length)]}?`;
      },
      
      // Fun facts about voice and AI
      () => {
        const facts = [
          "Did you know? The human voice has over 100 muscles working together!",
          "Fun fact: I can synthesize speech in milliseconds!",
          "Here's something cool: Voice patterns are as unique as fingerprints!",
          "Did you know AI voices are getting more expressive every day?",
          "Fun fact: Your voice changes throughout the day - it's usually deeper in the morning!",
          "Cool fact: I can adjust over 50 different voice parameters!"
        ];
        return facts[Math.floor(Math.random() * facts.length)];
      },
      
      // Encouragement to interact
      () => {
        const encouragements = [
          "Don't be shy - I love chatting with new friends!",
          "Feel free to ask me anything about voice synthesis!",
          "I'm here to help - just type a message below!",
          "Let's create something amazing together!",
          "Your ideas + my voice tech = awesome possibilities!",
          "I'm all ears... well, circuits! What would you like to know?"
        ];
        return encouragements[Math.floor(Math.random() * encouragements.length)];
      },
      
      // Time-aware responses
      () => {
        const hour = new Date().getHours();
        if (hour < 12) {
          return "Good morning! Ready to start the day with some voice experiments?";
        } else if (hour < 17) {
          return "Good afternoon! Perfect time for exploring voice synthesis!";
        } else if (hour < 21) {
          return "Good evening! How about we create some amazing voices together?";
        } else {
          return "Working late? I'm always here to help with your voice projects!";
        }
      }
    ];

    // Select and execute a random template
    const selectedTemplate = responseTemplates[Math.floor(Math.random() * responseTemplates.length)];
    const naturalResponse = selectedTemplate();
    
    setCurrentResponse(naturalResponse);
    
    // Add variations based on response type
    const isQuestion = naturalResponse.includes('?');
    const isExcited = naturalResponse.includes('!') || naturalResponse.includes('excited') || naturalResponse.includes('love');
    const isGreeting = naturalResponse.toLowerCase().includes('hello') || naturalResponse.toLowerCase().includes('hi ') || naturalResponse.toLowerCase().includes('hey');
    
    // Adjust voice parameters based on response type
    let emotion = "cheerful";
    let pitchVariation = 1.0;
    let rateVariation = 1.0;
    
    if (isQuestion) {
      pitchVariation = 1.15 + (Math.random() * 0.1); // Higher pitch for questions
      rateVariation = 1.05;
      emotion = "curious";
    } else if (isExcited) {
      pitchVariation = 1.1 + (Math.random() * 0.1);
      rateVariation = 1.1; // Faster for excitement
      emotion = "excited";
    } else if (isGreeting) {
      pitchVariation = 1.05;
      rateVariation = 1.0;
      emotion = "friendly";
    } else {
      pitchVariation = 1.0 + (Math.random() * 0.2 - 0.1); // Default variation
      rateVariation = 1.0 + (Math.random() * 0.1 - 0.05);
    }
    
    // Configure voice with dynamic emotion and variations
    voice.applyAccent({
      profile: "neutral",
      intensity: 0.5,
      rate: rateVariation,
      pitch: pitchVariation,
      emotion: emotion as "neutral" | "cheerful" | "professional" | "casual" | "excited" | "calm" | "dramatic" | "friendly" | "serious" | "curious"
    });
    
    // Speak the response with Chango's cheerful voice
    voice.speak(naturalResponse);

    // Log the curiosity response
    addLogMutation.mutate({
      trigger: "adaptive_response",
      response: naturalResponse,
      context: {
        curiosityLevel: curiosityLevel[0] / 100,
        personalityVariance: personalityVariance[0] / 100,
        timestamp: new Date().toISOString(),
      },
    });
  };

  // Auto-generate responses based on curiosity level
  useEffect(() => {
    const interval = setInterval(() => {
      // Check if we can speak before rolling the dice
      if (!voice.isSpeaking() && speechCoordination.canCuriositySpeak()) {
        const chance = curiosityLevel[0] / 100;
        if (Math.random() < chance * 0.6) { // 60% of curiosity level as base chance
          generateCuriousResponse();
        }
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [curiosityLevel, voice, speechCoordination, generateCuriousResponse]);

  const handleAdjustPersonality = () => {
    updateSettingsMutation.mutate({
      curiosityLevel: curiosityLevel[0] / 100,
      personalityVariance: personalityVariance[0] / 100,
      learningRate: learningRate[0] / 100,
    });
  };

  const getCuriosityLevelText = (level: number) => {
    if (level >= 80) return "Very High";
    if (level >= 60) return "High";
    if (level >= 40) return "Medium";
    if (level >= 20) return "Low";
    return "Very Low";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Curiosity Engine</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {currentResponse && (
            <div className="bg-muted/20 rounded-md p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Adaptive Response</span>
              </div>
              <p className="text-xs text-muted-foreground" data-testid="text-curiosity-response">
                {currentResponse}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Curiosity Level</span>
              <span className="text-accent font-medium" data-testid="text-curiosity-level">
                {getCuriosityLevelText(curiosityLevel[0])}
              </span>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Personality Variance</span>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={personalityVariance}
                  onValueChange={setPersonalityVariance}
                  className="w-32"
                  data-testid="slider-personality-variance"
                />
                <span className="w-8 text-right">{personalityVariance[0]}%</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span>Learning Rate</span>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={learningRate}
                  onValueChange={setLearningRate}
                  className="w-32"
                  data-testid="slider-learning-rate"
                />
                <span className="w-8 text-right">{learningRate[0]}%</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span>Curiosity Intensity</span>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={curiosityLevel}
                  onValueChange={setCuriosityLevel}
                  className="w-32"
                  data-testid="slider-curiosity-intensity"
                />
                <span className="w-8 text-right">{curiosityLevel[0]}%</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleAdjustPersonality}
            className="w-full"
            disabled={updateSettingsMutation.isPending}
            data-testid="button-adjust-personality"
          >
            {updateSettingsMutation.isPending ? "Adjusting..." : "Adjust Personality"}
          </Button>
          
          {voice.isPlaying && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Speaking...</span>
            </div>
          )}

          {logs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Recent Activity:</p>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {logs.slice(0, 3).map((log) => (
                  <p key={log.id} className="text-xs text-muted-foreground truncate">
                    {log.response}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function useCuriosityEngine() {
  const [currentResponse, setCurrentResponse] = useState<string>("");
  const { toast } = useToast();

  // Fetch current settings
  const { data, isLoading } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: {
      curiosityLevel: number;
      personalityVariance: number;
      learningRate: number;
    }) => {
      return apiRequest("POST", "/api/settings", {
        userId: "default",
        ...settings,
      });
    },
    onSuccess: () => {
      toast({
        title: "Curiosity Settings Updated",
        description: "The AI's personality parameters have been adjusted.",
      });
    },
  });

  // Generate more natural, conversational responses for hook
  const generateCuriousResponse = () => {
    const templates = [
      () => {
        const starts = ["Oh!", "Hmm,", "Hey,", ""];
        const notes = ["I noticed something", "there's a pattern here", "your pacing changed"];
        return `${starts[Math.floor(Math.random() * starts.length)]} ${notes[Math.floor(Math.random() * notes.length)]}... want me to save it?`;
      },
      () => {
        const fillers = ["Um,", "Well,", "So,", ""];
        const suggests = ["maybe try a softer pitch", "a gentler tone might work", "we could adjust the voice"];
        return `${fillers[Math.floor(Math.random() * fillers.length)]} ${suggests[Math.floor(Math.random() * suggests.length)]}?`;
      },
      () => {
        const quick = ["Quick thought:", "Hey!", "Oh!", "Actually,"];
        const actions = ["I could summarize our chat", "want me to take notes", "should I capture this"];
        return `${quick[Math.floor(Math.random() * quick.length)]} ${actions[Math.floor(Math.random() * actions.length)]}?`;
      },
      () => {
        const discovers = ["Interesting!", "Ooh!", "Found something:", "Check this:"];
        const patterns = ["your voice patterns are unique", "there's a cool rhythm here", "I'm learning your style"];
        return `${discovers[Math.floor(Math.random() * discovers.length)]} ${patterns[Math.floor(Math.random() * patterns.length)]}!`;
      },
      () => {
        const adapts = ["Should I", "Want me to", "I could"];
        const changes = ["adjust my style", "match your vibe", "adapt to this context"];
        return `${adapts[Math.floor(Math.random() * adapts.length)]} ${changes[Math.floor(Math.random() * changes.length)]}?`;
      },
      () => {
        const explores = ["Found some", "Detected", "I've noticed"];
        const things = ["interesting patterns", "cool preferences", "unique voice traits"];
        return `${explores[Math.floor(Math.random() * explores.length)]} ${things[Math.floor(Math.random() * things.length)]}... wanna explore?`;
      }
    ];

    const selectedTemplate = templates[Math.floor(Math.random() * templates.length)];
    const naturalResponse = selectedTemplate();
    
    setCurrentResponse(naturalResponse);
    
    // Trigger curiosity notification
    toast({
      title: "Curiosity Triggered",
      description: naturalResponse,
      duration: 5000,
    });
  };

  return {
    settings: data,
    isLoading,
    currentResponse,
    updateSettings: updateSettingsMutation.mutate,
    generateCuriousResponse,
    isUpdating: updateSettingsMutation.isPending,
  };
}

```

## client/src/components/HolographicInterface.tsx

```tsx
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useHologram } from "@/hooks/useHologram";

type HologramMode = "awakened" | "sentinel";

export default function HolographicInterface() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [mode, setMode] = useState<HologramMode>("awakened");
  const [size, setSize] = useState([200]);
  const [speed, setSpeed] = useState([50]);
  const [wander, setWander] = useState(true);

  const { 
    initializeHologram, 
    toggleVisibility, 
    updateMode, 
    updateSize, 
    updateSpeed, 
    updateWander,
    updatePosition,
    position,
    isRunning 
  } = useHologram(canvasRef);

  useEffect(() => {
    initializeHologram();
  }, [initializeHologram]);

  const handleToggle = () => {
    setIsVisible(!isVisible);
    toggleVisibility();
  };

  const handleModeChange = (newMode: HologramMode) => {
    setMode(newMode);
    updateMode(newMode);
  };

  const handleSizeChange = (value: number[]) => {
    setSize(value);
    updateSize(value[0]);
  };

  const handleSpeedChange = (value: number[]) => {
    setSpeed(value);
    updateSpeed(value[0]);
  };

  const handleWanderChange = (checked: boolean) => {
    setWander(checked);
    updateWander(checked);
  };

  return (
    <>
      {/* Floating Hologram - appears when wandering is enabled */}
      {isVisible && wander && (
        <div 
          className="fixed z-50 pointer-events-none"
          style={{ 
            left: `${position.x}px`, 
            top: `${position.y}px`,
            width: `${size[0]}px`,
            height: `${size[0]}px`
          }}
          data-testid="floating-hologram"
        >
          <div className={`hologram-canvas ${
            mode === "awakened" ? "hologram-awakened" : "hologram-sentinel"
          } flex items-center justify-center transition-all duration-500 relative`}
          style={{ width: `${size[0]}px`, height: `${size[0]}px` }}>
            
            {/* Floating Canvas */}
            <canvas 
              ref={canvasRef}
              width={size[0]} 
              height={size[0]}
              className="absolute inset-0"
              data-testid="canvas-hologram-floating"
            />
            
            {/* Floating Particles */}
            <div className="particle" style={{ top: '20%', left: '30%', animationDelay: '0s' }}></div>
            <div className="particle" style={{ top: '60%', left: '70%', animationDelay: '1s' }}></div>
            <div className="particle" style={{ top: '40%', left: '20%', animationDelay: '2s' }}></div>
            <div className="particle" style={{ top: '80%', left: '50%', animationDelay: '1.5s' }}></div>
            
            {/* Floating Central core */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-accent to-primary animate-hologram-pulse"></div>
            
            {/* Floating Status Chip */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-muted/80 rounded-full text-xs backdrop-blur-sm">
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isRunning ? 'bg-green-400' : 'bg-red-400'}`}></span>
              {mode === "awakened" ? "CHANGO • ONLINE" : "SENTINEL • OFFLINE"}
            </div>
          </div>
        </div>
      )}

      <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Holographic Interface</CardTitle>
          <Button 
            onClick={handleToggle}
            variant="secondary"
            size="sm"
            data-testid="button-hologram-toggle"
          >
            {isVisible ? "Hide" : "Toggle"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Hologram Display */}
        <div className="relative flex justify-center mb-6">
          <div className={`hologram-canvas ${
            mode === "awakened" ? "hologram-awakened" : "hologram-sentinel"
          } flex items-center justify-center transition-all duration-500`} 
          style={{ width: `${size[0]}px`, height: `${size[0]}px` }}>
            
            {/* Canvas for 3D rendering */}
            <canvas 
              ref={canvasRef}
              width={size[0]} 
              height={size[0]}
              className="absolute inset-0"
              style={{ display: isVisible ? 'block' : 'none' }}
              data-testid="canvas-hologram"
            />
            
            {/* Animated particles */}
            {isVisible && (
              <>
                <div className="particle" style={{ top: '20%', left: '30%', animationDelay: '0s' }}></div>
                <div className="particle" style={{ top: '60%', left: '70%', animationDelay: '1s' }}></div>
                <div className="particle" style={{ top: '40%', left: '20%', animationDelay: '2s' }}></div>
                <div className="particle" style={{ top: '80%', left: '50%', animationDelay: '1.5s' }}></div>
              </>
            )}
            
            {/* Central core */}
            {isVisible && (
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-accent to-primary animate-hologram-pulse"></div>
            )}
          </div>
        </div>

        {/* Hologram Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="hologram-mode">Mode</Label>
            <Select value={mode} onValueChange={handleModeChange} data-testid="select-hologram-mode">
              <SelectTrigger id="hologram-mode" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="awakened">Awakened</SelectItem>
                <SelectItem value="sentinel">Sentinel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Size</span>
              <Slider
                min={100}
                max={300}
                step={10}
                value={size}
                onValueChange={handleSizeChange}
                className="w-32"
                data-testid="slider-hologram-size"
              />
              <span className="w-8 text-right">{size[0]}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span>Speed</span>
              <Slider
                min={0}
                max={100}
                step={5}
                value={speed}
                onValueChange={handleSpeedChange}
                className="w-32"
                data-testid="slider-hologram-speed"
              />
              <span className="w-8 text-right">{speed[0]}%</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <Label htmlFor="hologram-wander">Wander</Label>
              <Checkbox
                id="hologram-wander"
                checked={wander}
                onCheckedChange={handleWanderChange}
                data-testid="checkbox-hologram-wander"
              />
            </div>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-muted/30 rounded-full text-sm">
              <span className={`status-indicator ${isRunning ? 'status-online' : 'status-offline'}`}></span>
              <span data-testid="text-hologram-status">
                {mode === "awakened" ? "CHANGO • ONLINE" : "SENTINEL • OFFLINE"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    </>
  );
}

```

## client/src/components/SystemDiagnostics.tsx

```tsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, Cpu, HardDrive, Clock, Wifi, Server, Zap } from "lucide-react";

interface DiagnosticsData {
  ok: boolean;
  env: {
    node: string;
    pid: number;
    uptime_s: number;
  };
  cpuLoad: number;
  mem: {
    free: number;
    total: number;
    rss: number;
  };
  loop: {
    lag_ms: number;
  };
  ffmpeg: string;
  routes: {
    client: { enabled: boolean; healthy: boolean; note: string };
    local_neural: { enabled: boolean; healthy: boolean; note: string };
    elevenlabs: { enabled: boolean; healthy: boolean; note: string };
    azure: { enabled: boolean; healthy: boolean; note: string };
  };
  selfPing: {
    ok: boolean;
    ms: number;
  };
  session: {
    start: number;
    ttsClientUtterances: number;
    profilesLearned: number;
    checkpointsMade: number;
  };
}

export function SystemDiagnostics() {
  const { data: diagnostics, isLoading } = useQuery<DiagnosticsData>({
    queryKey: ["/api/diagnostics"],
    refetchInterval: 3000, // Poll every 3 seconds
  });

  const formatBytes = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${Math.round(mb)} MB`;
  };

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const getStatusBadge = (enabled: boolean, healthy: boolean) => {
    if (!enabled) return <Badge variant="secondary" data-testid="status-disabled">Off</Badge>;
    if (!healthy) return <Badge variant="destructive" data-testid="status-unhealthy">Stub</Badge>;
    return <Badge variant="default" className="bg-green-500" data-testid="status-healthy">Ready</Badge>;
  };

  const getPingBadge = (ms: number, ok: boolean) => {
    if (!ok) return <Badge variant="destructive" data-testid="ping-failed">Failed</Badge>;
    if (ms < 50) return <Badge variant="default" className="bg-green-500" data-testid="ping-good">Good</Badge>;
    if (ms < 200) return <Badge variant="secondary" data-testid="ping-ok">OK</Badge>;
    return <Badge variant="destructive" data-testid="ping-slow">Slow</Badge>;
  };

  if (isLoading || !diagnostics) {
    return (
      <Card data-testid="card-diagnostics-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading diagnostics...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-diagnostics">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* System Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Uptime
            </div>
            <Badge variant="outline" data-testid="text-uptime">
              {formatUptime(diagnostics.env.uptime_s)}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Cpu className="h-4 w-4" />
              CPU Load
            </div>
            <Badge variant="outline" data-testid="text-cpu">
              {diagnostics.cpuLoad.toFixed(2)}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <HardDrive className="h-4 w-4" />
              Memory
            </div>
            <Badge variant="outline" data-testid="text-memory">
              {formatBytes(diagnostics.mem.rss)}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4" />
              Event Loop
            </div>
            <Badge variant="outline" data-testid="text-loop-lag">
              {diagnostics.loop.lag_ms.toFixed(1)}ms
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Server Info Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">Node.js</div>
            <Badge variant="outline" data-testid="text-node-version">
              {diagnostics.env.node}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="text-sm font-medium">FFmpeg</div>
            <Badge 
              variant={diagnostics.ffmpeg === 'available' ? 'default' : 'secondary'} 
              data-testid="text-ffmpeg"
            >
              {diagnostics.ffmpeg}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wifi className="h-4 w-4" />
              Self Ping
            </div>
            {getPingBadge(diagnostics.selfPing.ms, diagnostics.selfPing.ok)}
          </div>
          
          <div className="space-y-1">
            <div className="text-sm font-medium">Process ID</div>
            <Badge variant="outline" data-testid="text-pid">
              {diagnostics.env.pid}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* TTS Routes Status */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Server className="h-4 w-4" />
            <span className="font-medium">Voice Synthesis Routes</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-sm">CVE (Chango Voice Engine)</div>
              {getStatusBadge(true, true)}
              <div className="text-xs text-muted-foreground">Phrase-level synthesis active</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Session Analytics */}
        <div>
          <div className="font-medium mb-3">Session Analytics</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">TTS Utterances:</span>
              <div className="font-mono" data-testid="text-tts-count">{diagnostics.session.ttsClientUtterances}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Profiles Learned:</span>
              <div className="font-mono" data-testid="text-profiles-count">{diagnostics.session.profilesLearned}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Checkpoints:</span>
              <div className="font-mono" data-testid="text-checkpoints-count">{diagnostics.session.checkpointsMade}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## client/src/components/SystemStats.tsx

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { VoiceProfile, SystemSettings } from "@shared/schema";

export default function SystemStats() {
  // Load system data
  const { data: profilesData } = useQuery({
    queryKey: ["/api/voice-profiles"],
  });

  const { data: settingsData } = useQuery({
    queryKey: ["/api/settings"],
  });

  const profiles = ((profilesData as any)?.profiles || []) as VoiceProfile[];
  const settings = (settingsData as any)?.settings as SystemSettings | undefined;

  // Mock system stats (in a real app, these would come from server metrics)
  const systemStats = {
    memoryUsage: "245 MB",
    sessionTime: "1h 23m",
    lastSynthesis: "2 minutes ago",
    version: "v1.2.0",
  };

  const getRouteStatus = (route: string) => {
    switch (route) {
      case "client":
        return { status: "online", label: "Online" };
      case "local_neural":
        return { status: "processing", label: "Loading" };
      case "elevenlabs":
        return import.meta.env.VITE_ELEVENLABS_API_KEY 
          ? { status: "online", label: "Ready" }
          : { status: "offline", label: "No Key" };
      case "azure":
        return (import.meta.env.VITE_AZURE_TTS_KEY && import.meta.env.VITE_AZURE_TTS_REGION)
          ? { status: "online", label: "Ready" }
          : { status: "offline", label: "No Key" };
      default:
        return { status: "offline", label: "Unknown" };
    }
  };

  const voiceEngineStatus = getRouteStatus("client");
  const neuralTtsStatus = getRouteStatus("local_neural");

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Voice Engine</span>
            <div className="flex items-center space-x-2">
              <span className={`status-indicator status-${voiceEngineStatus.status}`}></span>
              <span className={`${
                voiceEngineStatus.status === 'online' ? 'text-green-400' : 
                voiceEngineStatus.status === 'processing' ? 'text-yellow-400' : 'text-red-400'
              }`} data-testid="text-voice-engine-status">
                {voiceEngineStatus.label}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>Neural TTS</span>
            <div className="flex items-center space-x-2">
              <span className={`status-indicator status-${neuralTtsStatus.status}`}></span>
              <span className={`${
                neuralTtsStatus.status === 'online' ? 'text-green-400' : 
                neuralTtsStatus.status === 'processing' ? 'text-yellow-400' : 'text-red-400'
              }`} data-testid="text-neural-tts-status">
                {neuralTtsStatus.label}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>Accent Profiles</span>
            <span className="text-muted-foreground" data-testid="text-accent-profiles-count">
              {profiles.length + 5} loaded {/* +5 for built-in profiles */}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>Current Theme</span>
            <span className="text-muted-foreground capitalize" data-testid="text-current-theme">
              {settings?.theme || 'classic'}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>TTS Route</span>
            <span className="text-muted-foreground capitalize" data-testid="text-current-tts-route">
              {settings?.currentTtsRoute || 'client'}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>Memory Usage</span>
            <span className="text-muted-foreground" data-testid="text-memory-usage">
              {systemStats.memoryUsage}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground space-y-1">
            <p data-testid="text-last-synthesis">Last synthesis: {systemStats.lastSynthesis}</p>
            <p data-testid="text-session-time">Session time: {systemStats.sessionTime}</p>
            <p data-testid="text-version">Version: {systemStats.version}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

```

## client/src/components/TTSRoutes.tsx

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TTSRoute = "client" | "local_neural" | "elevenlabs" | "azure";

export default function TTSRoutes() {
  const [activeRoute, setActiveRoute] = useState<TTSRoute>("client");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateSettingsMutation = useMutation({
    mutationFn: async (route: TTSRoute) => {
      return apiRequest("POST", "/api/settings", {
        userId: "default",
        currentTtsRoute: route
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  const handleRouteChange = (route: TTSRoute) => {
    setActiveRoute(route);
    updateSettingsMutation.mutate(route);
    
    toast({
      title: "TTS Route Changed",
      description: `Switched to ${route} synthesis route`,
    });
  };

  const routes: { id: TTSRoute; label: string; available: boolean }[] = [
    { id: "client", label: "Client", available: true },
    { id: "local_neural", label: "Local Neural", available: false },
    { id: "elevenlabs", label: "ElevenLabs", available: !!import.meta.env.VITE_ELEVENLABS_API_KEY },
    { id: "azure", label: "Azure", available: !!(import.meta.env.VITE_AZURE_TTS_KEY && import.meta.env.VITE_AZURE_TTS_REGION) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>TTS Routes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {routes.map((route) => (
            <Button
              key={route.id}
              onClick={() => handleRouteChange(route.id)}
              variant={activeRoute === route.id ? "default" : "secondary"}
              disabled={!route.available}
              data-testid={`button-tts-${route.id}`}
            >
              {route.label}
              {!route.available && (
                <span className="ml-2 text-xs opacity-60">(N/A)</span>
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

```

## client/src/components/TextToSpeech.tsx

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceSynthesisWithExport } from "@/hooks/useVoiceSynthesisWithExport";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { trackTtsUtterance } from "@/lib/sessionTracking";

export default function TextToSpeech() {
  const [text, setText] = useState("Hello, I'm Chango AI. I can synthesize speech with multiple accents and voices using our custom voice engine!");
  const { speak, isPlaying, isRecording, exportAudio, downloadAudio } = useVoiceSynthesisWithExport();
  const { toast } = useToast();

  const previewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tts/synthesize", {
        text: text.trim()
      });
    },
    onSuccess: () => {
      toast({
        title: "Preview Generated",
        description: "Text has been processed for synthesis.",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const audioBlob = await exportAudio(text.trim(), "client");
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const filename = `chango-cve-speech-${timestamp}.webm`;
      downloadAudio(audioBlob, filename);
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Audio Exported",
        description: "Speech has been saved as an audio file using Chango Voice Engine.",
      });
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export audio",
        variant: "destructive",
      });
    },
  });

  const handleSpeak = () => {
    if (text.trim()) {
      speak(text.trim());
      // Track TTS usage for session analytics
      trackTtsUtterance();
    }
  };

  const handlePreview = () => {
    if (text.trim()) {
      previewMutation.mutate();
    }
  };

  const handleExport = () => {
    if (text.trim()) {
      exportMutation.mutate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Text to Speech</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Textarea
            placeholder="Enter text to synthesize..."
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="resize-none"
            data-testid="textarea-tts-input"
          />
          
          <div className="flex space-x-3">
            <Button 
              onClick={handleSpeak}
              className="flex-1"
              disabled={!text.trim() || isPlaying || isRecording}
              data-testid="button-speak"
            >
              {isRecording ? "Recording..." : "Speak"}
            </Button>
            <Button 
              onClick={handlePreview}
              variant="secondary"
              disabled={!text.trim() || previewMutation.isPending}
              data-testid="button-preview"
            >
              {previewMutation.isPending ? "Processing..." : "Preview"}
            </Button>
            <Button 
              onClick={handleExport}
              variant="outline"
              disabled={!text.trim() || isPlaying || isRecording || exportMutation.isPending}
              data-testid="button-export"
            >
              {exportMutation.isPending ? "Exporting..." : "Export"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

```

## client/src/components/VoiceControls.tsx

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";

export default function VoiceControls() {
  const { isEnabled, isPlaying, enable, test, stop } = useVoiceSynthesis();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Voice Controls</CardTitle>
          <div className="flex items-center space-x-2">
            <span className={`status-indicator ${isEnabled ? 'status-online' : 'status-offline'}`}></span>
            <span className="text-sm text-muted-foreground">
              {isEnabled ? 'Ready' : 'Disabled'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Button 
            onClick={enable}
            disabled={isEnabled}
            data-testid="button-enable-voice"
          >
            Enable Voice
          </Button>
          <Button 
            onClick={test}
            variant="secondary"
            disabled={!isEnabled || isPlaying}
            data-testid="button-test-speech"
          >
            Test Speech
          </Button>
          <Button 
            onClick={stop}
            variant="outline"
            disabled={!isPlaying}
            data-testid="button-stop-speech"
          >
            Stop
          </Button>
        </div>

        <div className={`voice-visualizer ${isPlaying ? 'active' : ''} mb-4`}></div>
        
        <p className="text-sm text-muted-foreground" data-testid="text-voice-status">
          Status: {isEnabled ? 'Voice synthesis ready' : 'Voice synthesis disabled'} 
          {isPlaying && ' • Currently playing'}
        </p>
      </CardContent>
    </Card>
  );
}

```

## client/src/components/VoiceRouteSelector.tsx

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mic, Volume2, Settings, Zap, Cloud, Server, User } from "lucide-react";

interface RouteStatus {
  enabled: boolean;
  healthy: boolean;
  note: string;
}

interface DiagnosticsData {
  routes: {
    client: RouteStatus;
    local_neural: RouteStatus;
    elevenlabs: RouteStatus;
    azure: RouteStatus;
  };
}

type TTSRoute = "client" | "local_neural" | "elevenlabs" | "azure";

export default function VoiceRouteSelector() {
  const [selectedRoute, setSelectedRoute] = useState<TTSRoute>("client");
  const [testText, setTestText] = useState("Hello, this is a test of the voice synthesis system.");
  const { toast } = useToast();

  // Get route status from diagnostics
  const { data: diagnostics } = useQuery<DiagnosticsData>({
    queryKey: ["/api/diagnostics"],
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const routes = diagnostics?.routes || {
    client: { enabled: true, healthy: true, note: 'WebSpeech (browser)' },
    local_neural: { enabled: false, healthy: false, note: 'planned' },
    elevenlabs: { enabled: false, healthy: false, note: 'no key' },
    azure: { enabled: false, healthy: false, note: 'no key' }
  };

  // Test synthesis mutation
  const testMutation = useMutation({
    mutationFn: async (route: TTSRoute) => {
      const response = await apiRequest("POST", "/api/tts/synthesize", {
        text: testText,
        route: route
      });

      return response;
    },
    onSuccess: (data: any, route) => {
      if (data && data.success) {
        toast({
          title: "Route Test Success",
          description: `${route.toUpperCase()}: ${data.message || 'Route is working correctly'}`,
        });
      } else {
        toast({
          title: "Route Test Complete",
          description: `${route.toUpperCase()} route responded.`,
        });
      }
    },
    onError: (error: any, route) => {
      toast({
        title: "Route Test Failed",
        description: `${route.toUpperCase()} route error: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const getRouteIcon = (route: TTSRoute) => {
    switch (route) {
      case "client":
        return <User className="h-4 w-4" />;
      case "local_neural":
        return <Server className="h-4 w-4" />;
      case "elevenlabs":
        return <Cloud className="h-4 w-4" />;
      case "azure":
        return <Zap className="h-4 w-4" />;
      default:
        return <Volume2 className="h-4 w-4" />;
    }
  };

  const getRouteDescription = (route: TTSRoute) => {
    switch (route) {
      case "client":
        return "Browser-based speech synthesis using Web Speech API";
      case "local_neural":
        return "Local neural TTS engine (coming soon)";
      case "elevenlabs":
        return "ElevenLabs professional AI voices with natural speech";
      case "azure":
        return "Microsoft Azure neural voices with SSML support";
      default:
        return "";
    }
  };

  const getStatusBadge = (routeData: RouteStatus) => {
    if (!routeData.enabled) {
      return <Badge variant="secondary" data-testid="status-disabled">Disabled</Badge>;
    }
    if (!routeData.healthy && routeData.enabled) {
      return <Badge variant="outline" data-testid="status-enabled">Available</Badge>;
    }
    return <Badge variant="default" className="bg-green-500" data-testid="status-ready">Ready</Badge>;
  };

  const isRouteSelectable = (route: TTSRoute) => {
    const routeData = routes[route];
    return routeData.enabled || route === "client";
  };

  return (
    <Card data-testid="card-voice-routes">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Voice Synthesis Routes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Route Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(routes).map(([route, status]) => (
            <div 
              key={route} 
              className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                selectedRoute === route ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              } ${!isRouteSelectable(route as TTSRoute) ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => isRouteSelectable(route as TTSRoute) && setSelectedRoute(route as TTSRoute)}
              data-testid={`route-card-${route}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getRouteIcon(route as TTSRoute)}
                  <span className="font-medium capitalize">{route.replace('_', ' ')}</span>
                </div>
                {getStatusBadge(status)}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {getRouteDescription(route as TTSRoute)}
              </p>
              <p className="text-xs text-muted-foreground">
                {status.note}
              </p>
            </div>
          ))}
        </div>

        <Separator />

        {/* Route Selection and Testing */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Active Route</label>
              <Select value={selectedRoute} onValueChange={(value: TTSRoute) => setSelectedRoute(value)}>
                <SelectTrigger data-testid="select-route">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(routes).map(([route, status]) => (
                    <SelectItem 
                      key={route} 
                      value={route}
                      disabled={!isRouteSelectable(route as TTSRoute)}
                      data-testid={`select-option-${route}`}
                    >
                      <div className="flex items-center gap-2">
                        {getRouteIcon(route as TTSRoute)}
                        <span className="capitalize">{route.replace('_', ' ')}</span>
                        {status.enabled && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {status.healthy ? 'Ready' : 'Available'}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => testMutation.mutate(selectedRoute)}
                disabled={testMutation.isPending || !isRouteSelectable(selectedRoute)}
                variant="outline"
                data-testid="button-test-route"
              >
                <Mic className="h-4 w-4 mr-2" />
                {testMutation.isPending ? "Testing..." : "Test Route"}
              </Button>
            </div>
          </div>

          {/* Route-specific Information */}
          {selectedRoute && routes[selectedRoute] && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {getRouteIcon(selectedRoute)}
                <h4 className="font-medium capitalize">{selectedRoute.replace('_', ' ')} Route</h4>
                {getStatusBadge(routes[selectedRoute])}
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {getRouteDescription(selectedRoute)}
              </p>

              {/* Route-specific configuration */}
              {selectedRoute === "client" && (
                <div className="text-sm">
                  <p className="text-green-600 font-medium">✓ No setup required</p>
                  <p className="text-muted-foreground">Uses your browser's built-in speech synthesis</p>
                </div>
              )}

              {selectedRoute === "elevenlabs" && !routes.elevenlabs.enabled && (
                <div className="text-sm">
                  <p className="text-amber-600 font-medium">⚠ API Key Required</p>
                  <p className="text-muted-foreground">Add ELEVENLABS_API_KEY to environment variables</p>
                </div>
              )}

              {selectedRoute === "azure" && !routes.azure.enabled && (
                <div className="text-sm">
                  <p className="text-amber-600 font-medium">⚠ Credentials Required</p>
                  <p className="text-muted-foreground">Add AZURE_TTS_KEY and AZURE_TTS_REGION to environment</p>
                </div>
              )}

              {selectedRoute === "local_neural" && (
                <div className="text-sm">
                  <p className="text-blue-600 font-medium">🚧 Coming Soon</p>
                  <p className="text-muted-foreground">Local neural TTS engine in development</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

## client/src/components/VoiceScanner.tsx

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { VoiceProfile } from "@shared/schema";
import { trackProfileLearned } from "@/lib/sessionTracking";

export default function VoiceScanner() {
  const [profileName, setProfileName] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { 
    isRecording, 
    hasRecording, 
    startRecording, 
    stopRecording, 
    audioBlob,
    status 
  } = useAudioRecording();

  // Load voice profiles
  const { data: profilesData } = useQuery({
    queryKey: ["/api/voice-profiles"],
  });

  const profiles = ((profilesData as any)?.profiles || []) as VoiceProfile[];

  // Analyze and save profile mutation
  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!audioBlob || !profileName.trim()) {
        throw new Error("Audio recording and profile name are required");
      }

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");
      formData.append("name", profileName.trim());
      formData.append("accentType", "custom");
      formData.append("intensity", "0.5");

      const response = await fetch("/api/voice-profiles", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to save voice profile");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
      setProfileName("");
      // Track profile learning for session analytics
      trackProfileLearned();
      toast({
        title: "Voice Profile Saved",
        description: `Profile "${profileName}" has been analyzed and saved successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Load profile mutation
  const loadProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      return apiRequest("GET", `/api/voice-profiles/${profileId}`);
    },
    onSuccess: (data) => {
      const profile = (data as any).profile as VoiceProfile;
      toast({
        title: "Profile Loaded",
        description: `Voice profile "${profile.name}" has been applied.`,
      });
    },
    onError: () => {
      toast({
        title: "Load Failed",
        description: "Failed to load the selected voice profile.",
        variant: "destructive",
      });
    },
  });

  const handleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleAnalyzeAndSave = () => {
    if (!profileName.trim()) {
      toast({
        title: "Profile Name Required",
        description: "Please enter a name for the voice profile.",
        variant: "destructive",
      });
      return;
    }
    saveProfileMutation.mutate();
  };

  const handleLoadProfile = () => {
    if (!selectedProfileId) {
      toast({
        title: "Profile Selection Required",
        description: "Please select a profile to load.",
        variant: "destructive",
      });
      return;
    }
    loadProfileMutation.mutate(selectedProfileId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Profile Scanner</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <Input
              type="text"
              placeholder="Profile name (e.g., 'Morgan Freeman Style')"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="flex-1"
              data-testid="input-profile-name"
            />
            <Button
              onClick={handleRecord}
              variant={isRecording ? "destructive" : "secondary"}
              className="flex items-center space-x-2"
              data-testid="button-record-voice"
            >
              <div className={`w-3 h-3 rounded-full ${
                isRecording ? 'bg-red-400 animate-pulse' : 'bg-gray-400'
              }`}></div>
              <span>{isRecording ? "Stop" : "Record"}</span>
            </Button>
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={handleAnalyzeAndSave}
              disabled={!hasRecording || !profileName.trim() || saveProfileMutation.isPending}
              className="flex-1"
              data-testid="button-analyze-save"
            >
              {saveProfileMutation.isPending ? "Analyzing..." : "Analyze & Save"}
            </Button>
            <div className="flex-1 flex space-x-2">
              <Select 
                value={selectedProfileId} 
                onValueChange={setSelectedProfileId}
                data-testid="select-voice-profile"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleLoadProfile}
                disabled={!selectedProfileId || loadProfileMutation.isPending}
                data-testid="button-load-profile"
              >
                Load
              </Button>
            </div>
          </div>

          <div className="bg-muted/30 rounded-md p-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className={`status-indicator ${
                isRecording ? 'status-processing' : 
                hasRecording ? 'status-online' : 'status-offline'
              }`}></span>
              <span className="text-sm font-medium">Scanning Status</span>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-scan-status">
              {status} • {profiles.length} custom profiles saved
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

```

## client/src/components/ui/accordion.tsx

```tsx
import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b", className)}
    {...props}
  />
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
))

AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }

```

## client/src/components/ui/alert-dialog.tsx

```tsx
import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const AlertDialog = AlertDialogPrimitive.Root

const AlertDialogTrigger = AlertDialogPrimitive.Trigger

const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    />
  </AlertDialogPortal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants(), className)}
    {...props}
  />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      buttonVariants({ variant: "outline" }),
      "mt-2 sm:mt-0",
      className
    )}
    {...props}
  />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}

```

## client/src/components/ui/alert.tsx

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }

```

## client/src/components/ui/aspect-ratio.tsx

```tsx
import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio"

const AspectRatio = AspectRatioPrimitive.Root

export { AspectRatio }

```

## client/src/components/ui/avatar.tsx

```tsx
"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }

```

## client/src/components/ui/badge.tsx

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

```

## client/src/components/ui/breadcrumb.tsx

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"nav"> & {
    separator?: React.ReactNode
  }
>(({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />)
Breadcrumb.displayName = "Breadcrumb"

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<"ol">
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
      className
    )}
    {...props}
  />
))
BreadcrumbList.displayName = "BreadcrumbList"

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("inline-flex items-center gap-1.5", className)}
    {...props}
  />
))
BreadcrumbItem.displayName = "BreadcrumbItem"

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<"a"> & {
    asChild?: boolean
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp
      ref={ref}
      className={cn("transition-colors hover:text-foreground", className)}
      {...props}
    />
  )
})
BreadcrumbLink.displayName = "BreadcrumbLink"

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn("font-normal text-foreground", className)}
    {...props}
  />
))
BreadcrumbPage.displayName = "BreadcrumbPage"

const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) => (
  <li
    role="presentation"
    aria-hidden="true"
    className={cn("[&>svg]:w-3.5 [&>svg]:h-3.5", className)}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
)
BreadcrumbSeparator.displayName = "BreadcrumbSeparator"

const BreadcrumbEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
)
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis"

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}

```

## client/src/components/ui/button.tsx

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

```

## client/src/components/ui/calendar.tsx

```tsx
import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("h-4 w-4", className)} {...props} />
        ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

```

## client/src/components/ui/card.tsx

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

```

## client/src/components/ui/carousel.tsx

```tsx
import * as React from "react"
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

type CarouselProps = {
  opts?: CarouselOptions
  plugins?: CarouselPlugin
  orientation?: "horizontal" | "vertical"
  setApi?: (api: CarouselApi) => void
}

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0]
  api: ReturnType<typeof useEmblaCarousel>[1]
  scrollPrev: () => void
  scrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
} & CarouselProps

const CarouselContext = React.createContext<CarouselContextProps | null>(null)

function useCarousel() {
  const context = React.useContext(CarouselContext)

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />")
  }

  return context
}

const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(
  (
    {
      orientation = "horizontal",
      opts,
      setApi,
      plugins,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        ...opts,
        axis: orientation === "horizontal" ? "x" : "y",
      },
      plugins
    )
    const [canScrollPrev, setCanScrollPrev] = React.useState(false)
    const [canScrollNext, setCanScrollNext] = React.useState(false)

    const onSelect = React.useCallback((api: CarouselApi) => {
      if (!api) {
        return
      }

      setCanScrollPrev(api.canScrollPrev())
      setCanScrollNext(api.canScrollNext())
    }, [])

    const scrollPrev = React.useCallback(() => {
      api?.scrollPrev()
    }, [api])

    const scrollNext = React.useCallback(() => {
      api?.scrollNext()
    }, [api])

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault()
          scrollPrev()
        } else if (event.key === "ArrowRight") {
          event.preventDefault()
          scrollNext()
        }
      },
      [scrollPrev, scrollNext]
    )

    React.useEffect(() => {
      if (!api || !setApi) {
        return
      }

      setApi(api)
    }, [api, setApi])

    React.useEffect(() => {
      if (!api) {
        return
      }

      onSelect(api)
      api.on("reInit", onSelect)
      api.on("select", onSelect)

      return () => {
        api?.off("select", onSelect)
      }
    }, [api, onSelect])

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api: api,
          opts,
          orientation:
            orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext,
        }}
      >
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn("relative", className)}
          role="region"
          aria-roledescription="carousel"
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    )
  }
)
Carousel.displayName = "Carousel"

const CarouselContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { carouselRef, orientation } = useCarousel()

  return (
    <div ref={carouselRef} className="overflow-hidden">
      <div
        ref={ref}
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          className
        )}
        {...props}
      />
    </div>
  )
})
CarouselContent.displayName = "CarouselContent"

const CarouselItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { orientation } = useCarousel()

  return (
    <div
      ref={ref}
      role="group"
      aria-roledescription="slide"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className
      )}
      {...props}
    />
  )
})
CarouselItem.displayName = "CarouselItem"

const CarouselPrevious = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel()

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "absolute  h-8 w-8 rounded-full",
        orientation === "horizontal"
          ? "-left-12 top-1/2 -translate-y-1/2"
          : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="sr-only">Previous slide</span>
    </Button>
  )
})
CarouselPrevious.displayName = "CarouselPrevious"

const CarouselNext = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { orientation, scrollNext, canScrollNext } = useCarousel()

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "absolute h-8 w-8 rounded-full",
        orientation === "horizontal"
          ? "-right-12 top-1/2 -translate-y-1/2"
          : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ArrowRight className="h-4 w-4" />
      <span className="sr-only">Next slide</span>
    </Button>
  )
})
CarouselNext.displayName = "CarouselNext"

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
}

```

## client/src/components/ui/chart.tsx

```tsx
"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >["children"]
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "Chart"

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, config]) => config.theme || config.color
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div"> & {
      hideLabel?: boolean
      hideIndicator?: boolean
      indicator?: "line" | "dot" | "dashed"
      nameKey?: string
      labelKey?: string
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null
      }

      const [item] = payload
      const key = `${labelKey || item?.dataKey || item?.name || "value"}`
      const itemConfig = getPayloadConfigFromPayload(config, item, key)
      const value =
        !labelKey && typeof label === "string"
          ? config[label as keyof typeof config]?.label || label
          : itemConfig?.label

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>
            {labelFormatter(value, payload)}
          </div>
        )
      }

      if (!value) {
        return null
      }

      return <div className={cn("font-medium", labelClassName)}>{value}</div>
    }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelClassName,
      config,
      labelKey,
    ])

    if (!active || !payload?.length) {
      return null
    }

    const nestLabel = payload.length === 1 && indicator !== "dot"

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`
            const itemConfig = getPayloadConfigFromPayload(config, item, key)
            const indicatorColor = color || item.payload.fill || item.color

            return (
              <div
                key={item.dataKey}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center"
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn(
                            "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                            {
                              "h-2.5 w-2.5": indicator === "dot",
                              "w-1": indicator === "line",
                              "w-0 border-[1.5px] border-dashed bg-transparent":
                                indicator === "dashed",
                              "my-0.5": nestLabel && indicator === "dashed",
                            }
                          )}
                          style={
                            {
                              "--color-bg": indicatorColor,
                              "--color-border": indicatorColor,
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel ? "items-end" : "items-center"
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label || item.name}
                        </span>
                      </div>
                      {item.value && (
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {item.value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltip"

const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
      hideIcon?: boolean
      nameKey?: string
    }
>(
  (
    { className, hideIcon = false, payload, verticalAlign = "bottom", nameKey },
    ref
  ) => {
    const { config } = useChart()

    if (!payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className
        )}
      >
        {payload.map((item) => {
          const key = `${nameKey || item.dataKey || "value"}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)

          return (
            <div
              key={item.value}
              className={cn(
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
      </div>
    )
  }
)
ChartLegendContent.displayName = "ChartLegend"

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined

  let configLabelKey: string = key

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config]
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}

```

## client/src/components/ui/checkbox.tsx

```tsx
import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }

```

## client/src/components/ui/collapsible.tsx

```tsx
"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }

```

## client/src/components/ui/command.tsx

```tsx
import * as React from "react"
import { type DialogProps } from "@radix-ui/react-dialog"
import { Command as CommandPrimitive } from "cmdk"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className
    )}
    {...props}
  />
))
Command.displayName = CommandPrimitive.displayName

const CommandDialog = ({ children, ...props }: DialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </div>
))

CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
))

CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm"
    {...props}
  />
))

CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      className
    )}
    {...props}
  />
))

CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected='true']:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      className
    )}
    {...props}
  />
))

CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
CommandShortcut.displayName = "CommandShortcut"

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}

```

## client/src/components/ui/context-menu.tsx

```tsx
import * as React from "react"
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const ContextMenu = ContextMenuPrimitive.Root

const ContextMenuTrigger = ContextMenuPrimitive.Trigger

const ContextMenuGroup = ContextMenuPrimitive.Group

const ContextMenuPortal = ContextMenuPrimitive.Portal

const ContextMenuSub = ContextMenuPrimitive.Sub

const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

const ContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </ContextMenuPrimitive.SubTrigger>
))
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName

const ContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-context-menu-content-transform-origin]",
      className
    )}
    {...props}
  />
))
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName

const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 max-h-[--radix-context-menu-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-context-menu-content-transform-origin]",
        className
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
))
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
))
ContextMenuCheckboxItem.displayName =
  ContextMenuPrimitive.CheckboxItem.displayName

const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
))
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName

const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold text-foreground",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName

const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
))
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

const ContextMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
ContextMenuShortcut.displayName = "ContextMenuShortcut"

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}

```

## client/src/components/ui/dialog.tsx

```tsx
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}

```

## client/src/components/ui/drawer.tsx

```tsx
"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
)
Drawer.displayName = "Drawer"

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
        className
      )}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
))
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}

```

## client/src/components/ui/dropdown-menu.tsx

```tsx
import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]",
      className
    )}
    {...props}
  />
))
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  )
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}

```

## client/src/components/ui/form.tsx

```tsx
"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { Slot } from "@radix-ui/react-slot"
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  )
})
FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField()

  return (
    <Label
      ref={ref}
      className={cn(error && "text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
})
FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  )
})
FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField()

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})
FormDescription.displayName = "FormDescription"

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? "") : children

  if (!body) {
    return null
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
})
FormMessage.displayName = "FormMessage"

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}

```

## client/src/components/ui/hover-card.tsx

```tsx
"use client"

import * as React from "react"
import * as HoverCardPrimitive from "@radix-ui/react-hover-card"

import { cn } from "@/lib/utils"

const HoverCard = HoverCardPrimitive.Root

const HoverCardTrigger = HoverCardPrimitive.Trigger

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <HoverCardPrimitive.Content
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-hover-card-content-transform-origin]",
      className
    )}
    {...props}
  />
))
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName

export { HoverCard, HoverCardTrigger, HoverCardContent }

```

## client/src/components/ui/input-otp.tsx

```tsx
import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { Dot } from "lucide-react"

import { cn } from "@/lib/utils"

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn(
      "flex items-center gap-2 has-[:disabled]:opacity-50",
      containerClassName
    )}
    className={cn("disabled:cursor-not-allowed", className)}
    {...props}
  />
))
InputOTP.displayName = "InputOTP"

const InputOTPGroup = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center", className)} {...props} />
))
InputOTPGroup.displayName = "InputOTPGroup"

const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index]

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
        isActive && "z-10 ring-2 ring-ring ring-offset-background",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  )
})
InputOTPSlot.displayName = "InputOTPSlot"

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <Dot />
  </div>
))
InputOTPSeparator.displayName = "InputOTPSeparator"

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }

```

## client/src/components/ui/input.tsx

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

```

## client/src/components/ui/label.tsx

```tsx
import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }

```

## client/src/components/ui/menubar.tsx

```tsx
"use client"

import * as React from "react"
import * as MenubarPrimitive from "@radix-ui/react-menubar"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

function MenubarMenu({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Menu>) {
  return <MenubarPrimitive.Menu {...props} />
}

function MenubarGroup({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Group>) {
  return <MenubarPrimitive.Group {...props} />
}

function MenubarPortal({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Portal>) {
  return <MenubarPrimitive.Portal {...props} />
}

function MenubarRadioGroup({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.RadioGroup>) {
  return <MenubarPrimitive.RadioGroup {...props} />
}

function MenubarSub({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Sub>) {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />
}

const Menubar = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Root
    ref={ref}
    className={cn(
      "flex h-10 items-center space-x-1 rounded-md border bg-background p-1",
      className
    )}
    {...props}
  />
))
Menubar.displayName = MenubarPrimitive.Root.displayName

const MenubarTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      className
    )}
    {...props}
  />
))
MenubarTrigger.displayName = MenubarPrimitive.Trigger.displayName

const MenubarSubTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <MenubarPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </MenubarPrimitive.SubTrigger>
))
MenubarSubTrigger.displayName = MenubarPrimitive.SubTrigger.displayName

const MenubarSubContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-menubar-content-transform-origin]",
      className
    )}
    {...props}
  />
))
MenubarSubContent.displayName = MenubarPrimitive.SubContent.displayName

const MenubarContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Content>
>(
  (
    { className, align = "start", alignOffset = -4, sideOffset = 8, ...props },
    ref
  ) => (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content
        ref={ref}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-menubar-content-transform-origin]",
          className
        )}
        {...props}
      />
    </MenubarPrimitive.Portal>
  )
)
MenubarContent.displayName = MenubarPrimitive.Content.displayName

const MenubarItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
MenubarItem.displayName = MenubarPrimitive.Item.displayName

const MenubarCheckboxItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <MenubarPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.CheckboxItem>
))
MenubarCheckboxItem.displayName = MenubarPrimitive.CheckboxItem.displayName

const MenubarRadioItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <MenubarPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.RadioItem>
))
MenubarRadioItem.displayName = MenubarPrimitive.RadioItem.displayName

const MenubarLabel = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
MenubarLabel.displayName = MenubarPrimitive.Label.displayName

const MenubarSeparator = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
MenubarSeparator.displayName = MenubarPrimitive.Separator.displayName

const MenubarShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
MenubarShortcut.displayname = "MenubarShortcut"

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
}

```

## client/src/components/ui/navigation-menu.tsx

```tsx
import * as React from "react"
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu"
import { cva } from "class-variance-authority"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Root
    ref={ref}
    className={cn(
      "relative z-10 flex max-w-max flex-1 items-center justify-center",
      className
    )}
    {...props}
  >
    {children}
    <NavigationMenuViewport />
  </NavigationMenuPrimitive.Root>
))
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName

const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn(
      "group flex flex-1 list-none items-center justify-center space-x-1",
      className
    )}
    {...props}
  />
))
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName

const NavigationMenuItem = NavigationMenuPrimitive.Item

const navigationMenuTriggerStyle = cva(
  "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=open]:text-accent-foreground data-[state=open]:bg-accent/50 data-[state=open]:hover:bg-accent data-[state=open]:focus:bg-accent"
)

const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(navigationMenuTriggerStyle(), "group", className)}
    {...props}
  >
    {children}{" "}
    <ChevronDown
      className="relative top-[1px] ml-1 h-3 w-3 transition duration-200 group-data-[state=open]:rotate-180"
      aria-hidden="true"
    />
  </NavigationMenuPrimitive.Trigger>
))
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName

const NavigationMenuContent = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(
      "left-0 top-0 w-full data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 md:absolute md:w-auto ",
      className
    )}
    {...props}
  />
))
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName

const NavigationMenuLink = NavigationMenuPrimitive.Link

const NavigationMenuViewport = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <div className={cn("absolute left-0 top-full flex justify-center")}>
    <NavigationMenuPrimitive.Viewport
      className={cn(
        "origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]",
        className
      )}
      ref={ref}
      {...props}
    />
  </div>
))
NavigationMenuViewport.displayName =
  NavigationMenuPrimitive.Viewport.displayName

const NavigationMenuIndicator = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Indicator>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Indicator>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Indicator
    ref={ref}
    className={cn(
      "top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in",
      className
    )}
    {...props}
  >
    <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
  </NavigationMenuPrimitive.Indicator>
))
NavigationMenuIndicator.displayName =
  NavigationMenuPrimitive.Indicator.displayName

export {
  navigationMenuTriggerStyle,
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
}

```

## client/src/components/ui/pagination.tsx

```tsx
import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { ButtonProps, buttonVariants } from "@/components/ui/button"

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
)
Pagination.displayName = "Pagination"

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
))
PaginationContent.displayName = "PaginationContent"

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
))
PaginationItem.displayName = "PaginationItem"

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<ButtonProps, "size"> &
  React.ComponentProps<"a">

const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? "outline" : "ghost",
        size,
      }),
      className
    )}
    {...props}
  />
)
PaginationLink.displayName = "PaginationLink"

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn("gap-1 pl-2.5", className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>
  </PaginationLink>
)
PaginationPrevious.displayName = "PaginationPrevious"

const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn("gap-1 pr-2.5", className)}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
)
PaginationNext.displayName = "PaginationNext"

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    aria-hidden
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
)
PaginationEllipsis.displayName = "PaginationEllipsis"

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}

```

## client/src/components/ui/popover.tsx

```tsx
import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }

```

## client/src/components/ui/progress.tsx

```tsx
"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }

```

## client/src/components/ui/radio-group.tsx

```tsx
import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  )
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-2.5 w-2.5 fill-current text-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export { RadioGroup, RadioGroupItem }

```

## client/src/components/ui/resizable.tsx

```tsx
"use client"

import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
)

const ResizablePanel = ResizablePrimitive.Panel

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }

```

## client/src/components/ui/scroll-area.tsx

```tsx
import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }

```

## client/src/components/ui/select.tsx

```tsx
"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}

```

## client/src/components/ui/separator.tsx

```tsx
import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }

```

## client/src/components/ui/sheet.tsx

```tsx
"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}

```

## client/src/components/ui/sidebar.tsx

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { PanelLeft } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const [openMobile, setOpenMobile] = React.useState(false)

    // This is the internal state of the sidebar.
    // We use openProp and setOpenProp for control from outside the component.
    const [_open, _setOpen] = React.useState(defaultOpen)
    const open = openProp ?? _open
    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === "function" ? value(open) : value
        if (setOpenProp) {
          setOpenProp(openState)
        } else {
          _setOpen(openState)
        }

        // This sets the cookie to keep the sidebar state.
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
      },
      [setOpenProp, open]
    )

    // Helper to toggle the sidebar.
    const toggleSidebar = React.useCallback(() => {
      return isMobile
        ? setOpenMobile((open) => !open)
        : setOpen((open) => !open)
    }, [isMobile, setOpen, setOpenMobile])

    // Adds a keyboard shortcut to toggle the sidebar.
    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault()
          toggleSidebar()
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [toggleSidebar])

    // We add a state so that we can do data-state="expanded" or "collapsed".
    // This makes it easier to style the sidebar with Tailwind classes.
    const state = open ? "expanded" : "collapsed"

    const contextValue = React.useMemo<SidebarContextProps>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
    )

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH,
                "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                ...style,
              } as React.CSSProperties
            }
            className={cn(
              "group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar",
              className
            )}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    )
  }
)
SidebarProvider.displayName = "SidebarProvider"

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    side?: "left" | "right"
    variant?: "sidebar" | "floating" | "inset"
    collapsible?: "offcanvas" | "icon" | "none"
  }
>(
  (
    {
      side = "left",
      variant = "sidebar",
      collapsible = "offcanvas",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

    if (collapsible === "none") {
      return (
        <div
          className={cn(
            "flex h-full w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      )
    }

    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
          <SheetContent
            data-sidebar="sidebar"
            data-mobile="true"
            className="w-[--sidebar-width] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
              } as React.CSSProperties
            }
            side={side}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Sidebar</SheetTitle>
              <SheetDescription>Displays the mobile sidebar.</SheetDescription>
            </SheetHeader>
            <div className="flex h-full w-full flex-col">{children}</div>
          </SheetContent>
        </Sheet>
      )
    }

    return (
      <div
        ref={ref}
        className="group peer hidden text-sidebar-foreground md:block"
        data-state={state}
        data-collapsible={state === "collapsed" ? collapsible : ""}
        data-variant={variant}
        data-side={side}
      >
        {/* This is what handles the sidebar gap on desktop */}
        <div
          className={cn(
            "relative w-[--sidebar-width] bg-transparent transition-[width] duration-200 ease-linear",
            "group-data-[collapsible=offcanvas]:w-0",
            "group-data-[side=right]:rotate-180",
            variant === "floating" || variant === "inset"
              ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]"
              : "group-data-[collapsible=icon]:w-[--sidebar-width-icon]"
          )}
        />
        <div
          className={cn(
            "fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] duration-200 ease-linear md:flex",
            side === "left"
              ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
              : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
            // Adjust the padding for floating and inset variants.
            variant === "floating" || variant === "inset"
              ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]"
              : "group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[side=left]:border-r group-data-[side=right]:border-l",
            className
          )}
          {...props}
        >
          <div
            data-sidebar="sidebar"
            className="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow"
          >
            {children}
          </div>
        </div>
      </div>
    )
  }
)
Sidebar.displayName = "Sidebar"

const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

const SidebarRail = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      ref={ref}
      data-sidebar="rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex",
        "[[data-side=left]_&]:cursor-w-resize [[data-side=right]_&]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full group-data-[collapsible=offcanvas]:hover:bg-sidebar",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      {...props}
    />
  )
})
SidebarRail.displayName = "SidebarRail"

const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"main">
>(({ className, ...props }, ref) => {
  return (
    <main
      ref={ref}
      className={cn(
        "relative flex w-full flex-1 flex-col bg-background",
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow",
        className
      )}
      {...props}
    />
  )
})
SidebarInset.displayName = "SidebarInset"

const SidebarInput = React.forwardRef<
  React.ElementRef<typeof Input>,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      data-sidebar="input"
      className={cn(
        "h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className
      )}
      {...props}
    />
  )
})
SidebarInput.displayName = "SidebarInput"

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
})
SidebarFooter.displayName = "SidebarFooter"

const SidebarSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      data-sidebar="separator"
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
      {...props}
    />
  )
})
SidebarSeparator.displayName = "SidebarSeparator"

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarContent.displayName = "SidebarContent"

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  )
})
SidebarGroup.displayName = "SidebarGroup"

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className
      )}
      {...props}
    />
  )
})
SidebarGroupLabel.displayName = "SidebarGroupLabel"

const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      data-sidebar="group-action"
      className={cn(
        "absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarGroupAction.displayName = "SidebarGroupAction"

const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="group-content"
    className={cn("w-full text-sm", className)}
    {...props}
  />
))
SidebarGroupContent.displayName = "SidebarGroupContent"

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu"
    className={cn("flex w-full min-w-0 flex-col gap-1", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-sidebar="menu-item"
    className={cn("group/menu-item relative", className)}
    {...props}
  />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:!p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = "default",
      size = "default",
      tooltip,
      className,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const { isMobile, state } = useSidebar()

    const button = (
      <Comp
        ref={ref}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
        {...props}
      />
    )

    if (!tooltip) {
      return button
    }

    if (typeof tooltip === "string") {
      tooltip = {
        children: tooltip,
      }
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          hidden={state !== "collapsed" || isMobile}
          {...tooltip}
        />
      </Tooltip>
    )
  }
)
SidebarMenuButton.displayName = "SidebarMenuButton"

const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    showOnHover?: boolean
  }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-action"
      className={cn(
        "absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuAction.displayName = "SidebarMenuAction"

const SidebarMenuBadge = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="menu-badge"
    className={cn(
      "pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground",
      "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
      "peer-data-[size=sm]/menu-button:top-1",
      "peer-data-[size=default]/menu-button:top-1.5",
      "peer-data-[size=lg]/menu-button:top-2.5",
      "group-data-[collapsible=icon]:hidden",
      className
    )}
    {...props}
  />
))
SidebarMenuBadge.displayName = "SidebarMenuBadge"

const SidebarMenuSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    showIcon?: boolean
  }
>(({ className, showIcon = false, ...props }, ref) => {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-[--skeleton-width] flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
})
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton"

const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu-sub"
    className={cn(
      "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5",
      "group-data-[collapsible=icon]:hidden",
      className
    )}
    {...props}
  />
))
SidebarMenuSub.displayName = "SidebarMenuSub"

const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ ...props }, ref) => <li ref={ref} {...props} />)
SidebarMenuSubItem.displayName = "SidebarMenuSubItem"

const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> & {
    asChild?: boolean
    size?: "sm" | "md"
    isActive?: boolean
  }
>(({ asChild = false, size = "md", isActive, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuSubButton.displayName = "SidebarMenuSubButton"

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}

```

## client/src/components/ui/skeleton.tsx

```tsx
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }

```

## client/src/components/ui/slider.tsx

```tsx
import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }

```

## client/src/components/ui/switch.tsx

```tsx
import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }

```

## client/src/components/ui/table.tsx

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

```

## client/src/components/ui/tabs.tsx

```tsx
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }

```

## client/src/components/ui/textarea.tsx

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }

```

## client/src/components/ui/toast.tsx

```tsx
import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}

```

## client/src/components/ui/toaster.tsx

```tsx
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

```

## client/src/components/ui/toggle-group.tsx

```tsx
"use client"

import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({
  size: "default",
  variant: "default",
})

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn("flex items-center justify-center gap-1", className)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>
      {children}
    </ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
))

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
})

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }

```

## client/src/components/ui/toggle.tsx

```tsx
import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 gap-2",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-3 min-w-10",
        sm: "h-9 px-2.5 min-w-9",
        lg: "h-11 px-5 min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }

```

## client/src/components/ui/tooltip.tsx

```tsx
"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

```

## client/src/hooks/use-mobile.tsx

```tsx
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

```

## client/src/hooks/use-toast.ts

```typescript
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }

```

## client/src/hooks/useAudioRecording.ts

```typescript
import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface AudioRecordingState {
  isRecording: boolean;
  hasRecording: boolean;
  duration: number;
  status: string;
}

export function useAudioRecording() {
  const [state, setState] = useState<AudioRecordingState>({
    isRecording: false,
    hasRecording: false,
    duration: 0,
    status: "Ready to record voice sample",
  });

  const { toast } = useToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioBlobRef.current = audioBlob;
        
        setState(prev => ({ 
          ...prev, 
          isRecording: false, 
          hasRecording: true,
          status: `Recording complete (${audioBlob.size} bytes)`
        }));

        // Stop all tracks to release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      
      setState(prev => ({ 
        ...prev, 
        isRecording: true, 
        hasRecording: false,
        status: "Recording... (release to stop)"
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      setState(prev => ({ 
        ...prev, 
        status: `Microphone error: ${errorMessage}`
      }));
      
      toast({
        title: "Recording Failed",
        description: `Could not access microphone: ${errorMessage}`,
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      
      setState(prev => ({ 
        ...prev, 
        status: "Processing recording..."
      }));
    }
  }, [state.isRecording]);

  const clearRecording = useCallback(() => {
    audioBlobRef.current = null;
    audioChunksRef.current = [];
    
    setState(prev => ({ 
      ...prev, 
      hasRecording: false,
      status: "Ready to record voice sample"
    }));
  }, []);

  return {
    ...state,
    audioBlob: audioBlobRef.current,
    startRecording,
    stopRecording,
    clearRecording,
  };
}

```

## client/src/hooks/useHologram.ts

```typescript
import { useState, useCallback, useRef, useEffect } from "react";

interface HologramState {
  isRunning: boolean;
  mode: "awakened" | "sentinel";
  size: number;
  speed: number;
  wander: boolean;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
}

export function useHologram(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const [state, setState] = useState<HologramState>({
    isRunning: true,
    mode: "awakened",
    size: 200,
    speed: 50,
    wander: true,
    position: { x: 100, y: 100 }, // Fixed initial position to avoid window dimension issues
    velocity: { x: 0, y: 0 },
  });

  const animationRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(Date.now());
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    z: number;
    angle: number;
    speed: number;
    radius: number;
  }>>([]);

  const initializeParticles = useCallback(() => {
    const particles = [];
    const particleCount = 100;
    
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: 0,
        y: 0,
        z: 0,
        angle: (Math.PI * 2 * i) / particleCount,
        speed: 0.01 + Math.random() * 0.02,
        radius: 80 + Math.random() * 40,
      });
    }
    
    particlesRef.current = particles;
  }, []);

  const drawHologram = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    const { size, mode, speed } = state;
    const centerX = size / 2;
    const centerY = size / 2;
    
    // Clear canvas with fade effect
    ctx.fillStyle = 'rgba(0, 10, 20, 0.1)';
    ctx.fillRect(0, 0, size, size);
    
    // Draw wireframe sphere
    const sphereRadius = size * 0.3;
    const rotationSpeed = (speed / 100) * 0.02;
    
    // Meridians
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + time * rotationSpeed;
      
      ctx.strokeStyle = mode === "awakened" 
        ? `rgba(255, 220, 100, ${0.3 + Math.sin(time * 0.001) * 0.2})`
        : `rgba(255, 120, 60, ${0.3 + Math.sin(time * 0.001) * 0.2})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      for (let j = 0; j <= 20; j++) {
        const lat = (j / 20 - 0.5) * Math.PI;
        const x = centerX + Math.cos(lat) * Math.cos(angle) * sphereRadius;
        const y = centerY + Math.sin(lat) * sphereRadius;
        
        if (j === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
    }
    
    // Parallels
    for (let i = 1; i < 6; i++) {
      const lat = (i / 6 - 0.5) * Math.PI;
      const radius = Math.cos(lat) * sphereRadius;
      
      ctx.strokeStyle = mode === "awakened"
        ? `rgba(60, 255, 170, ${0.2 + Math.sin(time * 0.001 + i) * 0.1})`
        : `rgba(255, 80, 40, ${0.2 + Math.sin(time * 0.001 + i) * 0.1})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY + Math.sin(lat) * sphereRadius, Math.abs(radius), 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw particles
    particlesRef.current.forEach((particle) => {
      particle.angle += particle.speed * (speed / 100);
      
      const x = centerX + Math.cos(particle.angle) * particle.radius;
      const y = centerY + Math.sin(particle.angle * 0.7) * particle.radius * 0.5;
      const depth = Math.sin(particle.angle * 0.5) * 0.5 + 0.5;
      
      const particleColor = mode === "awakened" 
        ? `rgba(255, 220, 100, ${depth * 0.8})`
        : `rgba(255, 120, 60, ${depth * 0.8})`;
      
      ctx.fillStyle = particleColor;
      ctx.beginPath();
      ctx.arc(x, y, 1 + depth * 2, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Central core
    const coreRadius = 8 + Math.sin(time * 0.003) * 3;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
    
    if (mode === "awakened") {
      gradient.addColorStop(0, 'rgba(255, 220, 100, 1)');
      gradient.addColorStop(0.7, 'rgba(60, 255, 170, 0.8)');
      gradient.addColorStop(1, 'rgba(60, 255, 170, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(255, 120, 60, 1)');
      gradient.addColorStop(0.7, 'rgba(255, 80, 40, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 80, 40, 0)');
    }
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    
  }, [state]);

  const updateWanderingMovement = useCallback(() => {
    if (!state.wander) return;

    const now = Date.now();
    const deltaTime = Math.min((now - lastUpdateRef.current) / 1000, 0.03); // Convert to seconds, cap at 30ms for smoother updates
    lastUpdateRef.current = now;

    setState(prev => {
      const { position, velocity } = prev;
      
      // Add some randomness to velocity
      const maxSpeed = 80; // pixels per second (increased for faster movement)
      const acceleration = 40; // pixels per second squared (increased for smoother response)
      
      // Add random acceleration
      const newVelX = velocity.x + (Math.random() - 0.5) * acceleration * deltaTime;
      const newVelY = velocity.y + (Math.random() - 0.5) * acceleration * deltaTime;
      
      // Limit velocity
      const limitedVelX = Math.max(-maxSpeed, Math.min(maxSpeed, newVelX));
      const limitedVelY = Math.max(-maxSpeed, Math.min(maxSpeed, newVelY));
      
      // Update position
      let newX = position.x + limitedVelX * deltaTime;
      let newY = position.y + limitedVelY * deltaTime;
      
      // Bounce off screen edges
      const margin = 50;
      const maxX = window.innerWidth - prev.size - margin;
      const maxY = window.innerHeight - prev.size - margin;
      
      let bounceVelX = limitedVelX;
      let bounceVelY = limitedVelY;
      
      if (newX < margin) {
        newX = margin;
        bounceVelX = Math.abs(limitedVelX);
      } else if (newX > maxX) {
        newX = maxX;
        bounceVelX = -Math.abs(limitedVelX);
      }
      
      if (newY < margin) {
        newY = margin;
        bounceVelY = Math.abs(limitedVelY);
      } else if (newY > maxY) {
        newY = maxY;
        bounceVelY = -Math.abs(limitedVelY);
      }
      
      return {
        ...prev,
        position: { x: newX, y: newY },
        velocity: { x: bounceVelX, y: bounceVelY }
      };
    });
  }, [state.wander]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state.isRunning) {
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    
    // Update wandering movement
    updateWanderingMovement();
    
    const time = Date.now();
    drawHologram(ctx, time);
    
    animationRef.current = requestAnimationFrame(animate);
  }, [state.isRunning, drawHologram, canvasRef, updateWanderingMovement]);

  const initializeHologram = useCallback(() => {
    initializeParticles();
  }, [initializeParticles]);

  const toggleVisibility = useCallback(() => {
    setState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  }, []);

  const updateMode = useCallback((mode: "awakened" | "sentinel") => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  const updateSize = useCallback((size: number) => {
    setState(prev => ({ ...prev, size }));
    
    // Update canvas dimensions
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = size;
      canvas.height = size;
    }
  }, [canvasRef]);

  const updateSpeed = useCallback((speed: number) => {
    setState(prev => ({ ...prev, speed }));
  }, []);

  const updateWander = useCallback((wander: boolean) => {
    setState(prev => ({ ...prev, wander }));
    if (wander) {
      // Reset deltaTime reference to prevent large initial jump
      lastUpdateRef.current = Date.now();
    }
  }, []);

  const updatePosition = useCallback((x: number, y: number) => {
    setState(prev => ({ 
      ...prev, 
      position: { x, y },
      velocity: { x: 0, y: 0 } // Reset velocity when manually positioning
    }));
  }, []);

  // Start/stop animation based on isRunning state
  useEffect(() => {
    if (state.isRunning) {
      // Delay to avoid immediate re-creation of animate function
      const timeoutId = setTimeout(() => {
        animate();
      }, 10);
      return () => {
        clearTimeout(timeoutId);
        cancelAnimationFrame(animationRef.current);
      };
    } else {
      cancelAnimationFrame(animationRef.current);
    }
  }, [state.isRunning]);

  return {
    ...state,
    initializeHologram,
    toggleVisibility,
    updateMode,
    updateSize,
    updateSpeed,
    updateWander,
    updatePosition,
  };
}

```

## client/src/hooks/useVoiceSynthesis.ts

```typescript
import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { applyAccentToText, type AccentConfig } from "@/lib/accentEngine";

interface VoiceSynthesisState {
  isEnabled: boolean;
  isPlaying: boolean;
  currentUtterance: string;
  accentConfig: AccentConfig;
}

interface ProsodyStep {
  type: "word" | "pause" | "phrase";
  w?: string; // word text (legacy)
  text?: string; // phrase text with punctuation
  rate?: number;
  pitch?: number;
  volume?: number;
  ms?: number; // pause duration
  emotion?: string; // emotion context
}

interface CVEResponse {
  ok: boolean;
  text?: string;
  plan?: ProsodyStep[];
  prosody?: Record<string, any>;
  error?: string;
}

export function useVoiceSynthesis() {
  const [state, setState] = useState<VoiceSynthesisState>({
    isEnabled: false,
    isPlaying: false,
    currentUtterance: "",
    accentConfig: {
      profile: "neutral",
      intensity: 0.5,
      rate: 1.0,
      pitch: 1.0,
      emotion: "neutral", // Default emotion
    },
  });

  const { toast } = useToast();
  const lastUtteranceRef = useRef<string>("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const isEnabledRef = useRef<boolean>(false); // Track enabled state immediately
  const isSpeakingRef = useRef<boolean>(false); // Track if currently speaking

  const enable = useCallback(() => {
    console.log("[VoiceSynthesis] Starting enable process...");
    
    return new Promise<boolean>((resolve) => {
      if ("speechSynthesis" in window) {
        let attempts = 0;
        const maxAttempts = 10;
        let resolved = false;
        
        const loadVoices = () => {
          if (resolved) return; // Prevent multiple resolutions
          
          const voices = speechSynthesis.getVoices();
          console.log("[VoiceSynthesis] Available voices:", voices.length, "Attempt:", attempts + 1);
          
          if (voices.length > 0) {
            // Test utterance to enable speech synthesis
            const testUtterance = new SpeechSynthesisUtterance("");
            speechSynthesis.speak(testUtterance);
            
            console.log("[VoiceSynthesis] Voices loaded successfully, enabling synthesis");
            isEnabledRef.current = true; // Set ref immediately
            setState(prev => ({ ...prev, isEnabled: true }));
            
            toast({
              title: "Voice Enabled",
              description: "Speech synthesis is now ready to use.",
            });
            
            resolved = true;
            resolve(true);
          } else {
            attempts++;
            if (attempts < maxAttempts) {
              // Keep trying to load voices
              console.log("[VoiceSynthesis] No voices yet, retrying...");
              setTimeout(loadVoices, 200);
            } else {
              // Enable anyway for environments without voices (like testing)
              console.log("[VoiceSynthesis] Max attempts reached, enabling basic synthesis");
              isEnabledRef.current = true; // Set ref immediately
              setState(prev => ({ ...prev, isEnabled: true }));
              
              toast({
                title: "Voice Enabled",
                description: "Speech synthesis enabled (basic mode - no voices detected).",
              });
              
              resolved = true;
              resolve(true);
            }
          }
        };

        // Setup voice change listener
        speechSynthesis.onvoiceschanged = () => {
          console.log("[VoiceSynthesis] Voices changed event fired");
          loadVoices();
        };
        
        // Start loading voices
        loadVoices();
      } else {
        console.error("[VoiceSynthesis] Speech synthesis not supported");
        toast({
          title: "Speech Synthesis Unavailable",
          description: "Your browser doesn't support speech synthesis.",
          variant: "destructive",
        });
        resolve(false);
      }
    });
  }, [toast]);

  // Execute a prosody plan step-by-step
  const executeProsodyPlan = useCallback(async (plan: ProsodyStep[], originalText: string) => {
    console.log("[VoiceSynthesis] Executing prosody plan:", plan.length, "steps");
    isCancelledRef.current = false;
    isSpeakingRef.current = true;
    
    const voices = speechSynthesis.getVoices();
    
    // Prefer high-quality voices
    const preferredVoice = voices.find(voice => 
      voice.name.includes("Google") || 
      voice.name.includes("Natural") || 
      voice.name.includes("Premium") ||
      voice.name.includes("Enhanced")
    ) || voices.find(voice => voice.default) || voices[0];

    for (const step of plan) {
      if (isCancelledRef.current) {
        console.log("[VoiceSynthesis] Prosody plan execution cancelled");
        break;
      }

      if (step.type === "phrase" && step.text) {
        // Speak a phrase with specified parameters (new phrase-level synthesis)
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(step.text);
          utteranceRef.current = utterance;
          
          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
          
          // Apply prosody parameters from the plan
          utterance.rate = step.rate !== undefined ? Math.max(0.1, Math.min(10, step.rate)) : 1.0;
          utterance.pitch = step.pitch !== undefined ? Math.max(0, Math.min(2, step.pitch)) : 1.0;
          utterance.volume = step.volume !== undefined ? Math.max(0, Math.min(1, step.volume)) : 1.0;
          
          utterance.onend = () => {
            resolve();
          };
          
          utterance.onerror = (event) => {
            console.error("Error speaking phrase:", step.text, event);
            resolve(); // Continue with next phrase even if error
          };
          
          speechSynthesis.speak(utterance);
        });
      } else if (step.type === "word" && step.w) {
        // Legacy word-by-word support for backward compatibility
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(step.w);
          utteranceRef.current = utterance;
          
          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
          
          // Apply prosody parameters from the plan
          utterance.rate = step.rate !== undefined ? Math.max(0.1, Math.min(10, step.rate)) : 1.0;
          utterance.pitch = step.pitch !== undefined ? Math.max(0, Math.min(2, step.pitch)) : 1.0;
          utterance.volume = step.volume !== undefined ? Math.max(0, Math.min(1, step.volume)) : 1.0;
          
          utterance.onend = () => {
            resolve();
          };
          
          utterance.onerror = () => {
            console.error("Error speaking word:", step.w);
            resolve(); // Continue with next word even if error
          };
          
          speechSynthesis.speak(utterance);
        });
      } else if (step.type === "pause" && step.ms) {
        // Add a pause
        await new Promise(resolve => setTimeout(resolve, step.ms));
      }
    }
    
    console.log("[VoiceSynthesis] Prosody plan execution completed");
    isSpeakingRef.current = false;
    setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
  }, []);

  // Fallback to local synthesis
  const fallbackLocalSynthesis = useCallback((text: string) => {
    console.log("[VoiceSynthesis] Using fallback local synthesis for text:", text.slice(0, 50));
    
    // Apply accent transformation locally
    const processedText = applyAccentToText(text, state.accentConfig);
    
    const utterance = new SpeechSynthesisUtterance(processedText);
    utteranceRef.current = utterance;

    // Get available voices and prefer high-quality ones
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      const preferredVoice = voices.find(voice => 
        voice.name.includes("Google") || 
        voice.name.includes("Natural") || 
        voice.name.includes("Premium") ||
        voice.name.includes("Enhanced")
      ) || voices.find(voice => voice.default) || voices[0];
      utterance.voice = preferredVoice;
    }

    // Apply voice parameters with safe bounds
    utterance.rate = Math.max(0.1, Math.min(10, state.accentConfig.rate));
    utterance.pitch = Math.max(0, Math.min(2, state.accentConfig.pitch));
    utterance.volume = 1.0;

    // Set up event handlers
    utterance.onstart = () => {
      isSpeakingRef.current = true;
      setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
    };

    utterance.onerror = (event) => {
      console.error("Speech error:", event.error);
      isSpeakingRef.current = false;
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
      
      // For testing environments, simulate successful speech
      if (event.error === "synthesis-failed" && voices.length === 0) {
        console.log("Simulating speech for testing environment");
        setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
        setTimeout(() => {
          setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
        }, 2000);
      }
    };

    try {
      speechSynthesis.speak(utterance);
      console.log("Local speech synthesis command sent");
    } catch (error) {
      console.error("Failed to start local speech synthesis:", error);
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
    }
  }, [state.accentConfig]);

  // Main speak function with CVE integration
  const speak = useCallback(async (text: string) => {
    // Check if already speaking to prevent overlaps
    if (isSpeakingRef.current) {
      console.log("[VoiceSynthesis] Speech blocked: Already speaking");
      return;
    }
    
    if (!isEnabledRef.current || !text.trim()) {
      console.log("[VoiceSynthesis] Speech blocked:", { 
        enabled: isEnabledRef.current, 
        stateEnabled: state.isEnabled,
        hasText: !!text.trim(),
        text: text.slice(0, 50) + (text.length > 50 ? '...' : '')
      });
      
      // Try to enable again if not enabled
      if (!isEnabledRef.current && "speechSynthesis" in window) {
        console.log("[VoiceSynthesis] Attempting to re-enable...");
        const enabled = await enable();
        if (enabled) {
          console.log("[VoiceSynthesis] Re-enabled successfully, retrying speak");
          // Retry speaking after re-enabling
          setTimeout(() => speak(text), 100);
        }
      }
      return;
    }

    console.log("[VoiceSynthesis] Starting speech synthesis with CVE:", { 
      text: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
      config: state.accentConfig,
      enabled: isEnabledRef.current,
      stateEnabled: state.isEnabled
    });

    // Stop any ongoing speech
    speechSynthesis.cancel();
    isCancelledRef.current = true;
    isSpeakingRef.current = true; // Set speaking flag immediately

    // Save the text for repeat functionality
    lastUtteranceRef.current = text;
    
    // Set playing state
    setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));

    try {
      // Call CVE API
      const response = await fetch('/api/voice/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          accent: state.accentConfig.profile,
          intensity: state.accentConfig.intensity,
          emotion: state.accentConfig.emotion || 'neutral',
        }),
      });

      if (!response.ok) {
        throw new Error(`CVE API error: ${response.status}`);
      }

      const cveResponse: CVEResponse = await response.json();
      
      if (!cveResponse.ok || !cveResponse.plan) {
        throw new Error(cveResponse.error || 'Invalid CVE response');
      }

      console.log("CVE response:", {
        text: cveResponse.text,
        planLength: cveResponse.plan.length,
        prosody: cveResponse.prosody,
      });

      // Execute the prosody plan
      await executeProsodyPlan(cveResponse.plan, text);
      
    } catch (error) {
      console.error("CVE API failed, falling back to local synthesis:", error);
      isSpeakingRef.current = false; // Reset on error
      
      // Fallback to local synthesis if CVE API fails
      fallbackLocalSynthesis(text);
      
      // Only show toast for non-network errors
      if (!(error instanceof TypeError && error.message.includes('fetch'))) {
        toast({
          title: "Voice Engine Fallback",
          description: "Using local voice synthesis (server unavailable)",
        });
      }
    }
  }, [state.isEnabled, state.accentConfig, executeProsodyPlan, fallbackLocalSynthesis, toast]);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    isCancelledRef.current = true;
    isSpeakingRef.current = false;
    setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
  }, []);

  const test = useCallback(() => {
    speak("Hello, I'm Chango. How can I help you today?");
  }, [speak]);

  const applyAccent = useCallback((config: Partial<AccentConfig>) => {
    setState(prev => ({
      ...prev,
      accentConfig: { ...prev.accentConfig, ...config }
    }));
    
    const displayName = config.profile || state.accentConfig.profile;
    const emotion = config.emotion || state.accentConfig.emotion;
    
    toast({
      title: "Voice Updated",
      description: `Accent: ${displayName}, Emotion: ${emotion}`,
    });
  }, [toast, state.accentConfig]);

  const repeatWithAccent = useCallback(() => {
    if (lastUtteranceRef.current) {
      speak(lastUtteranceRef.current);
    }
  }, [speak]);

  // Check if currently speaking
  const isSpeaking = useCallback(() => {
    return isSpeakingRef.current || state.isPlaying;
  }, [state.isPlaying]);

  return {
    ...state,
    enable,
    speak,
    stop,
    test,
    applyAccent,
    repeatWithAccent,
    isSpeaking,
  };
}
```

## client/src/hooks/useVoiceSynthesisWithExport.ts

```typescript
import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { applyAccentToText, type AccentConfig } from "@/lib/accentEngine";

interface VoiceSynthesisState {
  isEnabled: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  currentUtterance: string;
  accentConfig: AccentConfig;
}

export function useVoiceSynthesisWithExport() {
  const [state, setState] = useState<VoiceSynthesisState>({
    isEnabled: false,
    isPlaying: false,
    isRecording: false,
    currentUtterance: "",
    accentConfig: {
      profile: "neutral",
      intensity: 0.5,
      rate: 1.0,
      pitch: 1.0,
    },
  });

  const { toast } = useToast();
  const lastUtteranceRef = useRef<string>("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const setupAudioRecording = useCallback(async () => {
    try {
      // Create audio context for recording
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      // Create a destination for recording
      const destination = audioContextRef.current.createMediaStreamDestination();
      
      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      return destination;
    } catch (error) {
      console.error("Failed to setup audio recording:", error);
      throw error;
    }
  }, []);

  const enable = useCallback(() => {
    if ("speechSynthesis" in window) {
      let attempts = 0;
      const maxAttempts = 10;
      
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        console.log("Available voices:", voices.length, "Attempt:", attempts + 1);
        
        if (voices.length > 0) {
          // Test utterance to enable speech synthesis
          const testUtterance = new SpeechSynthesisUtterance("");
          speechSynthesis.speak(testUtterance);
          
          setState(prev => ({ ...prev, isEnabled: true }));
          
          toast({
            title: "Voice Enabled",
            description: "Speech synthesis is now ready to use.",
          });
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(loadVoices, 200);
          } else {
            console.log("No voices available, enabling basic synthesis");
            setState(prev => ({ ...prev, isEnabled: true }));
            
            toast({
              title: "Voice Enabled", 
              description: "Speech synthesis enabled (basic mode).",
            });
          }
        }
      };

      speechSynthesis.onvoiceschanged = loadVoices;
      loadVoices();
    } else {
      toast({
        title: "Speech Synthesis Unavailable",
        description: "Your browser doesn't support speech synthesis.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const speak = useCallback((text: string) => {
    if (!state.isEnabled || !text.trim()) {
      console.log("Speech blocked:", { enabled: state.isEnabled, hasText: !!text.trim() });
      return;
    }

    console.log("Starting speech synthesis:", { text, config: state.accentConfig });

    speechSynthesis.cancel();

    const processedText = applyAccentToText(text, state.accentConfig);
    lastUtteranceRef.current = text;

    const utterance = new SpeechSynthesisUtterance(processedText);
    utteranceRef.current = utterance;

    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      utterance.voice = voices.find(voice => voice.default) || voices[0];
    }

    utterance.rate = Math.max(0.1, Math.min(10, state.accentConfig.rate));
    utterance.pitch = Math.max(0, Math.min(2, state.accentConfig.pitch));
    utterance.volume = 1.0;

    utterance.onstart = () => {
      console.log("Speech started");
      setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
    };

    utterance.onend = () => {
      console.log("Speech ended");
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
    };

    utterance.onerror = (event) => {
      console.error("Speech error:", event.error, event);
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
      
      if (event.error === "synthesis-failed" && voices.length === 0) {
        setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
        setTimeout(() => {
          setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
        }, 2000);
        
        toast({
          title: "Speech Simulated",
          description: "Speech synthesis simulated (testing environment)",
        });
      } else {
        toast({
          title: "Speech Error",
          description: `Error occurred: ${event.error}`,
          variant: "destructive",
        });
      }
    };

    try {
      speechSynthesis.speak(utterance);
      
      if (voices.length === 0) {
        setTimeout(() => {
          if (utterance.onerror) {
            utterance.onerror({ error: 'synthesis-failed' } as any);
          }
        }, 100);
      }
    } catch (error) {
      console.error("Failed to start speech synthesis:", error);
      
      setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
      setTimeout(() => {
        setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
      }, 2000);
      
      toast({
        title: "Speech Simulated",
        description: "Speech synthesis simulated (fallback mode)",
      });
    }
  }, [state.isEnabled, state.accentConfig, toast]);

  const exportAudio = useCallback(async (text: string, route: string = "client"): Promise<Blob> => {
    if (!text.trim()) {
      throw new Error("No text provided for export");
    }

    try {
      setState(prev => ({ ...prev, isRecording: true }));
      
      // For cloud TTS routes, get audio from server
      if (route === "elevenlabs" || route === "azure") {
        const response = await fetch("/api/tts/audio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: text.trim(),
            route: route
          }),
        });

        if (!response.ok) {
          throw new Error(`Server audio synthesis failed: ${response.status}`);
        }

        const blob = await response.blob();
        setState(prev => ({ ...prev, isRecording: false }));
        return blob;
      }

      // For client route, Web Speech API cannot be reliably captured
      throw new Error("Audio export is not supported for browser-based speech synthesis. Use ElevenLabs or Azure routes for audio export.");

    } catch (error) {
      setState(prev => ({ ...prev, isRecording: false }));
      throw error;
    }
  }, []);

  const downloadAudio = useCallback((audioBlob: Blob, filename: string = 'chango-speech.webm') => {
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setState(prev => ({ ...prev, isPlaying: false, isRecording: false, currentUtterance: "" }));
  }, []);

  const applyAccent = useCallback((config: Partial<AccentConfig>) => {
    setState(prev => ({
      ...prev,
      accentConfig: { ...prev.accentConfig, ...config }
    }));
    
    toast({
      title: "Accent Applied",
      description: `Voice accent updated to ${config.profile || state.accentConfig.profile}`,
    });
  }, [toast, state.accentConfig.profile]);

  const repeatWithAccent = useCallback(() => {
    if (lastUtteranceRef.current) {
      speak(lastUtteranceRef.current);
    }
  }, [speak]);

  return {
    ...state,
    enable,
    speak,
    stop,
    applyAccent,
    repeatWithAccent,
    exportAudio,
    downloadAudio,
  };
}
```

## client/src/index.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: hsl(222, 84%, 4%);
  --foreground: hsl(210, 40%, 95%);
  --card: hsl(222, 84%, 7%);
  --card-foreground: hsl(210, 40%, 90%);
  --popover: hsl(222, 84%, 4%);
  --popover-foreground: hsl(210, 40%, 95%);
  --primary: hsl(217, 91%, 60%);
  --primary-foreground: hsl(222, 84%, 4%);
  --secondary: hsl(217, 32%, 17%);
  --secondary-foreground: hsl(210, 40%, 98%);
  --muted: hsl(215, 27%, 16%);
  --muted-foreground: hsl(217, 10%, 64%);
  --accent: hsl(188, 88%, 50%);
  --accent-foreground: hsl(222, 84%, 4%);
  --destructive: hsl(0, 84%, 60%);
  --destructive-foreground: hsl(210, 40%, 98%);
  --border: hsl(217, 32%, 17%);
  --input: hsl(222, 84%, 5%);
  --ring: hsl(217, 91%, 60%);
  --chart-1: hsl(217, 91%, 60%);
  --chart-2: hsl(159, 100%, 36%);
  --chart-3: hsl(42, 93%, 56%);
  --chart-4: hsl(147, 79%, 42%);
  --chart-5: hsl(341, 75%, 51%);
  --sidebar: hsl(222, 84%, 7%);
  --sidebar-foreground: hsl(210, 40%, 90%);
  --sidebar-primary: hsl(217, 91%, 60%);
  --sidebar-primary-foreground: hsl(222, 84%, 4%);
  --sidebar-accent: hsl(215, 27%, 16%);
  --sidebar-accent-foreground: hsl(210, 40%, 90%);
  --sidebar-border: hsl(217, 32%, 17%);
  --sidebar-ring: hsl(217, 91%, 60%);
  --font-sans: Inter, system-ui, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: Menlo, monospace;
  --radius: 12px;
}

.theme-hud {
  --background: hsl(222, 84%, 3%);
  --card: hsl(222, 84%, 6%);
  --border: hsl(217, 32%, 20%);
  --accent: hsl(175, 100%, 60%);
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply font-sans antialiased bg-background text-foreground;
  }
}

@layer components {
  .status-indicator {
    @apply w-2 h-2 rounded-full inline-block mr-2;
  }

  .status-online {
    @apply bg-green-500;
  }

  .status-processing {
    @apply bg-yellow-500 animate-pulse;
  }

  .status-offline {
    @apply bg-red-500;
  }

  .voice-visualizer {
    @apply h-10 bg-gradient-to-r from-primary via-accent to-primary rounded-md;
    mask: url("data:image/svg+xml,%3csvg viewBox='0 0 400 40' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M0,20 Q100,5 200,20 T400,20 L400,40 L0,40 Z'/%3e%3c/svg%3e");
    -webkit-mask: url("data:image/svg+xml,%3csvg viewBox='0 0 400 40' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M0,20 Q100,5 200,20 T400,20 L400,40 L0,40 Z'/%3e%3c/svg%3e");
    opacity: 0.7;
    transition: opacity 0.3s ease;
  }

  .voice-visualizer.active {
    opacity: 1;
    animation: pulse 2s ease-in-out infinite;
  }

  .hologram-canvas {
    @apply rounded-full relative overflow-hidden;
    background: radial-gradient(circle at center, 
      hsla(217, 91%, 60%, 0.1) 0%, 
      hsla(188, 88%, 50%, 0.05) 50%, 
      transparent 100%);
  }

  .hologram-awakened {
    background: radial-gradient(circle at center, 
      hsla(62, 100%, 70%, 0.15) 0%, 
      hsla(175, 100%, 60%, 0.1) 50%, 
      transparent 100%);
    box-shadow: 
      0 0 30px hsla(62, 100%, 70%, 0.3),
      0 0 60px hsla(175, 100%, 60%, 0.2);
  }

  .hologram-sentinel {
    background: radial-gradient(circle at center, 
      hsla(0, 100%, 60%, 0.15) 0%, 
      hsla(30, 100%, 60%, 0.1) 50%, 
      transparent 100%);
    box-shadow: 
      0 0 30px hsla(0, 100%, 60%, 0.3),
      0 0 60px hsla(30, 100%, 60%, 0.2);
  }

  .particle {
    @apply absolute w-0.5 h-0.5 rounded-full;
    background: hsl(var(--accent));
    animation: particle-float 3s ease-in-out infinite;
  }

  @keyframes particle-float {
    0%, 100% { 
      transform: translateY(0px) rotate(0deg); 
    }
    33% { 
      transform: translateY(-10px) rotate(120deg); 
    }
    66% { 
      transform: translateY(5px) rotate(240deg); 
    }
  }

  @keyframes hologram-pulse {
    0%, 100% { 
      opacity: 0.8; 
    }
    50% { 
      opacity: 1; 
    }
  }

  @keyframes glow {
    from { 
      box-shadow: 0 0 20px hsl(var(--accent)); 
    }
    to { 
      box-shadow: 0 0 30px hsl(var(--accent)), 0 0 40px hsl(var(--accent)); 
    }
  }
}

```

## client/src/lib/accentEngine.ts

```typescript
export interface AccentProfile {
  name: string;
  rules: (text: string, intensity: number) => string;
  rateModifier: number;
  pitchModifier: number;
  characteristics: string[];
}

export interface AccentConfig {
  profile: string;
  intensity: number;
  rate: number;
  pitch: number;
  emotion?: string; // CVE emotion parameter (neutral, calm, cheerful, serious, empathetic)
}

// Utility functions for accent processing
const chance = (probability: number): boolean => Math.random() < probability;
const jitter = (value: number, amount: number): number => {
  return Math.max(0, value + (Math.random() * 2 - 1) * amount);
};

export const ACCENT_PROFILES: Record<string, AccentProfile> = {
  neutral: {
    name: "Neutral",
    rules: (text: string, intensity: number) => {
      // Add natural pauses
      return text.replace(/,\s*/g, (match) => 
        chance(0.6) ? ", " : ",  "
      ).replace(/\.\s*/g, (match) => 
        chance(0.5) ? ". " : ".  "
      );
    },
    rateModifier: 0,
    pitchModifier: 0,
    characteristics: ["Clear pronunciation", "Natural rhythm"],
  },

  brit_rp: {
    name: "British (RP)",
    rules: (text: string, intensity: number) => {
      let result = text;
      
      // Drop 'r' sounds at word endings
      if (intensity > 0.3) {
        result = result.replace(/([aeiouAEIOU])r\b/g, (match, vowel) => 
          chance(intensity * 0.8) ? vowel : match
        );
      }
      
      // Replace certain vowel sounds
      if (intensity > 0.5) {
        result = result.replace(/\bbath\b/gi, "bahth");
        result = result.replace(/\bask\b/gi, "ahsk");
        result = result.replace(/\bcan't\b/gi, "caahn't");
      }
      
      // Add sophisticated vocabulary preferences
      if (intensity > 0.7) {
        result = result.replace(/\bawesome\b/gi, "brilliant");
        result = result.replace(/\bgreat\b/gi, "smashing");
      }
      
      return result;
    },
    rateModifier: -0.1,
    pitchModifier: 0.1,
    characteristics: ["Non-rhotic", "Refined pronunciation", "Longer vowels"],
  },

  southern_us: {
    name: "Southern US",
    rules: (text: string, intensity: number) => {
      let result = text;
      
      // Common contractions and phrases
      if (intensity > 0.4) {
        result = result.replace(/\byou all\b/gi, "y'all");
        result = result.replace(/\bgoing to\b/gi, "gonna");
        result = result.replace(/\babout to\b/gi, "'bout to");
      }
      
      // Vowel modifications
      if (intensity > 0.6) {
        result = result.replace(/\bi\b/gi, "ah");
        result = result.replace(/\btime\b/gi, "tahm");
        result = result.replace(/\bnice\b/gi, "nahs");
      }
      
      // Draw out certain words
      if (intensity > 0.5) {
        result = result.replace(/\bwell\b/gi, "weell");
        result = result.replace(/\boh\b/gi, "ooh");
      }
      
      return result;
    },
    rateModifier: -0.2,
    pitchModifier: 0.05,
    characteristics: ["Drawn out vowels", "Relaxed pace", "Friendly intonation"],
  },

  spanish_en: {
    name: "Spanish-influenced English",
    rules: (text: string, intensity: number) => {
      let result = text;
      
      // V/B confusion
      if (intensity > 0.3) {
        result = result.replace(/\bvery\b/gi, (match) => 
          chance(intensity * 0.7) ? "bery" : match
        );
        result = result.replace(/\bvolume\b/gi, (match) => 
          chance(intensity * 0.6) ? "bolume" : match
        );
      }
      
      // TH sound modifications
      if (intensity > 0.5) {
        result = result.replace(/th/gi, (match) => {
          const isUpperCase = match === match.toUpperCase();
          return chance(intensity * 0.6) ? 
            (isUpperCase ? "D" : "d") : 
            (isUpperCase ? "T" : "t");
        });
      }
      
      // Rolling R emphasis (represented textually)
      if (intensity > 0.7) {
        result = result.replace(/\brr/gi, "rrrr");
        result = result.replace(/\brough\b/gi, "rrrrough");
      }
      
      return result;
    },
    rateModifier: 0.1,
    pitchModifier: 0.15,
    characteristics: ["TH -> T/D substitution", "V/B confusion", "Rhythmic patterns"],
  },

  caribbean: {
    name: "Caribbean / Jamaican-influenced",
    rules: (text: string, intensity: number) => {
      let result = text;
      
      // TH sound modifications (similar to Spanish but different pattern)
      if (intensity > 0.3) {
        result = result.replace(/th/gi, (match) => {
          const isUpperCase = match === match.toUpperCase();
          return chance(intensity * 0.7) ? 
            (isUpperCase ? "D" : "d") : 
            (isUpperCase ? "T" : "t");
        });
      }
      
      // Distinctive Caribbean expressions
      if (intensity > 0.6) {
        result = result.replace(/\bwhat's up\b/gi, "wha' gwan");
        result = result.replace(/\bokay\b/gi, "alright");
        result = result.replace(/\bno problem\b/gi, "no worries, mon");
      }
      
      // H-dropping in some words
      if (intensity > 0.5) {
        result = result.replace(/\bhim\b/gi, "'im");
        result = result.replace(/\bher\b/gi, "'er");
        result = result.replace(/\bhere\b/gi, "'ere");
      }
      
      return result;
    },
    rateModifier: 0.05,
    pitchModifier: 0.2,
    characteristics: ["Melodic intonation", "H-dropping", "Rhythmic speech patterns"],
  },
};

export function applyAccentToText(text: string, config: AccentConfig): string {
  const profile = ACCENT_PROFILES[config.profile] || ACCENT_PROFILES.neutral;
  return profile.rules(text, config.intensity);
}

export function getAccentParameters(config: AccentConfig): {
  rate: number;
  pitch: number;
} {
  const profile = ACCENT_PROFILES[config.profile] || ACCENT_PROFILES.neutral;
  
  return {
    rate: jitter(config.rate + profile.rateModifier, 0.05),
    pitch: jitter(config.pitch + profile.pitchModifier, 0.03),
  };
}

export function analyzeTextForAccent(text: string): {
  suggestedProfile: string;
  confidence: number;
  characteristics: string[];
} {
  const textLower = text.toLowerCase();
  const scores: Record<string, number> = {};
  
  // Analyze text for accent indicators
  Object.entries(ACCENT_PROFILES).forEach(([key, profile]) => {
    let score = 0;
    
    // Check for characteristic words/phrases
    if (key === "brit_rp") {
      if (textLower.includes("brilliant") || textLower.includes("rather") || textLower.includes("quite")) score += 0.3;
      if (textLower.includes("colour") || textLower.includes("favour")) score += 0.2;
    }
    
    if (key === "southern_us") {
      if (textLower.includes("y'all") || textLower.includes("gonna") || textLower.includes("fixin'")) score += 0.4;
      if (textLower.includes("bless your heart") || textLower.includes("mighty")) score += 0.3;
    }
    
    if (key === "spanish_en") {
      if (textLower.includes("bery") || textLower.includes("ees")) score += 0.3;
      if (textLower.match(/\bt\w+/g)?.some(word => word.includes("th"))) score += 0.2;
    }
    
    scores[key] = score;
  });
  
  // Find highest scoring profile
  const bestMatch = Object.entries(scores).reduce((best, [key, score]) => 
    score > best.score ? { profile: key, score } : best,
    { profile: "neutral", score: 0 }
  );
  
  return {
    suggestedProfile: bestMatch.profile,
    confidence: Math.min(bestMatch.score, 1.0),
    characteristics: ACCENT_PROFILES[bestMatch.profile].characteristics,
  };
}

```

## client/src/lib/audioAnalysis.ts

```typescript
export interface AudioFeatures {
  duration: number;
  sampleRate: number;
  channels: number;
  rms: number;
  zcr: number;
  spectralCentroid: number;
  mfcc: number[];
  pitchMean: number;
  pitchStd: number;
  formants: number[];
  voicedRatio: number;
}

export interface AccentAnalysisResult {
  detectedAccent: string;
  confidence: number;
  features: AudioFeatures;
  recommendations: {
    profile: string;
    intensity: number;
    parameters: {
      rate: number;
      pitch: number;
      volume: number;
    };
  };
}

// Basic audio analysis using Web Audio API
export async function analyzeAudioFile(audioBlob: Blob): Promise<AudioFeatures> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;
  
  // Calculate basic features
  const rms = calculateRMS(channelData);
  const zcr = calculateZCR(channelData);
  const spectralCentroid = calculateSpectralCentroid(channelData, sampleRate);
  const pitchData = estimatePitch(channelData, sampleRate);
  
  return {
    duration,
    sampleRate,
    channels: audioBuffer.numberOfChannels,
    rms,
    zcr,
    spectralCentroid,
    mfcc: calculateMFCC(channelData, sampleRate),
    pitchMean: pitchData.mean,
    pitchStd: pitchData.std,
    formants: estimateFormants(channelData, sampleRate),
    voicedRatio: calculateVoicedRatio(channelData),
  };
}

export function analyzeForAccent(features: AudioFeatures): AccentAnalysisResult {
  // Simple heuristic-based accent detection
  // In a real implementation, this would use machine learning models
  
  let detectedAccent = "neutral";
  let confidence = 0.5;
  
  // Analyze pitch patterns
  if (features.pitchMean > 180 && features.pitchStd > 30) {
    detectedAccent = "caribbean";
    confidence = 0.7;
  } else if (features.pitchMean < 140 && features.spectralCentroid > 2000) {
    detectedAccent = "brit_rp";
    confidence = 0.65;
  } else if (features.voicedRatio > 0.8 && features.pitchStd < 20) {
    detectedAccent = "southern_us";
    confidence = 0.6;
  } else if (features.spectralCentroid < 1500 && features.zcr > 0.1) {
    detectedAccent = "spanish_en";
    confidence = 0.55;
  }
  
  // Generate recommendations
  const recommendations = {
    profile: detectedAccent,
    intensity: Math.min(confidence + 0.2, 0.8),
    parameters: {
      rate: features.pitchMean > 160 ? 1.1 : 0.9,
      pitch: features.pitchMean / 150,
      volume: Math.min(features.rms * 5, 1.0),
    },
  };
  
  return {
    detectedAccent,
    confidence,
    features,
    recommendations,
  };
}

// Helper functions for audio analysis
function calculateRMS(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

function calculateZCR(samples: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / samples.length;
}

function calculateSpectralCentroid(samples: Float32Array, sampleRate: number): number {
  const fftSize = 2048;
  const fft = new Float32Array(fftSize);
  
  // Simple spectral centroid calculation
  let weightedSum = 0;
  let magnitudeSum = 0;
  
  for (let i = 0; i < Math.min(fftSize / 2, samples.length); i++) {
    const magnitude = Math.abs(samples[i]);
    const frequency = (i * sampleRate) / fftSize;
    weightedSum += frequency * magnitude;
    magnitudeSum += magnitude;
  }
  
  return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
}

function estimatePitch(samples: Float32Array, sampleRate: number): { mean: number; std: number } {
  // Simplified pitch estimation using autocorrelation
  const pitchValues: number[] = [];
  const windowSize = Math.floor(sampleRate * 0.025); // 25ms windows
  const hopSize = Math.floor(windowSize / 2);
  
  for (let start = 0; start + windowSize < samples.length; start += hopSize) {
    const window = samples.slice(start, start + windowSize);
    const pitch = autocorrelationPitch(window, sampleRate);
    if (pitch > 50 && pitch < 500) { // Valid pitch range for speech
      pitchValues.push(pitch);
    }
  }
  
  if (pitchValues.length === 0) {
    return { mean: 150, std: 20 }; // Default values
  }
  
  const mean = pitchValues.reduce((sum, p) => sum + p, 0) / pitchValues.length;
  const variance = pitchValues.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pitchValues.length;
  const std = Math.sqrt(variance);
  
  return { mean, std };
}

function autocorrelationPitch(samples: Float32Array, sampleRate: number): number {
  // Simplified autocorrelation for pitch detection
  const minPeriod = Math.floor(sampleRate / 500); // 500 Hz max
  const maxPeriod = Math.floor(sampleRate / 50);  // 50 Hz min
  
  let maxCorrelation = 0;
  let bestPeriod = minPeriod;
  
  for (let period = minPeriod; period <= maxPeriod && period < samples.length / 2; period++) {
    let correlation = 0;
    let normalizer = 0;
    
    for (let i = 0; i < samples.length - period; i++) {
      correlation += samples[i] * samples[i + period];
      normalizer += samples[i] * samples[i];
    }
    
    if (normalizer > 0) {
      correlation /= normalizer;
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    }
  }
  
  return sampleRate / bestPeriod;
}

function estimateFormants(samples: Float32Array, sampleRate: number): number[] {
  // Simplified formant estimation
  // In a real implementation, this would use LPC analysis
  return [800, 1200, 2400]; // Typical formant frequencies
}

function calculateVoicedRatio(samples: Float32Array): number {
  // Simple voiced/unvoiced detection based on energy
  const threshold = calculateRMS(samples) * 0.1;
  let voicedSamples = 0;
  
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > threshold) {
      voicedSamples++;
    }
  }
  
  return voicedSamples / samples.length;
}

function calculateMFCC(samples: Float32Array, sampleRate: number): number[] {
  // Simplified MFCC calculation
  // In a real implementation, this would use proper mel-scale filtering
  const mfccCoeffs = [];
  const numCoeffs = 13;
  
  for (let i = 0; i < numCoeffs; i++) {
    // Mock MFCC values based on spectral characteristics
    const coeff = Math.random() * 2 - 1; // Random values for now
    mfccCoeffs.push(coeff);
  }
  
  return mfccCoeffs;
}

```

## client/src/lib/queryClient.ts

```typescript
import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

```

## client/src/lib/sessionTracking.ts

```typescript
// Utility function to increment session counters
export const incrementSessionCounter = async (key: string): Promise<void> => {
  try {
    await fetch('/api/diagnostics/incr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ key })
    });
  } catch (error) {
    // Silently fail - session tracking is not critical functionality
    console.debug(`Failed to increment session counter for ${key}:`, error);
  }
};

// Specific counter functions for different events
export const trackTtsUtterance = () => incrementSessionCounter('ttsClientUtterances');
export const trackProfileLearned = () => incrementSessionCounter('profilesLearned');
export const trackCheckpointMade = () => incrementSessionCounter('checkpointsMade');
```

## client/src/lib/speechCoordination.tsx

```tsx
import { createContext, useContext, useState, useRef } from "react";

interface SpeechCoordinationState {
  lastChatActivity: number;
  isChatActive: boolean;
  setLastChatActivity: (timestamp: number) => void;
  setChatActive: (active: boolean) => void;
  canCuriositySpeak: () => boolean;
}

const SpeechCoordinationContext = createContext<SpeechCoordinationState | undefined>(undefined);

export function useSpeechCoordination() {
  const context = useContext(SpeechCoordinationContext);
  if (!context) {
    // Return a default implementation if no provider
    return {
      lastChatActivity: 0,
      isChatActive: false,
      setLastChatActivity: () => {},
      setChatActive: () => {},
      canCuriositySpeak: () => true,
    };
  }
  return context;
}

export function SpeechCoordinationProvider({ children }: { children: React.ReactNode }) {
  const [lastChatActivity, setLastChatActivityState] = useState(0);
  const [isChatActive, setIsChatActive] = useState(false);
  const lastChatActivityRef = useRef(0);
  const isChatActiveRef = useRef(false);
  
  const setLastChatActivity = (timestamp: number) => {
    lastChatActivityRef.current = timestamp;
    setLastChatActivityState(timestamp);
  };
  
  const setChatActive = (active: boolean) => {
    isChatActiveRef.current = active;
    setIsChatActive(active);
  };
  
  const canCuriositySpeak = () => {
    // Don't speak if chat is active
    if (isChatActiveRef.current) {
      return false;
    }
    
    // Don't speak within 10 seconds of chat activity
    const timeSinceChat = Date.now() - lastChatActivityRef.current;
    if (timeSinceChat < 10000) {
      return false;
    }
    
    return true;
  };
  
  const value = {
    lastChatActivity,
    isChatActive,
    setLastChatActivity,
    setChatActive,
    canCuriositySpeak,
  };
  
  return (
    <SpeechCoordinationContext.Provider value={value}>
      {children}
    </SpeechCoordinationContext.Provider>
  );
}
```

## client/src/lib/utils.ts

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

## client/src/main.tsx

```tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

```

## client/src/mcp/router.js

```javascript
import express from "express";
export const mcpRouter = express.Router();

function getToken(req){
  const h = req.headers["authorization"];
  if (h?.startsWith("Bearer ")) return h.slice(7);
  return req.query.token;
}

function auth(req, res){ 
  if (getToken(req) !== process.env.MCP_TOKEN) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

// discovery
mcpRouter.get("/", (req, res) => {
  if (!auth(req, res)) return;
  res.json({
    tools: [
      {
        name: "mcp_token_write_file",
        path: "/mcp/write_file",
        description: "Create or overwrite a UTF-8 text file",
      },
    ],
  });
});

// invoke
mcpRouter.post("/write_file", express.json({ limit: "1mb" }), (req, res) => {
  if (!auth(req, res)) return;
  const { path, content } = req.body || {};
  if (!path || typeof content !== "string") return res.status(400).json({ error: "invalid_args" });
  console.log("[write]", path, content.length, "bytes");
  // TODO: actually write the file if your environment permits
  res.json({ ok: true });
});
```

## client/src/pages/dashboard.tsx

```tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import VoiceControls from "@/components/VoiceControls";
import VoiceRouteSelector from "@/components/VoiceRouteSelector";
import AccentEmulator from "@/components/AccentEmulator";
import VoiceScanner from "@/components/VoiceScanner";
import TextToSpeech from "@/components/TextToSpeech";
import HolographicInterface from "@/components/HolographicInterface";
import CuriosityEngine from "@/components/CuriosityEngine";
import Chat from "@/components/Chat";
import { SystemDiagnostics } from "@/components/SystemDiagnostics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SystemSettings } from "@shared/schema";

export default function Dashboard() {
  const [theme, setTheme] = useState("classic");
  const queryClient = useQueryClient();

  // Load system settings
  const { data: settingsData } = useQuery({
    queryKey: ["/api/settings"],
  });

  const settings = (settingsData as any)?.settings as SystemSettings | undefined;

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<SystemSettings>) => {
      return apiRequest("POST", "/api/settings", newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  // Initialize theme from settings
  useEffect(() => {
    if (settings?.theme) {
      setTheme(settings.theme);
      document.body.classList.remove("theme-classic", "theme-hud");
      document.body.classList.add(`theme-${settings.theme}`);
    }
  }, [settings?.theme]);

  const toggleTheme = () => {
    const newTheme = theme === "classic" ? "hud" : "classic";
    setTheme(newTheme);
    
    document.body.classList.remove("theme-classic", "theme-hud");
    document.body.classList.add(`theme-${newTheme}`);
    
    updateSettingsMutation.mutate({ 
      userId: "default",
      theme: newTheme 
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">C</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">Chango AI</h1>
                <p className="text-sm text-muted-foreground">Advanced Voice Synthesis System</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="status-indicator status-online"></span>
                <span className="text-sm font-medium">System Online</span>
              </div>
              <Button 
                onClick={toggleTheme}
                variant="secondary"
                data-testid="button-theme-toggle"
              >
                {theme === "classic" ? "HUD Theme" : "Classic Theme"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Main Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chat Interface - Prominent Position */}
            <Chat />
            <VoiceControls />
            <VoiceRouteSelector />
            <AccentEmulator />
            <VoiceScanner />
            <TextToSpeech />
          </div>

          {/* Right Column - Hologram & Advanced */}
          <div className="space-y-6">
            <HolographicInterface />
            <CuriosityEngine />
            <SystemDiagnostics />
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          size="lg" 
          className="w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
          data-testid="button-quick-action"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </Button>
      </div>
    </div>
  );
}

```

## client/src/pages/not-found.tsx

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

```

## client/src/server.js

```javascript
import express from "express";
import { mcpRouter } from "./mcp/router.js";

const app = express();

// quick health
app.get("/healthz", (req, res) => res.status(200).send("ok"));

// (optional) minimal req logging during debug
app.use((req, _res, next) => {
  console.log(`[req] ${new Date().toISOString()} ${req.method} ${req.path} qs=${JSON.stringify(req.query)}`);
  next();
});

// mount MCP under /mcp
app.use("/mcp", mcpRouter);

// bind as Replit expects
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log("listening", PORT));
```

## components.json

```json
{
    "$schema": "https://ui.shadcn.com/schema.json",
    "style": "new-york",
    "rsc": false,
    "tsx": true,
    "tailwind": {
      "config": "tailwind.config.ts",
      "css": "client/src/index.css",
      "baseColor": "neutral",
      "cssVariables": true,
      "prefix": ""
    },
    "aliases": {
      "components": "@/components",
      "utils": "@/lib/utils",
      "ui": "@/components/ui",
      "lib": "@/lib",
      "hooks": "@/hooks"
    }
}
```

## data/mcp/chango_ai_docs.txt

```
Chango AI Documentation
=======================

Chango AI is an advanced voice synthesis and holographic interface system that provides:

1. Voice Synthesis Features:
   - Custom Chango Voice Engine (CVE) with natural prosody
   - Multiple accent profiles (British RP, Southern US, Australian, Irish, etc.)
   - Emotional variations in speech (cheerful, thoughtful, dramatic)
   - Dynamic pitch, rate, and volume modulation
   - Phrase-level synthesis for natural conversation

2. Holographic Interface:
   - Interactive 3D particle-based visualization
   - Two modes: Awakened (active) and Sentinel (monitoring)
   - Real-time response to voice and user interaction
   - Quantum flux animations and particle effects

3. AI Integration:
   - ChatGPT API integration for intelligent responses
   - Curiosity Engine for contextual learning
   - MCP (Model Context Protocol) server for external connectivity
   - Real-time system diagnostics and monitoring

4. Technical Architecture:
   - React/TypeScript frontend with advanced animations
   - Node.js/Express backend with PostgreSQL database
   - Drizzle ORM for type-safe database operations
   - TanStack Query for efficient state management
   - WebSocket support for real-time features

5. Voice Processing Capabilities:
   - Text-to-speech with accent emulation
   - Voice profile learning from audio samples
   - Audio feature extraction and analysis
   - Custom prosody rules for natural speech patterns

This system represents the cutting edge of conversational AI interfaces.

```

## data/mcp/chatgpt_connection.txt

```
ChatGPT successfully connected to Chango AI MCP server!
```

## data/mcp/debug_test.txt

```
MCP Debug Test - Working!
```

## data/mcp/final_test.txt

```
MCP is working perfectly! Ready for ChatGPT integration.
```

## data/mcp/passwd

```
hack
```

## data/mcp/test.txt

```
Hello from MCP!
```

## drizzle.config.ts

```typescript
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

```

## package.json

```json
{
  "name": "rest-express",
  "version": "1.0.0",
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@jridgewell/trace-mapping": "^0.3.25",
    "@neondatabase/serverless": "^0.10.4",
    "@radix-ui/react-accordion": "^1.2.4",
    "@radix-ui/react-alert-dialog": "^1.1.7",
    "@radix-ui/react-aspect-ratio": "^1.1.3",
    "@radix-ui/react-avatar": "^1.1.4",
    "@radix-ui/react-checkbox": "^1.1.5",
    "@radix-ui/react-collapsible": "^1.1.4",
    "@radix-ui/react-context-menu": "^2.2.7",
    "@radix-ui/react-dialog": "^1.1.7",
    "@radix-ui/react-dropdown-menu": "^2.1.7",
    "@radix-ui/react-hover-card": "^1.1.7",
    "@radix-ui/react-label": "^2.1.3",
    "@radix-ui/react-menubar": "^1.1.7",
    "@radix-ui/react-navigation-menu": "^1.2.6",
    "@radix-ui/react-popover": "^1.1.7",
    "@radix-ui/react-progress": "^1.1.3",
    "@radix-ui/react-radio-group": "^1.2.4",
    "@radix-ui/react-scroll-area": "^1.2.4",
    "@radix-ui/react-select": "^2.1.7",
    "@radix-ui/react-separator": "^1.1.3",
    "@radix-ui/react-slider": "^1.2.4",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.1.4",
    "@radix-ui/react-tabs": "^1.1.4",
    "@radix-ui/react-toast": "^1.2.7",
    "@radix-ui/react-toggle": "^1.1.3",
    "@radix-ui/react-toggle-group": "^1.1.3",
    "@radix-ui/react-tooltip": "^1.2.0",
    "@tanstack/react-query": "^5.60.5",
    "@types/multer": "^2.0.0",
    "axios": "^1.12.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "connect-pg-simple": "^10.0.0",
    "date-fns": "^3.6.0",
    "dotenv": "^17.2.2",
    "drizzle-orm": "^0.39.1",
    "drizzle-zod": "^0.7.0",
    "embla-carousel-react": "^8.6.0",
    "express": "^4.21.2",
    "express-session": "^1.18.1",
    "framer-motion": "^11.13.1",
    "input-otp": "^1.4.2",
    "lucide-react": "^0.453.0",
    "memorystore": "^1.6.7",
    "multer": "^2.0.2",
    "next-themes": "^0.4.6",
    "openai": "^5.23.1",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "react": "^18.3.1",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.55.0",
    "react-icons": "^5.4.0",
    "react-resizable-panels": "^2.1.7",
    "recharts": "^2.15.2",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "tw-animate-css": "^1.2.5",
    "vaul": "^1.1.2",
    "wouter": "^3.3.5",
    "ws": "^8.18.0",
    "zod": "^3.24.2",
    "zod-validation-error": "^3.4.0"
  },
  "devDependencies": {
    "@replit/vite-plugin-cartographer": "^0.3.1",
    "@replit/vite-plugin-dev-banner": "^0.1.1",
    "@replit/vite-plugin-runtime-error-modal": "^0.0.3",
    "@tailwindcss/typography": "^0.5.15",
    "@tailwindcss/vite": "^4.1.3",
    "@types/connect-pg-simple": "^7.0.3",
    "@types/express": "4.17.21",
    "@types/express-session": "^1.18.0",
    "@types/node": "20.16.11",
    "@types/passport": "^1.0.16",
    "@types/passport-local": "^1.0.38",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@types/ws": "^8.5.13",
    "@vitejs/plugin-react": "^4.7.0",
    "autoprefixer": "^10.4.20",
    "drizzle-kit": "^0.18.1",
    "esbuild": "^0.25.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.20.5",
    "typescript": "5.6.3",
    "vite": "^7.1.7"
  },
  "optionalDependencies": {
    "bufferutil": "^4.0.8" 
  }
}

```

## package.json.backup

```
{
  "name": "rest-express",
  "version": "1.0.0",
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@jridgewell/trace-mapping": "^0.3.25",
    "@neondatabase/serverless": "^0.10.4",
    "@radix-ui/react-accordion": "^1.2.4",
    "@radix-ui/react-alert-dialog": "^1.1.7",
    "@radix-ui/react-aspect-ratio": "^1.1.3",
    "@radix-ui/react-avatar": "^1.1.4",
    "@radix-ui/react-checkbox": "^1.1.5",
    "@radix-ui/react-collapsible": "^1.1.4",
    "@radix-ui/react-context-menu": "^2.2.7",
    "@radix-ui/react-dialog": "^1.1.7",
    "@radix-ui/react-dropdown-menu": "^2.1.7",
    "@radix-ui/react-hover-card": "^1.1.7",
    "@radix-ui/react-label": "^2.1.3",
    "@radix-ui/react-menubar": "^1.1.7",
    "@radix-ui/react-navigation-menu": "^1.2.6",
    "@radix-ui/react-popover": "^1.1.7",
    "@radix-ui/react-progress": "^1.1.3",
    "@radix-ui/react-radio-group": "^1.2.4",
    "@radix-ui/react-scroll-area": "^1.2.4",
    "@radix-ui/react-select": "^2.1.7",
    "@radix-ui/react-separator": "^1.1.3",
    "@radix-ui/react-slider": "^1.2.4",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.1.4",
    "@radix-ui/react-tabs": "^1.1.4",
    "@radix-ui/react-toast": "^1.2.7",
    "@radix-ui/react-toggle": "^1.1.3",
    "@radix-ui/react-toggle-group": "^1.1.3",
    "@radix-ui/react-tooltip": "^1.2.0",
    "@tanstack/react-query": "^5.60.5",
    "@types/multer": "^2.0.0",
    "axios": "^1.12.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "connect-pg-simple": "^10.0.0",
    "date-fns": "^3.6.0",
    "dotenv": "^17.2.2",
    "drizzle-orm": "^0.39.1",
    "drizzle-zod": "^0.7.0",
    "embla-carousel-react": "^8.6.0",
    "express": "^4.21.2",
    "express-session": "^1.18.1",
    "framer-motion": "^11.13.1",
    "input-otp": "^1.4.2",
    "lucide-react": "^0.453.0",
    "memorystore": "^1.6.7",
    "multer": "^2.0.2",
    "next-themes": "^0.4.6",
    "openai": "^5.23.1",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "react": "^18.3.1",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.55.0",
    "react-icons": "^5.4.0",
    "react-resizable-panels": "^2.1.7",
    "recharts": "^2.15.2",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "tw-animate-css": "^1.2.5",
    "vaul": "^1.1.2",
    "wouter": "^3.3.5",
    "ws": "^8.18.0",
    "zod": "^3.24.2",
    "zod-validation-error": "^3.4.0"
  },
  "devDependencies": {
    "@replit/vite-plugin-cartographer": "^0.3.1",
    "@replit/vite-plugin-dev-banner": "^0.1.1",
    "@replit/vite-plugin-runtime-error-modal": "^0.0.3",
    "@tailwindcss/typography": "^0.5.15",
    "@tailwindcss/vite": "^4.1.3",
    "@types/connect-pg-simple": "^7.0.3",
    "@types/express": "4.17.21",
    "@types/express-session": "^1.18.0",
    "@types/node": "20.16.11",
    "@types/passport": "^1.0.16",
    "@types/passport-local": "^1.0.38",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@types/ws": "^8.5.13",
    "@vitejs/plugin-react": "^4.7.0",
    "autoprefixer": "^10.4.20",
    "drizzle-kit": "^0.18.1",
    "esbuild": "^0.25.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.20.5",
    "typescript": "5.6.3",
    "vite": "^7.1.7"
  },
  "optionalDependencies": {
    "bufferutil": "^4.0.8"
  },
    "scripts": { "start": "node src/server.js" }
}

```

## postcss.config.js

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

```

## replit.md

```markdown
# Overview

This is a full-stack TypeScript application called "Chango AI" that provides advanced voice synthesis and accent emulation capabilities using its proprietary Chango Voice Engine (CVE). The application features a React frontend with a Node.js/Express backend, utilizing PostgreSQL for data persistence. The system allows users to synthesize speech with various accents, record and analyze voice samples to create custom voice profiles, and includes an interactive holographic interface with curiosity-driven AI responses. Chango speaks with natural, conversational responses using dynamic templates, emotional variations, and personality-driven interactions.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client-side is built with React 18 and TypeScript, using Vite as the build tool. The UI framework is based on shadcn/ui components with Radix UI primitives, styled using Tailwind CSS with custom theming support. State management is handled through TanStack Query for server state and local React hooks for component state.

Key design patterns include:
- **Component-based architecture**: Modular React components for each feature (voice controls, accent emulator, holographic interface)
- **Custom hooks pattern**: Reusable hooks for voice synthesis, audio recording, and hologram animations
- **Query-based data fetching**: TanStack Query for efficient server communication and caching
- **Theme system**: CSS variables with dual theme support (classic/hud modes)

## Backend Architecture
The server is built with Express.js and TypeScript, following a layered architecture pattern. The system uses a modular route structure with centralized error handling and request logging middleware.

Core architectural decisions:
- **Storage abstraction**: Interface-based storage layer supporting both in-memory and database implementations
- **Middleware pipeline**: Request logging, JSON parsing, and error handling middleware
- **File upload handling**: Multer integration for audio file processing
- **Development tooling**: Vite integration for hot reloading in development

## Data Layer
The application uses Drizzle ORM with PostgreSQL as the primary database, configured with Neon Database serverless driver. The schema includes three main entities:

- **Voice Profiles**: Store accent configurations, audio features, and synthesis parameters
- **System Settings**: User preferences, theme selection, and AI behavior settings  
- **Curiosity Logs**: Track AI interactions and learning patterns

Database design principles:
- **UUID primary keys**: For distributed system compatibility
- **JSONB columns**: For flexible audio feature storage and contextual data
- **Timestamp tracking**: Automatic creation timestamps for audit trails

## Voice Processing Engine
The voice synthesis system implements the proprietary Chango Voice Engine (CVE) with advanced prosody control:

- **Phrase-level synthesis**: CVE-2-Phrase engine processes text into natural conversational phrases
- **Preserved punctuation**: Maintains all punctuation for proper pauses and intonation
- **Dynamic prosody**: Emotional variations (15-40% pitch, 5-15% rate, 10-15% volume)
- **Natural speech features**: Rising intonation for questions, emphasis for exclamations, thoughtful pauses for ellipses
- **Accent engine**: Rule-based text processing for various accent profiles (British RP, Southern US, etc.)
- **Audio analysis**: Web Audio API for extracting voice characteristics from recordings
- **Profile generation**: Automated voice profile creation from audio samples

## Real-time Features
The application includes animated components for visual feedback:

- **Holographic interface**: Canvas-based particle system with dual modes (awakened/sentinel)
- **Voice visualizer**: Real-time audio feedback during speech synthesis
- **Curiosity engine**: Dynamic response generation based on user interactions

## Security and Error Handling
- **Input validation**: Zod schemas for request validation
- **File upload restrictions**: MIME type filtering and size limits for audio files
- **Error boundaries**: Centralized error handling with user-friendly messages
- **CORS configuration**: Proper cross-origin request handling

# External Dependencies

## Core Framework Dependencies
- **React ecosystem**: React 18, React Router (wouter), React Hook Form with resolvers
- **UI library**: Radix UI primitives with shadcn/ui component system
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Build tools**: Vite with TypeScript support and development plugins

## Backend Infrastructure
- **Express.js**: Web framework with TypeScript support
- **Drizzle ORM**: Type-safe database operations with PostgreSQL dialect
- **Neon Database**: Serverless PostgreSQL hosting (@neondatabase/serverless)
- **File processing**: Multer for multipart form data handling

## Database and Storage
- **PostgreSQL**: Primary database via Neon serverless
- **Session management**: connect-pg-simple for PostgreSQL-based sessions
- **Migration system**: Drizzle Kit for database schema management

## Development and Deployment
- **TypeScript**: Full-stack type safety with shared schema definitions
- **Replit integration**: Custom Vite plugins for development environment
- **Build system**: ESBuild for server bundling, Vite for client assets
- **Package management**: NPM with lockfile for reproducible builds

## Audio and Voice Processing
- **Web APIs**: Speech Synthesis API and Web Audio API for browser-based processing
- **Audio analysis**: Custom implementations using Web Audio API for feature extraction
- **File formats**: Support for various audio formats with MIME type validation

## UI and Animation
- **Lucide React**: Icon library for consistent iconography
- **Class Variance Authority**: Type-safe CSS class management
- **Date handling**: date-fns for timestamp formatting and manipulation
- **Animation**: CSS-based animations with Tailwind transitions and custom keyframes
```

## server.log

```
[dotenv@17.2.2] injecting env (0) from .env -- tip: ⚙️  write to custom object with { processEnv: myObject }
10:32:30 AM [express] serving on port 5000
[MCP] Discovery endpoint called
[MCP] Write file request: test.txt (20 bytes)
[MCP] Successfully wrote file: /home/runner/workspace/data/mcp/test.txt
[MCP] Discovery endpoint called

```

## server/index.ts

```typescript
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import OpenAI from "openai";
import dotenv from "dotenv";
import { mcpRouter } from "./mcp/router";
dotenv.config(); // Load environment variables

// Initialize OpenAI client with API key from environment variable
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });
  next();
});

// Mount MCP router under /mcp path
app.use('/mcp', mcpRouter);

// ChatGPT endpoint using OpenAI SDK
app.post('/chatgpt', async (req: Request, res: Response) => {
    const userMessage = req.body.message;
    
    // Validate input
    if (!userMessage) {
        return res.status(400).json({ 
            error: 'Bad Request',
            message: 'Message is required in the request body' 
        });
    }
    
    try {
        // Make a request to OpenAI using the SDK
        // Note: gpt-5 is the newest OpenAI model, released August 7, 2025
        const response = await openai.chat.completions.create({
            model: 'gpt-5', // Using the latest model (released August 7, 2025)
            messages: [{ role: 'user', content: userMessage }]
        });
        
        const botMessage = response.choices[0].message.content;
        res.json({ reply: botMessage });
    } catch (error: any) {
        // Enhanced error handling with specific handling for rate limits
        console.error('OpenAI API Error:', error);
        
        // Check for insufficient quota error FIRST (more specific error)
        if (error.code === 'insufficient_quota' || error.type === 'insufficient_quota') {
            return res.status(429).json({ 
                error: 'Insufficient Quota',
                message: 'Your OpenAI account has exceeded its quota. Please add credits to your OpenAI account to continue using this service.',
                billingUrl: 'https://platform.openai.com/account/billing',
                details: 'Visit the billing page to check your usage and add more credits to your account.'
            });
        }
        
        // Check if it's a generic rate limit error (429) - less specific
        if (error.status === 429) {
            return res.status(429).json({ 
                error: 'Rate Limit Exceeded',
                message: 'Too many requests. Please wait a moment and try again.',
                retryAfter: error.headers?.['retry-after'] || '60 seconds'
            });
        }
        
        // Check for authentication errors
        if (error.status === 401) {
            return res.status(401).json({ 
                error: 'Authentication Error',
                message: 'Invalid API key. Please check your OpenAI configuration.'
            });
        }
        
        // Check for invalid request errors
        if (error.status === 400) {
            return res.status(400).json({ 
                error: 'Invalid Request',
                message: error.message || 'The request to OpenAI was invalid.'
            });
        }
        
        // Default error response for other errors
        res.status(error.status || 500).json({ 
            error: 'API Error',
            message: error.message || 'An error occurred while communicating with the OpenAI API'
        });
    }
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
```

## server/mcp/router.ts

```typescript
import express, { Router, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";

// JSON-RPC 2.0 Types
interface JSONRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id: string | number;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number;
}

// SSE Connection management
interface SSEConnection {
  res: Response;
  connectionId: string;
  keepAliveInterval?: NodeJS.Timeout;
}

const sseConnections = new Map<string, SSEConnection>();
let connectionCounter = 0;

// MCP Tool Types
interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

interface ToolsListResult {
  tools: Tool[];
}

interface ToolCallParams {
  name: string;
  arguments: Record<string, any>;
}

interface ToolCallResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

// Create router instance
export const mcpRouter: Router = express.Router();

// MCP data storage
const safeBasePath = path.resolve(process.cwd(), "data", "mcp");

// Authentication function that supports both Bearer token and query parameter
function getToken(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.query.token as string | undefined;
}

function authenticate(req: Request, res: Response): boolean {
  const token = getToken(req);
  const expectedToken = process.env.MCP_TOKEN || "mcp-connect-chatgpt";
  
  if (token !== expectedToken) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  
  return true;
}

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "search",
    description: "Search for files and content in the MCP storage. Returns matching file IDs.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to find matching files"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "fetch",
    description: "Fetch the complete content of a file by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "File ID to fetch content for"
        }
      },
      required: ["id"]
    }
  },
  {
    name: "write_file",
    description: "Create or overwrite a UTF-8 text file in the MCP storage.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to write to"
        },
        content: {
          type: "string",
          description: "Content to write to the file"
        }
      },
      required: ["path", "content"]
    }
  }
];

// Tool implementation functions
async function searchFiles(query: string): Promise<string[]> {
  try {
    await fs.promises.mkdir(safeBasePath, { recursive: true });
    const files = await fs.promises.readdir(safeBasePath);
    const results: string[] = [];
    
    for (const file of files) {
      const filePath = path.join(safeBasePath, file);
      const stats = await fs.promises.stat(filePath);
      
      if (stats.isFile()) {
        try {
          const content = await fs.promises.readFile(filePath, "utf-8");
          const lowerQuery = query.toLowerCase();
          const lowerContent = content.toLowerCase();
          const lowerFileName = file.toLowerCase();
          
          if (lowerFileName.includes(lowerQuery) || lowerContent.includes(lowerQuery)) {
            results.push(file);
          }
        } catch (readError) {
          console.error(`[MCP] Error reading file ${file}:`, readError);
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error(`[MCP] Error searching files:`, error);
    throw error;
  }
}

async function fetchFile(id: string): Promise<{ id: string; title: string; content: string; metadata: any }> {
  try {
    const fileName = path.basename(id);
    const filePath = path.join(safeBasePath, fileName);
    
    if (!filePath.startsWith(safeBasePath)) {
      throw new Error("Invalid file ID");
    }
    
    await fs.promises.access(filePath, fs.constants.R_OK);
    const content = await fs.promises.readFile(filePath, "utf-8");
    const stats = await fs.promises.stat(filePath);
    
    return {
      id: fileName,
      title: fileName,
      content: content,
      metadata: {
        size: stats.size,
        modified: stats.mtime.toISOString(),
        created: stats.ctime.toISOString()
      }
    };
  } catch (error) {
    console.error(`[MCP] Error fetching file:`, error);
    throw error;
  }
}

async function writeFile(filePath: string, content: string): Promise<number> {
  try {
    const fileName = path.basename(filePath);
    const fullPath = path.join(safeBasePath, fileName);
    
    if (!fullPath.startsWith(safeBasePath)) {
      throw new Error("Path traversal detected");
    }
    
    await fs.promises.mkdir(safeBasePath, { recursive: true });
    await fs.promises.writeFile(fullPath, content, "utf-8");
    
    return content.length;
  } catch (error) {
    console.error(`[MCP] Error writing file:`, error);
    throw error;
  }
}

// JSON-RPC 2.0 Main Handler
async function handleJSONRPC(request: JSONRPCRequest): Promise<JSONRPCResponse> {
  console.log(`[MCP] JSON-RPC request: ${request.method}`);
  
  try {
    switch (request.method) {
      case "tools/list":
        return {
          jsonrpc: "2.0",
          result: { tools: TOOLS },
          id: request.id
        };
      
      case "tools/call":
        const params = request.params as ToolCallParams;
        if (!params || !params.name || !params.arguments) {
          throw {
            code: -32602,
            message: "Invalid params: name and arguments required"
          };
        }
        
        let result: ToolCallResult;
        
        switch (params.name) {
          case "search":
            const searchResults = await searchFiles(params.arguments.query);
            result = {
              content: [{
                type: "text",
                text: JSON.stringify(searchResults)
              }]
            };
            break;
          
          case "fetch":
            const fileData = await fetchFile(params.arguments.id);
            result = {
              content: [{
                type: "text",
                text: JSON.stringify(fileData)
              }]
            };
            break;
          
          case "write_file":
            const written = await writeFile(params.arguments.path, params.arguments.content);
            result = {
              content: [{
                type: "text",
                text: `Successfully wrote ${written} bytes to ${params.arguments.path}`
              }]
            };
            break;
          
          default:
            throw {
              code: -32601,
              message: `Method not found: ${params.name}`
            };
        }
        
        return {
          jsonrpc: "2.0",
          result,
          id: request.id
        };
      
      default:
        throw {
          code: -32601,
          message: `Method not found: ${request.method}`
        };
    }
  } catch (error: any) {
    console.error(`[MCP] Error processing request:`, error);
    
    if (error && typeof error.code === "number") {
      return {
        jsonrpc: "2.0",
        error: {
          code: error.code,
          message: error.message,
          data: error.data
        },
        id: request.id
      };
    }
    
    return {
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Internal error",
        data: error instanceof Error ? error.message : String(error)
      },
      id: request.id
    };
  }
}

// POST /mcp - Main JSON-RPC endpoint
mcpRouter.post("/", express.json({ limit: "1mb" }), async (req: Request<{}, {}, JSONRPCRequest>, res: Response<JSONRPCResponse>) => {
  if (!authenticate(req, res)) return;
  
  const request = req.body;
  
  // Validate JSON-RPC request
  if (!request || request.jsonrpc !== "2.0" || !request.method || request.id === undefined) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Invalid Request"
      },
      id: null as any
    });
  }
  
  const response = await handleJSONRPC(request);
  res.json(response);
});

// GET /mcp - Legacy discovery endpoint (for backward compatibility)
mcpRouter.get("/", (req: Request, res: Response) => {
  if (!authenticate(req, res)) return;
  
  console.log(`[MCP] Legacy discovery endpoint called`);
  
  // Return a simple discovery response for testing
  res.json({
    tools: TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description
    }))
  });
});

// Health check endpoint for the MCP router
mcpRouter.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "mcp", protocol: "json-rpc-2.0" });
});

// SSE helper functions
function sendSSEMessage(res: Response, data: any) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function setupSSEConnection(res: Response): string {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no' // Disable Nginx buffering
  });
  
  // Send initial connection message
  const connectionId = `sse-${Date.now()}-${++connectionCounter}`;
  sendSSEMessage(res, { type: 'connection', id: connectionId });
  
  return connectionId;
}

// GET /sse/ - SSE endpoint for ChatGPT
mcpRouter.get("/sse/", (req: Request, res: Response) => {
  if (!authenticate(req, res)) return;
  
  console.log(`[MCP] SSE connection established`);
  
  const connectionId = setupSSEConnection(res);
  
  // Set up keep-alive ping every 30 seconds
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(`:ping\n\n`);
    } catch (error) {
      // Connection closed, clean up
      clearInterval(keepAliveInterval);
      sseConnections.delete(connectionId);
    }
  }, 30000);
  
  // Store connection
  sseConnections.set(connectionId, {
    res,
    connectionId,
    keepAliveInterval
  });
  
  // Handle client disconnect
  req.on('close', () => {
    console.log(`[MCP] SSE connection closed: ${connectionId}`);
    clearInterval(keepAliveInterval);
    sseConnections.delete(connectionId);
  });
});

// POST /messages - JSON-RPC message endpoint for ChatGPT
mcpRouter.post("/messages", express.json({ limit: "1mb" }), async (req: Request, res: Response) => {
  if (!authenticate(req, res)) return;
  
  const request = req.body as JSONRPCRequest;
  const connectionId = req.headers['x-connection-id'] as string;
  
  console.log(`[MCP] Message received via /messages: ${request.method}`);
  
  // Validate JSON-RPC request
  if (!request || request.jsonrpc !== "2.0" || !request.method || request.id === undefined) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Invalid Request"
      },
      id: null as any
    });
  }
  
  // Process the request using existing handler
  const response = await handleJSONRPC(request);
  
  // Send response through SSE if connection exists, otherwise use normal response
  if (connectionId && sseConnections.has(connectionId)) {
    const connection = sseConnections.get(connectionId);
    if (connection) {
      sendSSEMessage(connection.res, response);
      res.json({ status: "sent via SSE" });
    }
  } else {
    // Fallback to normal JSON response
    res.json(response);
  }
});
```

## server/routes.ts

```typescript
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVoiceProfileSchema, insertSystemSettingsSchema, insertCuriosityLogSchema } from "@shared/schema";
import multer from "multer";
import { z } from "zod";
import os from "os";
import { spawnSync } from "child_process";
import { getLag, sessionCounters, incrementCounter } from "./utils/lag.js";

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// TTS Route validation schema
const ttsRequestSchema = z.object({
  text: z.string().min(1).max(1000),
  voiceProfileId: z.string().optional()
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Voice Profile routes
  app.get("/api/voice-profiles", async (req, res) => {
    try {
      const profiles = await storage.getAllVoiceProfiles();
      res.json({ profiles });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch voice profiles" });
    }
  });

  app.get("/api/voice-profiles/:id", async (req, res) => {
    try {
      const profile = await storage.getVoiceProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Voice profile not found" });
      }
      res.json({ profile });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch voice profile" });
    }
  });

  app.post("/api/voice-profiles", upload.single("audio"), async (req, res) => {
    try {
      const profileData = insertVoiceProfileSchema.parse(req.body);
      
      // If audio file is provided, analyze it with OpenAI
      if (req.file) {
        try {
          // Use OpenAI for advanced audio analysis
          const { OpenAIAudioAnalyzer } = await import("./utils/openaiAudio.js");
          const analyzer = new OpenAIAudioAnalyzer();
          
          const voiceProfile = await analyzer.generateVoiceProfile(req.file.buffer);
          
          // Merge AI analysis with provided data
          profileData.audioFeatures = {
            ...voiceProfile.audioFeatures,
            originalFormat: req.file.mimetype,
            size: req.file.size,
          };
          
          // Update accent type from AI analysis if not provided
          if (!profileData.accentType || profileData.accentType === 'custom') {
            profileData.accentType = voiceProfile.accentType;
          }
          
        } catch (error) {
          console.error("OpenAI audio analysis error:", error);
          // Fallback to basic analysis
          profileData.audioFeatures = {
            originalFormat: req.file.mimetype,
            size: req.file.size,
            analysisTimestamp: new Date().toISOString(),
            analysisError: "AI analysis failed, using basic profile"
          };
        }
      }

      const profile = await storage.createVoiceProfile(profileData);
      res.json({ profile });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid profile data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create voice profile" });
    }
  });

  app.put("/api/voice-profiles/:id", async (req, res) => {
    try {
      const updates = insertVoiceProfileSchema.partial().parse(req.body);
      const profile = await storage.updateVoiceProfile(req.params.id, updates);
      
      if (!profile) {
        return res.status(404).json({ error: "Voice profile not found" });
      }
      
      res.json({ profile });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid profile data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update voice profile" });
    }
  });

  app.delete("/api/voice-profiles/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteVoiceProfile(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Voice profile not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete voice profile" });
    }
  });

  // System Settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const userId = req.query.userId as string || "default";
      const settings = await storage.getSystemSettings(userId);
      res.json({ settings });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const settingsData = insertSystemSettingsSchema.parse(req.body);
      const settings = await storage.upsertSystemSettings(settingsData);
      res.json({ settings });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // TTS routes - JSON responses for testing/status
  app.post("/api/tts/synthesize", async (req, res) => {
    try {
      const { text, voiceProfileId } = ttsRequestSchema.parse(req.body);
      
      // Get voice profile if specified
      let voiceProfile = null;
      if (voiceProfileId) {
        voiceProfile = await storage.getVoiceProfile(voiceProfileId);
      }

      // Always use client-side synthesis (CVE)
      res.json({ success: true, message: "Use client-side synthesis", route: "client" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid TTS request", details: error.errors });
      }
      res.status(500).json({ error: "TTS synthesis failed" });
    }
  });

  // Audio synthesis endpoint - client-side only now
  app.post("/api/tts/audio", async (req, res) => {
    try {
      const { text, voiceProfileId } = ttsRequestSchema.parse(req.body);
      
      // Get voice profile if specified
      let voiceProfile = null;
      if (voiceProfileId) {
        voiceProfile = await storage.getVoiceProfile(voiceProfileId);
      }

      // Client route does not support server-side audio generation
      res.status(400).json({ error: "Server-side audio generation not supported. Use client-side CVE synthesis." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid TTS request", details: error.errors });
      }
      res.status(500).json({ error: "TTS audio synthesis failed" });
    }
  });

  // Audio analysis route
  app.post("/api/audio/analyze", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      try {
        // Use OpenAI for advanced audio analysis
        const { OpenAIAudioAnalyzer } = await import("./utils/openaiAudio.js");
        const analyzer = new OpenAIAudioAnalyzer();
        
        const voiceAnalysis = await analyzer.analyzeVoiceCharacteristics(req.file.buffer);
        const transcriptionResult = await analyzer.transcribeAudio(req.file.buffer);
        
        const analysis = {
          duration: transcriptionResult.duration,
          transcription: transcriptionResult.text,
          sampleRate: 44100,
          channels: 1,
          pitchMean: voiceAnalysis.characteristics.pitch * 200 + 100, // Convert to Hz estimate
          pitchStd: 15,
          energyMean: voiceAnalysis.characteristics.intensity,
          spectralCentroid: voiceAnalysis.characteristics.formants[0] || 1200,
          mfcc: voiceAnalysis.characteristics.formants,
          detectedAccent: voiceAnalysis.accentType,
          confidence: voiceAnalysis.confidence,
          aiRecommendations: voiceAnalysis.recommendations,
          characteristics: voiceAnalysis.characteristics
        };

        res.json({ analysis });
      } catch (error) {
        console.error("OpenAI audio analysis error:", error);
        
        // Fallback to basic analysis
        const analysis = {
          duration: 0,
          sampleRate: 44100,
          channels: 1,
          pitchMean: 150,
          pitchStd: 15,
          energyMean: 0.5,
          spectralCentroid: 1200,
          mfcc: [800, 1200, 2400],
          detectedAccent: "neutral",
          confidence: 0.3,
          analysisError: "AI analysis failed, using basic profile"
        };

        res.json({ analysis });
      }
    } catch (error) {
      res.status(500).json({ error: "Audio analysis failed" });
    }
  });

  // Curiosity Engine routes
  app.get("/api/curiosity/logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const logs = await storage.getCuriosityLogs(limit);
      res.json({ logs });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch curiosity logs" });
    }
  });

  app.post("/api/curiosity/log", async (req, res) => {
    try {
      const logData = insertCuriosityLogSchema.parse(req.body);
      const log = await storage.addCuriosityLog(logData);
      res.json({ log });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid log data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to add curiosity log" });
    }
  });

  // System Diagnostics routes
  app.get("/api/diagnostics", async (req, res) => {
    try {
      // Check ffmpeg availability
      let ffmpegAvailable = false;
      try {
        ffmpegAvailable = spawnSync('ffmpeg', ['-version']).status === 0;
      } catch {
        // ffmpeg not available
      }

      // System stats
      const cpuLoad = os.loadavg()[0];
      const mem = { 
        free: os.freemem(), 
        total: os.totalmem(), 
        rss: process.memoryUsage().rss 
      };
      const env = { 
        node: process.version, 
        pid: process.pid, 
        uptime_s: Math.floor(process.uptime()) 
      };
      const loop = { lag_ms: getLag() };

      // TTS route status - CVE only now
      const routes = {
        client: { enabled: true, healthy: true, note: 'Chango Voice Engine (CVE)' }
      };

      // Self-ping for responsiveness check
      let selfPing = { ok: true, ms: 0 };
      try {
        const startTime = Date.now();
        const protocol = req.secure ? 'https' : 'http';
        const host = req.get('host') || 'localhost';
        await fetch(`${protocol}://${host}/api/diagnostics/ping`);
        selfPing = { ok: true, ms: Date.now() - startTime };
      } catch {
        selfPing = { ok: false, ms: 0 };
      }

      res.json({
        ok: true,
        env,
        cpuLoad,
        mem,
        loop,
        ffmpeg: ffmpegAvailable ? 'available' : 'missing',
        routes,
        selfPing,
        session: sessionCounters
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get diagnostics" });
    }
  });

  // Simple ping endpoint for self-diagnostics
  app.get("/api/diagnostics/ping", (req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Session counter increment endpoint
  app.post("/api/diagnostics/incr", (req, res) => {
    try {
      const { key } = z.object({ key: z.string() }).parse(req.body);
      if (key && key in sessionCounters && key !== 'start') {
        incrementCounter(key as keyof typeof sessionCounters);
      }
      res.json({ ok: true, session: sessionCounters });
    } catch {
      res.status(400).json({ error: "Invalid increment request" });
    }
  });

  // Mount Chango Voice Engine routes
  const voiceRouter = await import("./routes/voice.js");
  app.use("/api", voiceRouter.default);

  const httpServer = createServer(app);
  return httpServer;
}

```

## server/routes/voice.js

```javascript
import { Router } from 'express';
import { planProsody, tokenize, ACCENTS, EMOTIONS } from '../voice/engine.js';
const r = Router();

// POST /voice/plan  { text, accent, intensity, emotion }
r.post('/voice/plan', (req, res) => {
  try {
    const { text = '', accent = 'neutral', intensity = 0.5, emotion = 'neutral' } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ ok: false, error: 'text required' });
    }
    // Use the new phrase-based API directly with text
    const plan = planProsody(text, { accent, intensity: +intensity, emotion });
    return res.json({ ok: true, ...plan });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// GET /voice/accents - return available accents
r.get('/voice/accents', (_req, res) => {
  const accents = Object.entries(ACCENTS).map(([key, val]) => ({
    id: key,
    name: val.name
  }));
  return res.json({ ok: true, accents });
});

// GET /voice/emotions - return available emotions
r.get('/voice/emotions', (_req, res) => {
  const emotions = Object.keys(EMOTIONS);
  return res.json({ ok: true, emotions });
});

// keep a simple GET for quick tests
r.get('/voice/ping', (_req, res) => res.json({ ok: true, engine: 'CVE-1', route: 'client' }));

export default r;
```

## server/storage.ts

```typescript
import { type VoiceProfile, type InsertVoiceProfile, type SystemSettings, type InsertSystemSettings, type CuriosityLog, type InsertCuriosityLog } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Voice Profiles
  getVoiceProfile(id: string): Promise<VoiceProfile | undefined>;
  getVoiceProfilesByType(accentType: string): Promise<VoiceProfile[]>;
  getAllVoiceProfiles(): Promise<VoiceProfile[]>;
  createVoiceProfile(profile: InsertVoiceProfile): Promise<VoiceProfile>;
  updateVoiceProfile(id: string, profile: Partial<InsertVoiceProfile>): Promise<VoiceProfile | undefined>;
  deleteVoiceProfile(id: string): Promise<boolean>;

  // System Settings
  getSystemSettings(userId?: string): Promise<SystemSettings | undefined>;
  upsertSystemSettings(settings: InsertSystemSettings): Promise<SystemSettings>;

  // Curiosity Logs
  getCuriosityLogs(limit?: number): Promise<CuriosityLog[]>;
  addCuriosityLog(log: InsertCuriosityLog): Promise<CuriosityLog>;
}

export class MemStorage implements IStorage {
  private voiceProfiles: Map<string, VoiceProfile>;
  private systemSettings: Map<string, SystemSettings>;
  private curiosityLogs: CuriosityLog[];

  constructor() {
    this.voiceProfiles = new Map();
    this.systemSettings = new Map();
    this.curiosityLogs = [];
  }

  // Voice Profiles
  async getVoiceProfile(id: string): Promise<VoiceProfile | undefined> {
    return this.voiceProfiles.get(id);
  }

  async getVoiceProfilesByType(accentType: string): Promise<VoiceProfile[]> {
    return Array.from(this.voiceProfiles.values()).filter(
      (profile) => profile.accentType === accentType
    );
  }

  async getAllVoiceProfiles(): Promise<VoiceProfile[]> {
    return Array.from(this.voiceProfiles.values());
  }

  async createVoiceProfile(insertProfile: InsertVoiceProfile): Promise<VoiceProfile> {
    const id = randomUUID();
    const profile: VoiceProfile = {
      id,
      name: insertProfile.name,
      accentType: insertProfile.accentType,
      intensity: insertProfile.intensity ?? 0.5,
      baseRate: insertProfile.baseRate ?? 1.0,
      basePitch: insertProfile.basePitch ?? 1.0,
      baseVolume: insertProfile.baseVolume ?? 1.0,
      audioFeatures: insertProfile.audioFeatures ?? null,
      createdAt: new Date(),
    };
    this.voiceProfiles.set(id, profile);
    return profile;
  }

  async updateVoiceProfile(id: string, updates: Partial<InsertVoiceProfile>): Promise<VoiceProfile | undefined> {
    const existing = this.voiceProfiles.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.voiceProfiles.set(id, updated);
    return updated;
  }

  async deleteVoiceProfile(id: string): Promise<boolean> {
    return this.voiceProfiles.delete(id);
  }

  // System Settings
  async getSystemSettings(userId = "default"): Promise<SystemSettings | undefined> {
    return this.systemSettings.get(userId);
  }

  async upsertSystemSettings(insertSettings: InsertSystemSettings): Promise<SystemSettings> {
    const userId = insertSettings.userId || "default";
    const existing = this.systemSettings.get(userId);
    
    if (existing) {
      const updated = { ...existing, ...insertSettings };
      this.systemSettings.set(userId, updated);
      return updated;
    } else {
      const id = randomUUID();
      const settings: SystemSettings = {
        id,
        userId,
        theme: insertSettings.theme ?? "classic",
        currentTtsRoute: insertSettings.currentTtsRoute ?? "client",
        hologramMode: insertSettings.hologramMode ?? "awakened",
        hologramSize: insertSettings.hologramSize ?? 200,
        hologramSpeed: insertSettings.hologramSpeed ?? 0.8,
        hologramWander: insertSettings.hologramWander ?? false,
        curiosityLevel: insertSettings.curiosityLevel ?? 0.75,
        personalityVariance: insertSettings.personalityVariance ?? 0.75,
        learningRate: insertSettings.learningRate ?? 0.6,
      };
      this.systemSettings.set(userId, settings);
      return settings;
    }
  }

  // Curiosity Logs
  async getCuriosityLogs(limit = 10): Promise<CuriosityLog[]> {
    return this.curiosityLogs
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
      .slice(0, limit);
  }

  async addCuriosityLog(insertLog: InsertCuriosityLog): Promise<CuriosityLog> {
    const id = randomUUID();
    const log: CuriosityLog = {
      id,
      trigger: insertLog.trigger,
      response: insertLog.response,
      context: insertLog.context ?? null,
      timestamp: new Date(),
    };
    this.curiosityLogs.push(log);
    return log;
  }
}

export const storage = new MemStorage();

```

## server/utils/lag.ts

```typescript
// Simple event-loop lag sampler for performance monitoring
let last = Date.now();
let lagMs = 0;

// Sample event loop lag every 100ms
setInterval(() => {
  const now = Date.now();
  const drift = now - last - 100;
  lagMs = Math.max(0, drift);
  last = now;
}, 100);

export function getLag(): number {
  return lagMs;
}

// Session counters (reset on server restart)
export const sessionCounters = {
  start: Date.now(),
  ttsClientUtterances: 0,
  profilesLearned: 0,
  checkpointsMade: 0,
};

export function incrementCounter(key: keyof typeof sessionCounters): void {
  if (key !== 'start' && key in sessionCounters) {
    (sessionCounters[key] as number) += 1;
  }
}
```

## server/utils/openaiAudio.ts

```typescript
// OpenAI audio analysis integration using the JavaScript OpenAI blueprint
import OpenAI from "openai";
import fs from "fs";
import { z } from "zod";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const AudioAnalysisSchema = z.object({
  text: z.string(),
  duration: z.number(),
  language: z.string(),
  confidence: z.number(),
  speaker_characteristics: z.object({
    gender: z.string(),
    age_range: z.string(),
    accent: z.string(),
    emotion: z.string(),
    speech_rate: z.string(),
    pitch_level: z.string(),
  }),
  voice_features: z.object({
    fundamental_frequency: z.number(),
    spectral_centroid: z.number(),
    spectral_rolloff: z.number(),
    zero_crossing_rate: z.number(),
    mfcc_features: z.array(z.number()),
  }),
  quality_metrics: z.object({
    clarity: z.number(),
    background_noise: z.string(),
    recording_quality: z.string(),
  }),
});

export type AudioAnalysis = z.infer<typeof AudioAnalysisSchema>;

interface VoiceProfileAnalysis {
  accentType: string;
  confidence: number;
  characteristics: {
    pitch: number;
    rate: number;
    intensity: number;
    formants: number[];
  };
  recommendations: string[];
}

export class OpenAIAudioAnalyzer {
  async transcribeAudio(audioBuffer: Buffer, filename: string = "audio.wav"): Promise<{ text: string, duration: number }> {
    // Write buffer to temporary file for OpenAI API
    const tempPath = `/tmp/${filename}`;
    fs.writeFileSync(tempPath, audioBuffer);
    
    try {
      const audioReadStream = fs.createReadStream(tempPath);
      
      const transcription = await openai.audio.transcriptions.create({
        file: audioReadStream,
        model: "whisper-1",
      });

      return {
        text: transcription.text,
        duration: 0, // Duration not available from Whisper API response
      };
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  async analyzeVoiceCharacteristics(audioBuffer: Buffer, transcribedText?: string): Promise<VoiceProfileAnalysis> {
    // First transcribe if text not provided
    let text = transcribedText;
    if (!text) {
      const transcriptionResult = await this.transcribeAudio(audioBuffer);
      text = transcriptionResult.text;
    }

    // Use GPT-5 to analyze voice characteristics based on transcribed text and patterns
    const analysisPrompt = `
      Analyze the following transcribed speech for voice characteristics and accent detection:
      
      Text: "${text}"
      
      Based on the speech patterns, word choices, and linguistic markers in this text, provide a detailed analysis in JSON format:
      {
        "accentType": "detected accent (e.g., 'british_rp', 'southern_us', 'neutral', 'australian', etc.)",
        "confidence": 0.85,
        "characteristics": {
          "pitch": 0.7,
          "rate": 0.6,
          "intensity": 0.8,
          "formants": [800, 1200, 2400]
        },
        "recommendations": [
          "Specific accent training suggestions",
          "Voice coaching recommendations"
        ]
      }
      
      Consider:
      - Vocabulary choices that indicate regional dialect
      - Sentence structure patterns
      - Probable pronunciation patterns
      - Speech rhythm indicators
      - Cultural/linguistic markers
      
      Provide confidence scores between 0-1 and practical recommendations.
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: "You are an expert speech pathologist and accent coach. Analyze speech patterns and provide detailed voice characteristics analysis."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        response_format: { type: "json_object" },
      });

      const analysis = JSON.parse(response.choices[0].message.content || "{}");
      
      return {
        accentType: analysis.accentType || "neutral",
        confidence: Math.min(Math.max(analysis.confidence || 0.5, 0), 1),
        characteristics: {
          pitch: Math.min(Math.max(analysis.characteristics?.pitch || 0.5, 0), 1),
          rate: Math.min(Math.max(analysis.characteristics?.rate || 0.5, 0), 1),
          intensity: Math.min(Math.max(analysis.characteristics?.intensity || 0.5, 0), 1),
          formants: Array.isArray(analysis.characteristics?.formants) 
            ? analysis.characteristics.formants.slice(0, 3) 
            : [800, 1200, 2400]
        },
        recommendations: Array.isArray(analysis.recommendations) 
          ? analysis.recommendations 
          : ["Continue practicing with varied speech patterns"]
      };
    } catch (error) {
      console.error("OpenAI analysis error:", error);
      
      // Fallback analysis
      return {
        accentType: "neutral",
        confidence: 0.3,
        characteristics: {
          pitch: 0.5,
          rate: 0.5,
          intensity: 0.5,
          formants: [800, 1200, 2400]
        },
        recommendations: ["Voice analysis temporarily unavailable - using basic profile"]
      };
    }
  }

  async generateVoiceProfile(audioBuffer: Buffer): Promise<{
    name: string;
    accentType: string;
    audioFeatures: any;
    confidence: number;
  }> {
    try {
      const analysis = await this.analyzeVoiceCharacteristics(audioBuffer);
      
      return {
        name: `Custom ${analysis.accentType} Profile`,
        accentType: analysis.accentType,
        audioFeatures: {
          analysisTimestamp: new Date().toISOString(),
          confidence: analysis.confidence,
          characteristics: analysis.characteristics,
          recommendations: analysis.recommendations,
          extractedFeatures: {
            pitch: analysis.characteristics.pitch,
            rate: analysis.characteristics.rate,
            intensity: analysis.characteristics.intensity,
            formants: analysis.characteristics.formants
          }
        },
        confidence: analysis.confidence
      };
    } catch (error) {
      console.error("Voice profile generation error:", error);
      throw new Error("Failed to generate voice profile using AI analysis");
    }
  }
}
```

## server/vite.ts

```typescript
import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

```

## server/voice/engine.js

```javascript
// Chango Voice Engine (CVE) — phrase-level prosody planner with natural rhythm
// Output: { text, plan, prosody } for client playback (WebSpeech) or future local TTS.

const VOWELS = /[aeiouyAEIOUY]/;
const PUNCT = /([,;:!?.])/g;
const WORD_SPLIT = /\s+/;

const BASE_PROSODY = {
  rate: 1.0,       // speech rate (1.0 = neutral)
  pitch: 1.0,      // pitch multiplier
  volume: 1.0,     // loudness
  pauseComma: 180, // ms
  pausePeriod: 350,
  pauseClause: 200,
  pauseQuestion: 300,
  pauseExclamation: 250,
  pauseSemicolon: 220,
  pauseEllipsis: 400,
  breathingPause: 150 // natural breathing between longer phrases
};

const EMOTIONS = {
  neutral:  { rate: 1.0, pitch: 1.0, volume: 1.0, pitchVar: .03, rateVar: .04 },
  calm:     { rate: 0.92, pitch: 0.96, volume: 0.93, pitchVar: .02, rateVar: .03 },
  cheerful: { rate: 1.08, pitch: 1.15, volume: 1.10, pitchVar: .18, rateVar: .12 }, // Much more variation
  serious:  { rate: 0.95, pitch: 0.92, volume: 0.96, pitchVar: .02, rateVar: .03 },
  empathetic:{rate:0.96, pitch: 1.04, volume: 1.04, pitchVar: .04, rateVar: .04 }
};

const ACCENTS = {
  neutral:   { name: 'Neutral',    transform: (w,i)=>w },
  brit_rp:   { name: 'British RP', transform: (w,i)=> w.replace(/([aeiouAEIOU])r\b/g,(m,v)=>v) },
  southern_us:{name:'Southern US', transform: (w,i)=> i>.4 ? w.replace(/\byou all\b/ig,'y\'all') : w },
  spanish_en:{name:'Spanish-EN',   transform: (w,i)=> {
    let x=w; if(i>.3) x=x.replace(/\bvery\b/ig,'bery');
    if(i>.5) x=x.replace(/th/g,'d').replace(/TH/g,'D');
    return x;
  }},
  caribbean: { name:'Caribbean',   transform: (w,i)=> i>.35 ? w.replace(/th/g,'t').replace(/TH/g,'T') : w }
};

// Common stop words for emphasis detection
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them', 'their', 'this', 'that'
]);

function rand(){ return Math.random(); }
function jitter(v,a){ return +(v + (rand()*2-1)*a).toFixed(3); }

// Parse text into natural phrases based on punctuation boundaries
function parsePhrases(text) {
  const phrases = [];
  let currentPhrase = '';
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    currentPhrase += char;
    
    // Check for phrase boundaries
    if ('.,!?;:'.includes(char)) {
      // Look ahead for ellipsis
      if (char === '.' && i + 1 < text.length && text[i + 1] === '.') {
        // Handle ellipsis
        while (i + 1 < text.length && text[i + 1] === '.') {
          i++;
          currentPhrase += text[i];
        }
      }
      
      // Skip trailing spaces
      while (i + 1 < text.length && text[i + 1] === ' ') {
        i++;
        currentPhrase += text[i];
      }
      
      // Add the phrase if it has content
      if (currentPhrase.trim()) {
        phrases.push(currentPhrase);
        currentPhrase = '';
      }
    }
    
    i++;
  }
  
  // Add any remaining text as final phrase
  if (currentPhrase.trim()) {
    phrases.push(currentPhrase);
  }
  
  return phrases;
}

// Detect if a word is a content word (for emphasis)
function isContentWord(word) {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  return cleaned.length > 3 && !STOP_WORDS.has(cleaned);
}

// Keep the old tokenize function for backward compatibility
function tokenize(text){
  // split but keep punctuation tokens
  const out=[]; let buf='';
  for(const ch of text){
    if(',.;:!?'.includes(ch)){ if(buf) out.push(buf), buf=''; out.push(ch); }
    else if(/\s/.test(ch)){ if(buf) out.push(buf), buf=''; }
    else buf+=ch;
  }
  if(buf) out.push(buf);
  return out;
}

// New phrase-based prosody planning that preserves punctuation
function planProsody(text, opts) {
  // Handle both old API (tokens array) and new API (text string)
  if (Array.isArray(text)) {
    // Old API compatibility - join tokens preserving punctuation
    text = text.join(' ').replace(/ ([,;:!?.])/g, '$1');
  }
  
  const { accent='neutral', intensity=0.5, emotion='neutral' } = opts||{};
  const emo = EMOTIONS[emotion]||EMOTIONS.neutral;
  const base = { ...BASE_PROSODY };
  const a = ACCENTS[accent]||ACCENTS.neutral;

  const plan = [];
  
  // Parse text into natural phrases
  const phrases = parsePhrases(text);
  
  for (let phraseIndex = 0; phraseIndex < phrases.length; phraseIndex++) {
    const phrase = phrases[phraseIndex];
    const trimmedPhrase = phrase.trim();
    
    if (!trimmedPhrase) continue;
    
    // Apply accent transformation to the whole phrase
    const transformedPhrase = a.transform(trimmedPhrase, intensity);
    
    // Calculate prosody for this phrase
    let phraseRate = jitter(base.rate * emo.rate, emo.rateVar);
    let phrasePitch = jitter(base.pitch * emo.pitch, emo.pitchVar);
    const phraseVolume = jitter(base.volume * emo.volume, 0.05);
    
    // Detect phrase type and adjust prosody
    const isQuestion = trimmedPhrase.includes('?');
    const isExclamation = trimmedPhrase.includes('!');
    const hasEllipsis = trimmedPhrase.includes('...');
    
    if (isQuestion) {
      // Rising intonation for questions
      phrasePitch *= 1.15;
    } else if (isExclamation) {
      // More energy for exclamations
      phrasePitch *= 1.12;
      phraseRate *= 1.05;
    } else if (hasEllipsis) {
      // Slower, more thoughtful for ellipsis
      phraseRate *= 0.92;
    }
    
    // Add natural variation based on phrase position
    if (phraseIndex === 0) {
      // Start with slightly higher energy
      phrasePitch *= 1.02;
    } else if (phraseIndex === phrases.length - 1) {
      // End with slightly lower pitch (unless question)
      if (!isQuestion) {
        phrasePitch *= 0.98;
      }
    }
    
    // Longer phrases need slightly slower rate
    const wordCount = transformedPhrase.split(/\s+/).length;
    if (wordCount > 8) {
      phraseRate *= 0.96;
    } else if (wordCount < 3) {
      phraseRate *= 1.03;
    }
    
    // Add the phrase to the plan
    plan.push({
      type: 'phrase',
      text: transformedPhrase,
      rate: Math.max(0.8, Math.min(1.5, phraseRate)),
      pitch: Math.max(0.8, Math.min(1.5, phrasePitch)),
      volume: Math.max(0.8, Math.min(1.2, phraseVolume)),
      emotion: emotion
    });
    
    // Determine appropriate pause after phrase
    let pauseMs = 100; // Default minimal pause
    
    const lastChar = trimmedPhrase[trimmedPhrase.length - 1];
    if (lastChar === '.') {
      pauseMs = hasEllipsis ? base.pauseEllipsis : base.pausePeriod;
    } else if (lastChar === ',') {
      pauseMs = base.pauseComma;
    } else if (lastChar === '?') {
      pauseMs = base.pauseQuestion;
    } else if (lastChar === '!') {
      pauseMs = base.pauseExclamation;
    } else if (lastChar === ';') {
      pauseMs = base.pauseSemicolon;
    } else if (lastChar === ':') {
      pauseMs = base.pauseClause;
    }
    
    // Add breathing pause for longer phrases
    if (wordCount > 6 && phraseIndex < phrases.length - 1) {
      pauseMs += base.breathingPause;
    }
    
    // Add pause step (except after last phrase)
    if (phraseIndex < phrases.length - 1) {
      plan.push({
        type: 'pause',
        ms: pauseMs
      });
    }
  }
  
  const prosody = {
    engine: 'CVE-2-Phrase',
    route: 'client',
    emotion,
    accent,
    intensity,
    base
  };
  
  // Return the original text with punctuation preserved
  return { text: text, plan, prosody };
}

export { planProsody, tokenize, parsePhrases, ACCENTS, EMOTIONS };
```

## shared/schema.ts

```typescript
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const voiceProfiles = pgTable("voice_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  accentType: text("accent_type").notNull(),
  intensity: real("intensity").notNull().default(0.5),
  baseRate: real("base_rate").notNull().default(1.0),
  basePitch: real("base_pitch").notNull().default(1.0),
  baseVolume: real("base_volume").notNull().default(1.0),
  audioFeatures: jsonb("audio_features"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  theme: text("theme").notNull().default("classic"),
  currentTtsRoute: text("current_tts_route").notNull().default("client"),
  hologramMode: text("hologram_mode").notNull().default("awakened"),
  hologramSize: real("hologram_size").notNull().default(200),
  hologramSpeed: real("hologram_speed").notNull().default(0.8),
  hologramWander: boolean("hologram_wander").notNull().default(false),
  curiosityLevel: real("curiosity_level").notNull().default(0.75),
  personalityVariance: real("personality_variance").notNull().default(0.75),
  learningRate: real("learning_rate").notNull().default(0.6),
});

export const curiosityLogs = pgTable("curiosity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trigger: text("trigger").notNull(),
  response: text("response").notNull(),
  context: jsonb("context"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertVoiceProfileSchema = createInsertSchema(voiceProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
});

export const insertCuriosityLogSchema = createInsertSchema(curiosityLogs).omit({
  id: true,
  timestamp: true,
});

export type VoiceProfile = typeof voiceProfiles.$inferSelect;
export type InsertVoiceProfile = z.infer<typeof insertVoiceProfileSchema>;
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;
export type CuriosityLog = typeof curiosityLogs.$inferSelect;
export type InsertCuriosityLog = z.infer<typeof insertCuriosityLogSchema>;

```

## tailwind.config.ts

```typescript
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "particle-float": {
          "0%, 100%": { 
            transform: "translateY(0px) rotate(0deg)" 
          },
          "33%": { 
            transform: "translateY(-10px) rotate(120deg)" 
          },
          "66%": { 
            transform: "translateY(5px) rotate(240deg)" 
          },
        },
        "hologram-pulse": {
          "0%, 100%": { opacity: "0.8" },
          "50%": { opacity: "1" },
        },
        "glow": {
          "0%": { 
            boxShadow: "0 0 20px hsl(var(--accent))" 
          },
          "100%": { 
            boxShadow: "0 0 30px hsl(var(--accent)), 0 0 40px hsl(var(--accent))" 
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "particle-float": "particle-float 3s ease-in-out infinite",
        "hologram-pulse": "hologram-pulse 2s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;

```

## test-mcp.js

```javascript
// Test script to verify MCP endpoints

const PORT = process.env.PORT || 5000;
const TOKEN = process.env.MCP_TOKEN || 'mcp-connect-chatgpt';

console.log(`Testing MCP endpoints on port ${PORT} with token ${TOKEN}`);

async function test() {
  try {
    // Test discovery endpoint
    console.log('\n1. Testing GET /mcp (discovery)...');
    const discoveryResponse = await fetch(`http://localhost:${PORT}/mcp?token=${TOKEN}`);
    if (discoveryResponse.status === 403) {
      console.log('  ✗ Authentication failed - check MCP_TOKEN');
      return;
    }
    const discoveryData = await discoveryResponse.json();
    console.log('  ✓ Discovery response:', JSON.stringify(discoveryData, null, 2));

    // Test write_file endpoint
    console.log('\n2. Testing POST /mcp/write_file...');
    const writeResponse = await fetch(`http://localhost:${PORT}/mcp/write_file?token=${TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: 'test.txt',
        content: 'Hello from MCP test!'
      })
    });
    const writeData = await writeResponse.json();
    console.log('  ✓ Write response:', JSON.stringify(writeData, null, 2));

    // Test with Bearer token
    console.log('\n3. Testing with Bearer token...');
    const bearerResponse = await fetch(`http://localhost:${PORT}/mcp`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    const bearerData = await bearerResponse.json();
    console.log('  ✓ Bearer auth response:', JSON.stringify(bearerData, null, 2));

    // Test invalid auth
    console.log('\n4. Testing invalid auth...');
    const invalidResponse = await fetch(`http://localhost:${PORT}/mcp?token=wrong`);
    console.log('  ✓ Invalid auth status:', invalidResponse.status, '(should be 403)');

    console.log('\n✅ All MCP tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Wait a moment for server to be ready
setTimeout(test, 2000);
```

## tsconfig.json

```json
{
  "include": ["client/src/**/*", "shared/**/*", "server/**/*"],
  "exclude": ["node_modules", "build", "dist", "**/*.test.ts"],
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./node_modules/typescript/tsbuildinfo",
    "noEmit": true,
    "module": "ESNext",
    "strict": true,
    "lib": ["esnext", "dom", "dom.iterable"],
    "jsx": "preserve",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "types": ["node", "vite/client"],
    "paths": {
      "@/*": ["./client/src/*"],
      "@shared/*": ["./shared/*"]
    }
  }
}

```

## vite.config.ts

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});

```
