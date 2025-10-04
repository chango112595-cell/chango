const fs = require('fs');
const path = require('path');

function appendJSONL(file, obj){
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.appendFileSync(file, JSON.stringify(obj)+'\n', 'utf8');
}
function readJSONL(file){
  if(!fs.existsSync(file)) return [];
  return fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(l=>{ try{return JSON.parse(l)}catch{return null} }).filter(Boolean);
}
module.exports = { appendJSONL, readJSONL };