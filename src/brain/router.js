// The hybrid router. Pure logic: the model and the clock are injected, so tests run in Node.
// Order: guard, then model (on device or cloud, per the SDK), then field cards.

import { checkEmergency } from "./guard.js";
import { parseAnswer } from "./sanitize.js";
import { matchCard } from "./cards.js";

export const ROUTE = {
  GUARD: "guard",
  ON_DEVICE: "on_device",
  IN_CLOUD: "in_cloud",
  CARDS: "cards",
};

const fromCard = (text, reason, started, now) => {
  const card = matchCard(text);
  return { route: ROUTE.CARDS, reason, category: card.category, title: card.title, say: card.say, steps: card.steps, ms: now() - started };
};

// deps: { generate({prompt, image, mode}) -> {text, source}, now() }
export async function ask({ text, image = null, mode = "auto" }, deps) {
  const now = deps.now || Date.now;
  const started = now();

  const flagged = checkEmergency(text);
  if (flagged) {
    return { route: ROUTE.GUARD, kind: flagged, reason: "Matched before any model ran", ms: now() - started };
  }

  let out;
  try {
    out = await deps.generate({ prompt: withNotes(text), image, mode });
  } catch (err) {
    return fromCard(text, `No model answered: ${shortError(err)}`, started, now);
  }

  const answer = parseAnswer(out.text);
  if (!answer) return fromCard(text, "Model output failed the safety check", started, now);

  const route = out.source === "on_device" ? ROUTE.ON_DEVICE : ROUTE.IN_CLOUD;

  if (answer.category === "EMERGENCY") {
    return { route: ROUTE.GUARD, kind: "emergency", reason: `Model flagged an emergency (${route})`, ms: now() - started };
  }

  // The model promised something it cannot do and little is left: the card is better.
  if (!answer.say && answer.steps.length === 0) {
    return fromCard(text, "Model only offered help it cannot give", started, now);
  }

  const card = answer.steps.length ? null : matchCard(text);
  return {
    route,
    reason: reasonFor(route, mode, answer.removedClaims),
    category: answer.category,
    say: answer.say || card?.say || "",
    steps: answer.steps.length ? answer.steps : card.steps,
    ms: now() - started,
  };
}

// Nano invents parts (it told an e-bike rider to check the "fuse box"), so the matching
// field card goes in as trusted notes. Retrieval that works with no network at all.
export function withNotes(text) {
  const card = matchCard(text);
  if (card.id === "general") return text;
  const notes = card.steps.map((s) => `- ${s}`).join("\n");
  return `Trusted repair notes for "${card.title}":\n${notes}\n\nBase your steps on these notes. Do not add parts or tools the notes do not mention unless the rider did.\n\nThe rider says: ${text}`;
}

function reasonFor(route, mode, removed) {
  const base =
    route === ROUTE.ON_DEVICE
      ? mode === "device" ? "Forced on device" : "Nano was ready, nothing left this laptop"
      : mode === "cloud" ? "Forced to cloud" : "Nano not ready, used cloud Gemini";
  return removed ? `${base}. Removed a promise of outside help.` : base;
}

function shortError(err) {
  return String(err?.message || err || "unknown").replace(/\s+/g, " ").slice(0, 90);
}
