// Copies the picked take of every card line into public/voice as mp3 and writes the manifest the app precaches.
// Run: node tools/install_voice.mjs <session_dir> <ffmpeg.exe>
// session_dir holds manifest.json ({lines: {id: {takes: [{file, take}]}}}) and picks.json ({id: take}).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { CARDS, FALLBACK } from "../src/brain/cards.js";

const [session, ffmpeg] = process.argv.slice(2);
const man = JSON.parse(fs.readFileSync(path.join(session, "manifest.json"), "utf8"));
const picks = JSON.parse(fs.readFileSync(path.join(session, "picks.json"), "utf8"));
const out = path.join(import.meta.dirname, "..", "public", "voice");
fs.mkdirSync(out, { recursive: true });

const wanted = [];
for (const card of [...CARDS, FALLBACK]) {
  wanted.push(`${card.id}_say`);
  if (card.pin) wanted.push(`${card.id}_pin`);
  card.steps.forEach((_, i) => wanted.push(`${card.id}_s${i + 1}`));
}

const installed = [];
const missing = [];
for (const id of wanted) {
  const take = man.lines[id]?.takes.find((t) => String(t.take) === String(picks[id]));
  if (!take) { missing.push(id); continue; }
  execFileSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", path.join(session, take.file),
    "-ac", "1", "-ar", "24000", "-codec:a", "libmp3lame", "-b:a", "64k", path.join(out, `${id}.mp3`)], { windowsHide: true });
  installed.push(id);
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(installed));
const kb = installed.reduce((n, id) => n + fs.statSync(path.join(out, `${id}.mp3`)).size, 0) / 1024;
console.log(`installed ${installed.length} of ${wanted.length} clips, ${Math.round(kb)} KB; missing: ${missing.join(", ") || "none"}`);
