const fs = require('fs');
const path = require('path');

// Try to load archiver, but make it optional
let archiver;
try {
  archiver = require('archiver');
} catch (e) {
  console.log('[Warning] archiver package not installed. Checkpoint zip creation will not be available.');
}

async function zipPaths(outPath, paths){
  if (!archiver) {
    throw new Error('archiver package is not installed. Please install it with: npm install archiver');
  }
  
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