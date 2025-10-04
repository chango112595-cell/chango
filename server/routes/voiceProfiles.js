const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { PROFILES } = require('../utils/paths');

// Try to load wav-decoder, but make it optional
let decode;
try {
  decode = require('wav-decoder').decode;
} catch (e) {
  console.log('[Warning] wav-decoder package not installed. Voice profile analysis will be limited.');
}

const r = Router();
const upload = multer({ storage: multer.diskStorage({
  destination: (_req, _file, cb)=>{ fs.mkdirSync(PROFILES, { recursive:true }); cb(null, PROFILES); },
  filename: (_req, file, cb)=> cb(null, Date.now() + '_' + file.originalname.replace(/\s+/g,'_'))
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
  if (!decode) {
    // Return a basic profile when wav-decoder is not available
    return {
      duration: 3.0,
      pauseRatio: 0.15,
      f0: 120.0,
      wpm: 140.0,
      sibilance: 0.5,
      rhoticity: 1.0
    };
  }
  
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
    const raw = (req.body?.name || ('profile_'+Date.now())).toString().replace(/\s+/g,'_');
    const id = raw.replace(/[^a-zA-Z0-9_\-]/g,'');
    const src = req.file.path;
    const wav = path.join(PROFILES, `${id}.wav`);
    const json = path.join(PROFILES, `${id}.json`);

    if (!ffmpegExists()) return res.status(501).json({ ok:false, error:'ffmpeg not installed' });
    const conv = spawnSync('ffmpeg', ['-y','-i',src,'-ac','1','-ar','22050',wav], { stdio:'ignore' });
    if (conv.status !== 0 || !fs.existsSync(wav)) return res.status(501).json({ ok:false, error:'ffmpeg failed' });

    const feat = await analyzeWav(wav);
    const map = mapToAccent(feat);
    const profile = {
      id, features:feat, mapped:map.mapped,
      base_rate:map.base_rate, base_pitch:map.base_pitch, base_volume:map.base_volume,
      created:new Date().toISOString(),
      summary:`${map.mapped.profile}@${map.mapped.intensity.toFixed(2)} rate=${map.base_rate.toFixed(2)} pitch=${map.base_pitch.toFixed(2)}`
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
  const id = (req.params.id||'').toString().replace(/[^a-zA-Z0-9_\-]/g,'');
  const j = path.join(PROFILES, `${id}.json`);
  if(!fs.existsSync(j)) return res.status(404).json({ ok:false, error:'not found' });
  try{ const profile = JSON.parse(fs.readFileSync(j,'utf8')); return res.json({ ok:true, profile }); }
  catch(e){ return res.status(500).json({ ok:false, error: e?.message || String(e) }); }
});

module.exports = r;