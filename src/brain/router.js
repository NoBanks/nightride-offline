// The hybrid router. Pure logic: the model and the clock are injected, so tests run in Node.
// Order: guard, then model (on device or cloud, per the SDK), then field cards.
// The model understands the rider and picks a vetted card. It only writes its own steps
// when no card fits at all.

import { checkEmergency } from "./guard.js";
import { parseAnswer } from "./sanitize.js";
import { CARDS, matchCard } from "./cards.js";

export const ROUTE = {
  GUARD: "guard",
  ON_DEVICE: "on_device",
  IN_CLOUD: "in_cloud",
  CARDS: "cards",
};

const MAX_STEPS = 8;
const MAX_STEP_CHARS = 140;

// Everything a vetted card shows, plus which recorded clip goes with each line.
function cardContent(card) {
  const pinned = withPin(card.steps, card);
  const stepClips = card.steps.map((_, i) => `${card.id}_s${i + 1}`);
  return {
    category: card.category,
    title: card.title,
    cardId: card.id,
    say: card.say,
    steps: pinned,
    clips: { say: `${card.id}_say`, steps: pinned.length > card.steps.length ? [`${card.id}_pin`, ...stepClips] : stepClips },
  };
}

const fromCard = (text, reason, started, now) => ({ route: ROUTE.CARDS, reason, ...cardContent(matchCard(text)), ms: now() - started });

// The rider knows better than any model. Used by "Wrong problem? Pick another".
export function chooseCard(id) {
  const card = CARDS.find((c) => c.id === id);
  return card ? { route: ROUTE.CARDS, reason: "Rider chose this card", ...cardContent(card), ms: 0 } : null;
}

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
    out = await deps.generate({ prompt: buildPrompt(text), image, mode });
  } catch (err) {
    return fromCard(text, `No model answered: ${shortError(err)}`, started, now);
  }

  const answer = parseAnswer(out.text);
  if (!answer) return fromCard(text, "Model output failed the safety check", started, now);

  const route = out.source === "on_device" ? ROUTE.ON_DEVICE : ROUTE.IN_CLOUD;

  // Nano called a snapped chain and a stolen bike emergencies, so only the guard's rules take
  // over the screen. A model's suspicion gets the right card plus a 911 bar that cannot be missed.
  const alert = answer.category === "EMERGENCY";

  const picked = CARDS.find((c) => c.id === answer.card);

  // The model promised something it cannot do and little is left: the card is better.
  if (!picked && !answer.say && answer.steps.length === 0) {
    return { ...fromCard(text, "Model only offered help it cannot give", started, now), alert };
  }

  // The model passed on every card, but the rider's words plainly match one.
  const matched = matchCard(text);
  const card = picked || (matched.id === "general" ? null : matched);
  if (card) {
    return {
      route,
      reason: reasonFor(route, mode, answer.removedClaims, picked ? "Model picked this card" : "Words matched this card"),
      ...cardContent(card),
      // Nano's own sentence said "This is an emergency" about a snapped chain and "Good." about
      // pouring rain, so the card speaks. Nano's words only show for what it sees in a photo.
      seen: image ? answer.say : "",
      alert,
      ms: now() - started,
    };
  }

  if (alert) {
    return { ...fromCard(text, "Model suspects danger and no card fits", started, now), say: "This could be serious. If it is, call now.", alert };
  }

  // No card fits. Nobody follows ten steps or a paragraph at the roadside, and shortening
  // the list could drop a step, so too long means the basic plan instead.
  if (answer.steps.length === 0 || answer.steps.length > MAX_STEPS || answer.steps.some((s) => s.length > MAX_STEP_CHARS)) {
    return fromCard(text, "Model answer was not usable at the roadside", started, now);
  }
  return {
    route,
    reason: reasonFor(route, mode, answer.removedClaims, "No card fits, model wrote these steps"),
    category: answer.category,
    say: answer.say || matched.say,
    steps: answer.steps,
    ms: now() - started,
  };
}

// Gemini Nano invents parts and bad advice when it writes repairs itself (a "fuse box" on an
// e-bike, "do not proceed until the road is dry"), so it chooses from vetted cards instead.
export function buildPrompt(text) {
  const list = CARDS.map((c) => `- ${c.id}: ${c.title}`).join("\n");
  return `Cards:\n${list}\n\nSet card to the one that best fits the rider's main problem. Set card to none only if no card fits. If you pick a card, leave steps empty.\nsay is one short sentence about this rider's specific situation, using only what they said.\n\nThe rider says: ${text}`;
}

// Some steps matter too much to leave out. A card can pin its key step to the top.
function withPin(steps, card) {
  if (!card.pin || steps.some((s) => card.pin.unless.test(s))) return steps;
  return [card.pin.text, ...steps];
}

function reasonFor(route, mode, removed, how) {
  const base =
    route === ROUTE.ON_DEVICE
      ? mode === "device" ? "Forced on device" : "Nano was ready, nothing left this laptop"
      : mode === "cloud" ? "Forced to cloud" : "Nano not ready, used cloud Gemini";
  return `${base}. ${how}.${removed ? " Removed a promise of outside help." : ""}`;
}

function shortError(err) {
  const text = String(err?.message || err || "unknown");
  const status = text.match(/\[(\d{3})\b/)?.[1];
  if (status === "429") return "cloud quota reached";
  if (status) return `cloud error ${status}`;
  if (/fetch|network|offline/i.test(text)) return "no connection to the cloud";
  return text.replace(/https?:\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 70);
}
