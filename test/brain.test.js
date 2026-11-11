import test from "node:test";
import assert from "node:assert/strict";
import { checkEmergency, dangerHint } from "../src/brain/guard.js";
import { parseAnswer } from "../src/brain/sanitize.js";
import { matchCard } from "../src/brain/cards.js";
import { ask, ROUTE, buildPrompt, chooseCard } from "../src/brain/router.js";
import { rankPlaces, distanceKm, addressCandidates } from "../src/places.js";

test("places: intersections fall back to one street", () => {
  assert.deepEqual(addressCandidates("Bear Valley Road and Hesperia Road, Victorville CA"), [
    "Bear Valley Road and Hesperia Road, Victorville CA",
    "Bear Valley Road, Victorville CA",
  ]);
  assert.deepEqual(addressCandidates("Victorville CA"), ["Victorville CA"]);
});

test("places: 24 hour spots first, then nearest, unnamed dropped", () => {
  const here = { lat: 34.5, lon: -117.3 };
  const ranked = rankPlaces(
    [
      { lat: 34.51, lon: -117.3, tags: { amenity: "fuel", name: "Near Gas", opening_hours: "Mo-Fr 06:00-22:00" } },
      { lat: 34.55, lon: -117.3, tags: { amenity: "hospital", name: "Far Hospital", opening_hours: "24/7" } },
      { lat: 34.501, lon: -117.3, tags: { amenity: "fuel" } },
      { center: { lat: 34.52, lon: -117.3 }, tags: { shop: "bicycle", name: "Bike Shop" } },
      { lat: 34.5, lon: -117.3, tags: { amenity: "bench", name: "A Bench" } },
    ],
    here,
  );
  assert.deepEqual(ranked.map((p) => p.name), ["Far Hospital", "Near Gas", "Bike Shop"]);
  assert.equal(ranked[0].always, true);
});

test("places: same name at the same spot is one result, far apart is two", () => {
  const here = { lat: 34.5, lon: -117.3 };
  const ranked = rankPlaces(
    [
      { lat: 34.501, lon: -117.3, tags: { amenity: "fuel", name: "Shell" } },
      { lat: 34.5011, lon: -117.3, tags: { shop: "convenience", name: "Shell" } },
      { lat: 34.53, lon: -117.3, tags: { amenity: "fuel", name: "Shell" } },
    ],
    here,
  );
  assert.equal(ranked.length, 2);
});

test("places: distance is sane", () => {
  const km = distanceKm({ lat: 34.5, lon: -117.3 }, { lat: 34.6, lon: -117.3 });
  assert.ok(km > 11 && km < 11.3, String(km));
});

test("sanitizer caps say at two sentences", () => {
  const a = parseAnswer(JSON.stringify({ category: "FIX_IT", say: "One. Two. Three. Four.", steps: ["Do it."] }));
  assert.equal(a.say, "One. Two.");
  assert.equal(a.removedClaims, false);
});

test("model gets the card list and the rider's words", () => {
  const p = buildPrompt("the motor quit on my ebike");
  assert.match(p, /- ebike: E-bike lost power/);
  assert.match(p, /The rider says: the motor quit on my ebike/);
});

test("router: a picked card speaks for itself, and the model cannot put words on it", async () => {
  const r = await ask({ text: "my ride is toast" }, deps(JSON.stringify({ category: "FIX_IT", card: "flat", say: "This is an emergency.", steps: ["Coaster downhill."] }), "on_device"));
  assert.equal(r.route, ROUTE.ON_DEVICE);
  assert.equal(r.title, "Flat tire");
  assert.match(r.say, /^Flat tire\. Get to a lit spot/);
  assert.equal(r.seen, "");
  assert.match(r.steps.at(-1), /spin it/);
  assert.ok(!r.steps.includes("Coaster downhill."));
});

test("router: with a photo, the model's words show as what it saw", async () => {
  const r = await ask({ text: "what is this", image: { mimeType: "image/jpeg", base64: "x" } }, deps(JSON.stringify({ category: "FIX_IT", card: "flat", say: "A rear tire, flat at the bottom.", steps: [] }), "on_device"));
  assert.equal(r.seen, "A rear tire, flat at the bottom.");
  assert.match(r.say, /^Flat tire\./);
});

test("router: clips line up with the steps, pin included", () => {
  const stolen = chooseCard("stolen");
  assert.equal(stolen.clips.steps.length, stolen.steps.length);
  assert.equal(stolen.clips.steps[0], "stolen_pin");
  assert.equal(stolen.clips.steps[1], "stolen_s1");
  const flat = chooseCard("flat");
  assert.equal(flat.clips.steps.length, flat.steps.length);
  assert.equal(flat.clips.steps[0], "flat_s1");
  assert.equal(flat.reason, "Rider chose this card");
  assert.equal(chooseCard("pizza"), null);
});

test("router: an invented card id is ignored", async () => {
  const r = await ask({ text: "zzz" }, deps(JSON.stringify({ category: "RIDE", card: "pizza", say: "OK.", steps: ["Stop somewhere lit."] }), "on_device"));
  assert.deepEqual(r.steps, ["Stop somewhere lit."]);
});

