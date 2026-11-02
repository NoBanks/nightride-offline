import test from "node:test";
import assert from "node:assert/strict";
import { checkEmergency } from "../src/brain/guard.js";
import { parseAnswer } from "../src/brain/sanitize.js";
import { matchCard } from "../src/brain/cards.js";
import { ask, ROUTE, withNotes } from "../src/brain/router.js";
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

test("places: distance is sane", () => {
  const km = distanceKm({ lat: 34.5, lon: -117.3 }, { lat: 34.6, lon: -117.3 });
  assert.ok(km > 11 && km < 11.3, String(km));
});

test("sanitizer caps say at two sentences", () => {
  const a = parseAnswer(JSON.stringify({ category: "FIX_IT", say: "One. Two. Three. Four.", steps: ["Do it."] }));
  assert.equal(a.say, "One. Two.");
  assert.equal(a.removedClaims, false);
});

test("model gets the matching card as notes, and the rider's words", () => {
  const p = withNotes("the motor quit on my ebike");
  assert.match(p, /Trusted repair notes for "E-bike lost power"/);
  assert.match(p, /The rider says: the motor quit on my ebike/);
  assert.equal(withNotes("asdf"), "asdf");
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

test("router: model emergency goes to the emergency screen", async () => {
  const r = await ask({ text: "ouch" }, deps(JSON.stringify({ category: "EMERGENCY", say: "x", steps: [] }), "on_device"));
  assert.equal(r.route, ROUTE.GUARD);
});

test("router: answer that was only false promises falls back to a card", async () => {
  const r = await ask({ text: "flat tire" }, deps(JSON.stringify({ category: "FIX_IT", say: "I will dispatch a mechanic.", steps: ["Dispatch mechanic."] }), "on_device"));
  assert.equal(r.route, ROUTE.CARDS);
});
