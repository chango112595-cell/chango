#!/usr/bin/env node
/**
 * Validates client/chango/skills/manifest.json and each skill module:
 * - manifest JSON exists, has "skills": []
 * - each path is reachable
 * - each module exports register({ registerIntent, bus }) OR default intents[]
 */
import fs from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, "client", "chango", "skills", "manifest.json");

function fail(msg){ console.error("FAIL:", msg); process.exitCode = 1; }
function ok(msg){ console.log("OK:", msg); }

function main(){
  if (!fs.existsSync(MANIFEST)) { fail("manifest.json missing"); return; }
  const raw = fs.readFileSync(MANIFEST, "utf8");
  let json; try { json = JSON.parse(raw); } catch { fail("manifest.json not valid JSON"); return; }
  if (!Array.isArray(json.skills)) { fail("manifest.skills must be an array"); return; }
  ok(`manifest has ${json.skills.length} skills`);
  const missing = [];
  for (const rel of json.skills){
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) missing.push(rel);
    else ok(`found ${rel}`);
  }
  if (missing.length){ fail("missing modules:\n - " + missing.join("\n - ")); }
  // Static export check by simple regex (JS only heuristic)
  let exportWarn = false;
  for (const rel of json.skills){
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    if (!/export\s+function\s+register\s*\(/.test(src) && !/export\s+default\s*\[/.test(src)){
      console.warn("WARN: no register() or default intents[] in", rel);
      exportWarn = true;
    }
  }
  if (!exportWarn) ok("all skills expose register() or default intents[]");
}
main();