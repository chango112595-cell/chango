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