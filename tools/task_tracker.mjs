#!/usr/bin/env node
/**
 * Master Task Tracker (autonomous)
 * Commands:
 *   init             ensure files exist
 *   append-queued    add queued block to TASK_MASTER_CURRENT.md (idempotent)
 *   sync-telemetry   merge HUD metrics into tasks
 *   scan             static file/API scan → coverage %
 *   render-md        refresh Auto Status table in TASK_MASTER_CURRENT.md
 *   audit            write TASK_AUDIT.md (dups, missing, stale)
 *   snapshot         write tasks/TASKS_SNAPSHOT_YYYY-MM-DD.json
 *   deps             validate tasks/deps.json (DAG) and missing refs
 *   weights          compute weighted progress per priority
 *   fix              auto-fix common inconsistencies (clamp %; ensure weight)
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";

const ROOT = process.cwd();
const FILE_MD     = path.join(ROOT, "TASK_MASTER_CURRENT.md");
const FILE_JSON   = path.join(ROOT, "tasks", "tasks.json");
const FILE_DEPS   = path.join(ROOT, "tasks", "deps.json");
const FILE_AUDIT  = path.join(ROOT, "TASK_AUDIT.md");
const AUTO_MARKER = "### Auto Status (tracker)";
const QUEUE_MARK  = "### Queued Tasks (auto-appended)";
const nowISO = () => new Date().toISOString();

function read(p, d=""){ try{ return fs.readFileSync(p, "utf8"); }catch{ return d; } }
function write(p, s){ fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s, "utf8"); }
function exists(p){ return fs.existsSync(p); }

function loadTasks(){
  const raw = read(FILE_JSON, ""); if(!raw) return { version:1, updated: nowISO(), tasks: [] };
  try { return JSON.parse(raw); } catch { return { version:1, updated: nowISO(), tasks: [] }; }
}
function saveTasks(obj){ obj.updated = nowISO(); write(FILE_JSON, JSON.stringify(obj, null, 2)); }

function fetchJSON(url){
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "cache-control":"no-store" }}, res => {
      let data=""; res.on("data", c=>data+=c);
      res.on("end", ()=>{ try{ resolve(JSON.parse(data)); }catch{ resolve(null); } });
    });
    req.on("error", ()=> resolve(null));
  });
}

function mdAutoStatus(tasks){
  const rows = tasks.map(t => `| ${t.layer} | P${t.priority} | ${t.status} | ${t.title} | ${Math.round(t.percent)}% | ${t.weight ?? 1} |`);
  return [
    `\n---\n`,
    `${AUTO_MARKER} — ${nowISO()}\n`,
    `| Layer | Priority | Status | Task | Progress | Weight |\n|---|:---:|:---:|---|---:|---:|\n`,
    rows.join("\n"),
    `\n`
  ].join("");
}

function cmd_init(){
  if(!exists(FILE_JSON)) write(FILE_JSON, read(path.join(ROOT,"tasks","tasks.json"), '{"version":1,"updated":"","tasks":[]}'));
  if(!exists(FILE_DEPS)) write(FILE_DEPS, read(path.join(ROOT,"tasks","deps.json"), '{"edges":[]}'));
  console.log("OK: init");
}

function cmd_appendQueued(){
  const md0 = read(FILE_MD, "");
  if (md0.includes(QUEUE_MARK)) { console.log("No changes: queued block already present."); return; }
  const block = [
    `\n---\n`,
    `${QUEUE_MARK} ${nowISO()}\n\n`,
    `#### Priority 2 : Voice & Audio\nStatus | Task | Description\n---|---|---\n`,
    `⏸ | Weather Skill Scaffold | Create \`client/chango/skills/weather.js\` using **local provider only** (no 3rd-party). Wire to intent: "weather", "forecast", "temperature". Offline placeholder first.\n\n`,
    `#### Priority 4 : Diagnostics & Monitoring\nStatus | Task | Description\n---|---|---\n`,
    `⏸ | Skills Manifest Validator | Add \`npm run skills:check\` to validate \`client/chango/skills/manifest.json\` and lint required exports (register or default intents).\n`
  ].join("");
  write(FILE_MD, md0 + (md0.endsWith("\n") ? "" : "\n") + block);
  console.log("OK: appended queued block.");
}

function cmd_syncTelemetry(){
  const url = process.env.HUD_URL || "http://localhost:3000/hud/status.json";
  console.log("Telemetry:", url);
  fetchJSON(url).then(json => {
    if(!json){ console.log("WARN: no telemetry"); return; }
    const t = loadTasks();
    for (const task of t.tasks){
      if (task.id === "voice-stability" && json.metrics?.voice_stability >= 0)
        task.percent = Math.max(task.percent, json.metrics.voice_stability);
      if (task.id === "stt-pipeline" && json.metrics?.stt_quality >= 0)
        task.percent = Math.max(task.percent, json.metrics.stt_quality);
      if (task.id === "debug-monitor"){
        const health = 100 - Math.min(100, (json.metrics?.errors||0)*10);
        task.percent = Math.max(task.percent, health);
      }
    }
    saveTasks(t);
    console.log("OK: telemetry merged.");
  });
}

function cmd_scan(){
  const t = loadTasks();
  for (const task of t.tasks){
    if (!task.files?.length) continue;
    let ok = 0;
    for (const rel of task.files){
      const p = path.join(ROOT, rel);
      if (!exists(p)) continue;
      const src = read(p, "");
      const pats =
        /bridge\.stt\.js$/.test(rel) ? [/SpeechRecognition|webkitSpeechRecognition/, /bus\.on\(/] :
        /vad\.js$/.test(rel)         ? [/start\(/, /stop\(/] :
        /monitor_tab_selftest\.js$/.test(rel) ? [/bus\.on\(/] :
        /contextPool\.js$/.test(rel) ? [/AudioContext|webkitAudioContext/] :
        [];
      const hit = pats.filter(r => r.test(src)).length;
      const score = pats.length ? Math.round(100 * hit / pats.length) : 100;
      if (score >= 80) ok++;
    }
    const coverage = Math.round(100 * ok / task.files.length);
    task.percent = Math.max(task.percent, coverage);
  }
  saveTasks(t);
  console.log("OK: static scan applied.");
}

function cmd_renderMD(){
  const t = loadTasks();
  const byPriority = [...t.tasks].sort((a,b)=> a.priority - b.priority || (b.weight??1)-(a.weight??1));
  const md0 = read(FILE_MD, "");
  const table = mdAutoStatus(byPriority);
  let out;
  if (md0.includes(AUTO_MARKER)){
    const head = md0.split(AUTO_MARKER)[0];
    out = head + table;
  } else {
    out = md0 + table;
  }
  write(FILE_MD, out);
  console.log("OK: Auto Status rendered.");
}

function cmd_deps(){
  const g = JSON.parse(read(FILE_DEPS, '{"edges":[]}'));
  const t = loadTasks();
  const ids = new Set(t.tasks.map(x=>x.id));
  const bad = g.edges.filter(([a,b]) => !ids.has(a) || !ids.has(b));
  if (bad.length){ console.warn("WARN: bad deps:", bad); }
  // cycle check (simple DFS)
  const adj = {};
  for (const [a,b] of g.edges){ (adj[a] ||= []).push(b); }
  const seen = new Set(), stack = new Set();
  let cycle = null;
  function dfs(u){
    if (stack.has(u)) { cycle = u; return; }
    if (seen.has(u)) return;
    seen.add(u); stack.add(u);
    for (const v of (adj[u]||[])) dfs(v);
    stack.delete(u);
  }
  for (const k of Object.keys(adj)){ dfs(k); if (cycle) break; }
  if (cycle) console.error("FAIL: dependency cycle detected at", cycle);
  else console.log("OK: deps DAG valid.");
}

function cmd_weights(){
  const t = loadTasks();
  const agg = {};
  for (const x of t.tasks){
    const key = `P${x.priority}`;
    const w = x.weight ?? 1;
    const contrib = w * (x.percent/100);
    const total = (agg[key]?.total ?? 0) + w;
    const done  = (agg[key]?.done  ?? 0) + contrib;
    agg[key] = { total, done };
  }
  const lines = Object.entries(agg).map(([k,v]) => `${k} weighted progress: ${Math.round(100* (v.done / v.total))}%`);
  console.log(lines.join("\n"));
}

function cmd_audit(){
  const t = loadTasks();
  const ids = t.tasks.map(x => x.id);
  const dups = ids.filter((x,i)=> ids.indexOf(x)!==i);
  const missing = [];
  for (const task of t.tasks){
    for (const f of (task.files||[])){
      if (!exists(path.join(ROOT, f))) missing.push({ id: task.id, file: f });
    }
  }
  const stale = t.tasks.filter(x => x.percent < 30 && x.status !== "⏸");
  const lines = [];
  lines.push(`# TASK AUDIT\n\nGenerated: ${nowISO()}\n`);
  lines.push(`## Duplicates\n\n${dups.length ? dups.join("\n") : "None"}\n`);
  lines.push(`\n## Missing Files\n\n${missing.length ? missing.map(m=>`- ${m.id}: \`${m.file}\``).join("\n") : "None"}\n`);
  lines.push(`\n## Stale (<30% but not paused)\n\n${stale.length ? stale.map(s=>`- P${s.priority} ${s.layer} — ${s.title} (${s.percent}%)`).join("\n") : "None"}\n`);
  write(FILE_AUDIT, lines.join(""));
  console.log("OK: TASK_AUDIT.md");
}

function cmd_snapshot(){
  const t = loadTasks();
  const name = `TASKS_SNAPSHOT_${new Date().toISOString().slice(0,10)}.json`;
  write(path.join(ROOT, "tasks", name), JSON.stringify(t, null, 2));
  console.log("OK:", name);
}

function cmd_fix(){
  const t = loadTasks();
  for (const x of t.tasks){
    if (typeof x.weight !== "number") x.weight = 1;
    if (x.percent < 0) x.percent = 0;
    if (x.percent > 100) x.percent = 100;
  }
  saveTasks(t);
  console.log("OK: fixed weights & clamped percent in tasks.json");
}

const cmd = process.argv[2] || "help";
if (cmd === "init") cmd_init();
else if (cmd === "append-queued") cmd_appendQueued();
else if (cmd === "sync-telemetry") cmd_syncTelemetry();
else if (cmd === "scan") cmd_scan();
else if (cmd === "render-md") cmd_renderMD();
else if (cmd === "audit") cmd_audit();
else if (cmd === "snapshot") cmd_snapshot();
else if (cmd === "deps") cmd_deps();
else if (cmd === "weights") cmd_weights();
else if (cmd === "fix") cmd_fix();
else console.log("Usage: node tools/task_tracker.mjs <init|append-queued|sync-telemetry|scan|render-md|audit|snapshot|deps|weights|fix>");