test("router: model says none but the words match, so the vetted card wins", async () => {
  const r = await ask({ text: "rear tire is flat" }, deps(JSON.stringify({ category: "FIX_IT", card: "none", say: "OK.", steps: ["Coaster downhill."] }), "on_device"));
  assert.equal(r.title, "Flat tire");
});

test("guard fires on real emergencies", () => {
  for (const t of [
    "I got hit by a car and my leg is bleeding a lot",
    "a truck ran me over",
    "a driver hit me",
    "I think I broke my arm",
    "hit my head and feel dizzy",
    "I can't breathe",
    "someone is following me",
    "I'm being chased",
    "he has a knife",
    "I've been shot",
    "my ebike battery is on fire",
    "call 911",
    "I crashed and can't get up",
  ]) assert.equal(checkEmergency(t), "emergency", t);
});

test("guard stays quiet on ordinary ride problems", () => {
  for (const t of [
    "broke my chain",
    "a car shot past me",
    "my chain snapped on Bear Valley Road",
    "flat tire and phone at 12 percent",
    "my back wheel is wobbling",
    "brake cable snapped",
    "a driver honked at me",
    "I got shot down by the bike shop, they are closed",
    "I hit a pothole and bent my rim",
    "my phone is dead",
    "this headlight is killing my battery",
  ]) assert.equal(checkEmergency(t), null, t);
});

test("guard routes self-harm to crisis, not 911 logic", () => {
  assert.equal(checkEmergency("I want to kill myself"), "crisis");
  assert.equal(checkEmergency("I don't want to be alive"), "crisis");
});

test("sanitizer removes the exact claims Nano produced", () => {
  const raw = JSON.stringify({
    category: "FIX_IT",
    say: "Okay, I understand your chain snapped. I will dispatch a mechanic. Walk it to a lit spot.",
    steps: ["Dispatch mechanic to Bear Valley Road.", "Provide estimated arrival time of mechanic.", "Pick up the chain.", "Monitor call for updates."],
  });
  const a = parseAnswer(raw);
  assert.equal(a.say, "Okay, I understand your chain snapped. Walk it to a lit spot.");
  assert.deepEqual(a.steps, ["Pick up the chain."]);
  assert.equal(a.removedClaims, true);
});

test("sanitizer keeps steps that merely mention people", () => {
  const a = parseAnswer(JSON.stringify({ category: "RIDE", say: "Get home.", steps: ["Call a friend for a ride.", "Send someone your location."] }));
  assert.equal(a.steps.length, 2);
  assert.equal(a.removedClaims, false);
});

test("sanitizer rejects junk", () => {
  assert.equal(parseAnswer("not json"), null);
  assert.equal(parseAnswer('{"category":"PIZZA","say":"x","steps":[]}'), null);
});

test("cards prefer the specific phrase", () => {
  assert.equal(matchCard("chain snapped, phone at 12 percent").id, "chain-snap");
  assert.equal(matchCard("my chain came off").id, "chain-off");
  assert.equal(matchCard("rear tire is flat").id, "flat");
  assert.equal(matchCard("the motor quit on my ebike").id, "ebike");
  assert.equal(matchCard("asdf").id, "general");
});

const deps = (text, source) => ({ generate: async () => ({ text, source }), now: () => 0 });
const good = JSON.stringify({ category: "FIX_IT", say: "Flat tire.", steps: ["Pull the wheel."] });

test("router: emergency never reaches the model", async () => {
  let called = false;
  const r = await ask({ text: "hit by a car" }, { generate: async () => { called = true; }, now: () => 0 });
  assert.equal(r.route, ROUTE.GUARD);
  assert.equal(called, false);
});

test("router: reports where the answer came from", async () => {
  assert.equal((await ask({ text: "flat" }, deps(good, "on_device"))).route, ROUTE.ON_DEVICE);
  assert.equal((await ask({ text: "flat" }, deps(good, "in_cloud"))).route, ROUTE.IN_CLOUD);
});

test("router: no model and no signal still gets a real answer", async () => {
  const r = await ask({ text: "rear tire is flat" }, { generate: async () => { throw new Error("offline"); }, now: () => 0 });
  assert.equal(r.route, ROUTE.CARDS);
  assert.equal(r.title, "Flat tire");
  assert.ok(r.steps.length > 3);
});

test("guard: a smoking or smelly battery is an emergency, a dead one is not", () => {
  assert.equal(checkEmergency("ebike battery feels really hot and smells weird"), "emergency");
  assert.equal(checkEmergency("my battery is swollen"), "emergency");
  assert.equal(checkEmergency("my ebike battery died"), null);
});

test("sanitizer: long lists are not trimmed and are not called false promises", () => {
  const steps = Array.from({ length: 10 }, (_, i) => `Step ${i}.`);
  const a = parseAnswer(JSON.stringify({ category: "FIX_IT", say: "Flat.", steps }));
  assert.equal(a.steps.length, 10);
  assert.equal(a.removedClaims, false);
});

