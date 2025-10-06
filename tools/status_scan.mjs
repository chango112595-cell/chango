#!/usr/bin/env node
/**
 * Gap Report Validator: scans codebase for required modules/APIs and appends an Auto Status section.
 * Safe: does not overwrite your manual tables; appends at the end with timestamp.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
const write = (p, s) => fs.writeFileSync(p, s, "utf8");
const append = (p, s) => fs.appendFileSync(p, s, "utf8");
const stamp = () => new Date().toISOString();

const EXPECT = {
  "Core Systems": {
    "Voice System Stability Audit": [
      "client/src/chango/core/state.js",
      "client/src/chango/audio/contextPool.js",
      "client/src/chango/audio/vad.js",
      "client/src/chango/stt/webspeech.js"
    ],
    "Microphone Permission Validator": [
      "client/src/chango/audio/vad.js"
    ],
    "Hybrid Core Logging System": [
      "client/src/chango/diag/monitor.js"
    ]
  },
  "Voice & Audio": {
    "STT Pipeline Integration": [
      "client/src/chango/stt/webspeech.js"
    ],
    "Natural Response Engine": [
      "client/src/chango/tts/prosody.js",
      "client/src/chango/accent/engine.js"
    ],
    "Advanced Voice Program": [
      "client/src/chango/tts/formantSynth.js",
      "server/cli/tts_render.mjs"
    ],
    "Wake Word (Lolo)": [
      "client/src/chango/wakeword/detector.js"
    ],
    "Hands-Free Mode Control": [
      "client/src/chango/audio/vad.js"
    ],
    "Mute / Unmute System": [
      "client/src/chango/audio/contextPool.js"
    ]
  },
  "User Interface": {
    "HUD Sphere System": [],
    "Responsive UI Refactor": [
      "client/src/chango/core/device.js"
    ],
    "UI Safe Zones": [
      "client/src/chango/ui/adapter.js"
    ]
  },
  "Diagnostics & Monitoring": {
    "Global Debug Monitor": [
      "client/src/chango/diag/monitor.js"
    ],
    "Auto-Heal Mechanism": [
      "client/src/chango/diag/autoHeal.js"
    ],
    "Priority Event Filter": [
      "client/src/chango/diag/monitor.js"
    ]
  },
  "Knowledge & Core Memory": {
    "Historical Knowledge Feed": [],
    "Temporal Awareness": []
  },
  "Security & Failsafes": {
    "Manual Override (Mute / Pause)": [
      "client/src/chango/ui/adapter.js"
    ],
    "Voice Recognition Security": [
      "client/src/chango/audio/mfcc.js"
    ]
  }
};

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function checkExports(src, patterns) {
  if (!src) return 0;
  let score = 0, total = patterns.length;
  for (const re of patterns) if (re.test(src)) score++;
  return total ? (score / total) : 1;
}

function scan() {
  const results = [];
  for (const [layer, tasks] of Object.entries(EXPECT)) {
    for (const [task, files] of Object.entries(tasks)) {
      if (!files.length) {
        results.push({ layer, task, coverage: 0, files: [], notes: "no files required (manual)" });
        continue;
      }
      let ok = 0; const entries = [];
      for (const f of files) {
        const found = fileExists(f);
        let apiScore = 0;
        if (found) {
          const src = read(path.join(ROOT, f));
          // minimal API checks by file:
          const pats = /formantSynth/.test(f) ? [/class\s+FormantSynth/]
                    : /vad\.js$/.test(f) ? [/class\s+VAD/, /start\(/, /stop\(/]
                    : /contextPool\.js$/.test(f) ? [/class\s+AudioContextPool/]
                    : /webspeech\.js$/.test(f) ? [/class\s+WebSpeechSTT/]
                    : /prosody\.js$/.test(f) ? [/prosodyPlan\(/]
                    : /engine\.js$/.test(f) ? [/accentize\(/]
                    : /detector\.js$/.test(f) ? [/class\s+WakeWordDetector/]
                    : /monitor\.js$/.test(f) ? [/class\s+Monitor/]
                    : /device\.js$/.test(f) ? [/export\s+const\s+device/]
                    : /mfcc\.js$/.test(f) ? [/class\s+MFCC/]
                    : /tts_render\.mjs$/.test(f) ? [/writeWav\(/]
                    : [];
          apiScore = checkExports(src, pats);
        }
        entries.push({ file: f, exists: found, apiScore });
        if (found && apiScore >= 0.8) ok++;
      }
      const coverage = Math.round((ok / files.length) * 100);
      results.push({ layer, task, coverage, files: entries, notes: "" });
    }
  }
  return results;
}

function toMarkdown(results) {
  let md = `# GAP REPORT\n\nGenerated: ${stamp()}\n\n`;
  const groups = {};
  for (const r of results) (groups[r.layer] ||= []).push(r);
  for (const [layer, arr] of Object.entries(groups)) {
    md += `## ${layer}\n\n| Task | Coverage | Notes |\n|---|---:|---|\n`;
    for (const r of arr) {
      md += `| ${r.task} | ${r.coverage}% | ${r.notes || ""} |\n`;
      for (const ent of r.files) {
        md += `| ↳ \`${ent.file}\` | ${ent.exists ? Math.round(ent.apiScore*100)+'%' : 'missing'} | |\n`;
      }
    }
    md += `\n`;
  }
  return md;
}

function appendAutoStatus(results) {
  const dest = path.join(ROOT, "TASK_MASTER_CURRENT.md");
  const md0 = read(dest) || "";
  const lines = [];
  lines.push("\n---\n");
  lines.push(`### Auto Status (scan) — ${stamp()}\n`);
  lines.push("| Layer | Task | Coverage |\n|---|---|---:|\n");
  for (const r of results) lines.push(`| ${r.layer} | ${r.task} | ${r.coverage}% |`);
  const out = md0 + lines.join("\n") + "\n";
  write(dest, out);
}

(function main(){
  const results = scan();
  const report = toMarkdown(results);
  const outPath = path.join(ROOT, "GAP_REPORT.md");
  write(outPath, report);
  appendAutoStatus(results);
  console.log(`Wrote GAP_REPORT.md and appended Auto Status to TASK_MASTER_CURRENT.md`);
})();