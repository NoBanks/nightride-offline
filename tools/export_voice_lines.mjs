// Writes every field card line as [{id, text}] for voice rendering. Run: node tools/export_voice_lines.mjs <out.json>
import fs from "node:fs";
import { CARDS } from "../src/brain/cards.js";

const spoken = (s) => s.replace(/\b911\b/g, "nine one one").replace(/\b988\b/g, "nine eight eight");

const lines = [
  { id: "open_got_it", text: "Got it. Let's work through this." },
  { id: "open_no_signal", text: "No signal. That's okay. I still work out here." },
  { id: "close_last_step", text: "That's the last step. Get home safe." },
];
for (const card of CARDS) {
  lines.push({ id: `${card.id}_say`, text: spoken(card.say) });
  if (card.pin) lines.push({ id: `${card.id}_pin`, text: spoken(card.pin.text) });
  card.steps.forEach((step, i) => lines.push({ id: `${card.id}_s${i + 1}`, text: spoken(step) }));
}
fs.writeFileSync(process.argv[2], JSON.stringify(lines, null, 1));
console.log(`${lines.length} lines, ${lines.reduce((n, l) => n + l.text.length, 0)} characters`);