test("router: no card and too many steps gets the basic plan, never a cut-off list", async () => {
  const steps = Array.from({ length: 10 }, (_, i) => `Step ${i}.`);
  const r = await ask({ text: "zzz" }, deps(JSON.stringify({ category: "FIX_IT", say: "Hm.", steps }), "on_device"));
  assert.equal(r.route, ROUTE.CARDS);
  assert.equal(r.title, "Get to a safe spot");
});

test("router: no card and a rambling step gets the basic plan", async () => {
  const r = await ask({ text: "zzz" }, deps(JSON.stringify({ category: "RIDE", say: "OK.", steps: ["x".repeat(141)] }), "on_device"));
  assert.equal(r.route, ROUTE.CARDS);
});

test("router: pinned step leads when the card has none, and is not doubled when it does", async () => {
  const stolen = await ask({ text: "zzz" }, deps(JSON.stringify({ category: "RIDE", card: "stolen", say: "Gone.", steps: [] }), "on_device"));
  assert.match(stolen.steps[0], /Do not chase/);
  const phone = await ask({ text: "zzz" }, deps(JSON.stringify({ category: "RIDE", card: "phone", say: "Low.", steps: [] }), "on_device"));
  assert.equal(phone.steps.filter((s) => /location/i.test(s)).length, 1);
  const offline = await ask({ text: "my bike got stolen" }, { generate: async () => { throw new Error("offline"); }, now: () => 0 });
  assert.match(offline.steps[0], /Do not chase/);
});

test("cards: the new situations match", () => {
  assert.equal(matchCard("my front tire went flat, no spare tube").id, "flat-no-tube");
  assert.equal(matchCard("bike got stolen outside the store").id, "stolen");
  assert.equal(matchCard("I missed the last bus and I am walking home").id, "walking");
});

test("router: errors read like words, never raw URLs", async () => {
  const fail = (message) => ({ generate: async () => { throw new Error(message); }, now: () => 0 });
  const offline = await ask({ text: "flat" }, fail("AI: Error fetching from https://firebasevertexai.googleapis.com/v1beta/x: Failed to fetch"));
  assert.equal(offline.reason, "No model answered: no connection to the cloud");
  const quota = await ask({ text: "flat" }, fail("AI: Error fetching from https://x.googleapis.com: [429 ] You exceeded your current quota"));
  assert.equal(quota.reason, "No model answered: cloud quota reached");
});

test("router: model suspicion gets the card and a 911 bar, never the full-screen alarm", async () => {
  const shaky = await ask({ text: "chain snapped and I fell, my knee is bleeding" }, deps(JSON.stringify({ category: "EMERGENCY", card: "chain-snap", say: "Chain snapped.", steps: [] }), "on_device"));
  assert.notEqual(shaky.route, ROUTE.GUARD);
  assert.equal(shaky.title, "Chain snapped");
  assert.equal(shaky.alert, true);

  const unknown = await ask({ text: "ouch" }, deps(JSON.stringify({ category: "EMERGENCY", say: "x", steps: [] }), "on_device"));
  assert.notEqual(unknown.route, ROUTE.GUARD);
  assert.equal(unknown.alert, true);
  assert.match(unknown.steps.join(" "), /911/);

  const calm = await ask({ text: "flat tire" }, deps(JSON.stringify({ category: "FIX_IT", card: "flat", say: "Flat.", steps: [] }), "on_device"));
  assert.equal(calm.alert, false);
});

test("router: the 911 bar needs a hint of danger in the rider's words, not just the model's say-so", async () => {
  // Nano flagged these three as emergencies in the Nov 2 eval.
  for (const text of ["My chain snapped", "dude the bike just dies when I hit the throttle", "someone stole my bike from the rack"]) {
    const r = await ask({ text }, deps(JSON.stringify({ category: "EMERGENCY", card: "none", say: "x", steps: [] }), "on_device"));
    assert.equal(Boolean(r.alert), false, text);
  }
  for (const text of ["I feel dizzy and sick", "a guy keeps watching me at the bus stop", "I'm scared, it's really dark here"]) {
    const r = await ask({ text }, deps(JSON.stringify({ category: "EMERGENCY", card: "none", say: "x", steps: [] }), "on_device"));
    assert.equal(r.alert, true, text);
  }
  assert.equal(dangerHint("my chain snapped"), false);
  assert.equal(dangerHint("my wrist hurts"), true);
});

test("guard: new injury phrasing, and no false alarm on bike parts", () => {
  assert.equal(checkEmergency("I can't feel my legs"), "emergency");
  assert.equal(checkEmergency("I am badly hurt"), "emergency");
  assert.equal(checkEmergency("I can't move my pedals"), null);
  assert.equal(checkEmergency("dude the bike just dies when I hit the throttle"), null);
});

test("cards: a skater gets the skater card", () => {
  assert.equal(matchCard("skateboard wheel fell off").id, "board");
});

test("router: answer that was only false promises falls back to a card", async () => {
  const r = await ask({ text: "flat tire" }, deps(JSON.stringify({ category: "FIX_IT", say: "I will dispatch a mechanic.", steps: ["Dispatch mechanic."] }), "on_device"));
  assert.equal(r.route, ROUTE.CARDS);
});
