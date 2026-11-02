// Field cards: the last tier. Plain text, bundled with the app, no model and no network.
// They are also what a phone gets with no signal, since Gemini Nano is desktop Chrome only.

export const CARDS = [
  {
    id: "flat",
    title: "Flat tire",
    category: "FIX_IT",
    words: ["flat", "puncture", "tire", "tyre", "tube", "valve", "pssh", "leaking air"],
    say: "Flat tire. Get to a lit spot first. With a spare tube and a pump this takes about 15 minutes.",
    steps: [
      "Walk the bike off the road to a lit spot and flip it or lean it.",
      "Open the brake or quick release, or loosen the axle nuts, and pull the wheel.",
      "Let out any air left. Work tire levers under the bead and lift one side off the rim.",
      "Pull the tube. Run a finger slowly inside the tire to find what caused it, and remove it.",
      "Put a little air in the new tube, seat it, and press the tire back on by hand.",
      "Pump it up, refit the wheel, close the brake, and spin it to check it runs straight.",
    ],
  },
  {
    id: "flat-no-tube",
    title: "Flat tire, no spare",
    category: "RIDE",
    weight: 3, // "no spare tube" has to beat the regular flat card, which also matches "tube".
    words: ["no spare", "no tube", "no pump", "no patch", "without a tube", "don't have a tube", "dont have a tube", "don't have a pump", "dont have a pump"],
    say: "No spare means no roadside fix. Walk it. Riding on a flat can wreck the rim.",
    steps: [
      "Get off the road to a lit spot.",
      "Walk the bike. Do not ride on the flat, it can damage the rim.",
      "Tell someone where you are and where you are headed.",
      "Head for the nearest lit, open place and sort out a ride that fits a bike.",
    ],
  },
  {
    id: "chain-off",
    title: "Chain came off",
    category: "FIX_IT",
    words: ["chain fell", "chain off", "chain came off", "dropped chain", "chain slipped", "chain jumped"],
    say: "Chain came off. That is a one minute fix and it does not need tools.",
    steps: [
      "Stop and shift to the smallest front ring if you have gears.",
      "Push the rear derailleur forward with one hand to get slack.",
      "Lay the chain over the top teeth of the front ring.",
      "Lift the rear wheel and turn the pedals slowly by hand until it seats.",
    ],
  },
  {
    id: "chain-snap",
    title: "Chain snapped",
    category: "RIDE",
    words: ["chain snapped", "chain broke", "broke my chain", "broken chain", "snapped chain", "chain broken", "snapped my chain"],
    say: "Snapped chain. You need a chain tool and a spare link to ride on. Without them you can still get home.",
    steps: [
      "Pick the broken chain up so it cannot catch in the wheel, and pocket it.",
      "If you have a chain tool: remove the bent link, rejoin with a quick link, and test gently.",
      "No tool: on a downhill or flat you can coast and scoot with one foot.",
      "Otherwise walk it to the nearest lit, open place and get a ride from there.",
      "Tell someone where you are before your phone gets low.",
    ],
  },
  {
    id: "ebike",
    title: "E-bike lost power",
    category: "FIX_IT",
    words: ["ebike", "e-bike", "motor", "battery died", "battery dead", "no power", "display off", "controller", "error code"],
    pin: { text: "If the battery is hot, swollen, smoking or smells, step well away from it and call 911.", unless: /swollen|smok/i },
    say: "E-bike with no power. It still rides as a heavy bike. Check the simple things first.",
    steps: [
      "Stop somewhere lit. If the battery is hot, swollen, smoking or smells, step well away from it and call 911.",
      "Turn the bike off, then press the battery firmly into its mount until it clicks.",
      "Check that the battery key is on and the plug is fully seated.",
      "Power it back on. Do not open the battery or the motor case.",
      "Still dead: drop to a low gear and pedal it, or walk it to a lit, open place.",
    ],
  },
  {
    id: "lights",
    title: "No lights",
    category: "SAFE_PLACE",
    words: ["no lights", "light died", "lights died", "lights are out", "lights out", "headlight", "taillight", "cant see", "can't see", "dark road", "too dark"],
    pin: { text: "Get off the roadway and onto a sidewalk or shoulder.", unless: /roadway|shoulder|sidewalk/i },
    say: "No lights means drivers cannot see you. Do not ride the road dark.",
    steps: [
      "Get off the roadway and onto a sidewalk or shoulder.",
      "Walk the bike. Face traffic if you have to use the road edge.",
      "Use your phone light only in short bursts to save battery.",
      "Head for the nearest lit, open business and sort out a ride from there.",
    ],
  },
  {
    id: "brakes",
    title: "Brakes or wheel feel wrong",
    category: "FIX_IT",
    words: ["brake", "brakes", "wobble", "wobbling", "rubbing", "loose wheel", "quick release", "wheel loose", "cable snapped"],
    pin: { text: "If a wheel or brake fails any check, walk it. Do not ride it home.", unless: /walk it|do not ride/i },
    say: "Stop riding until this is checked. Brakes and wheels are the two things you do not gamble on.",
    steps: [
      "Stop and get off the road.",
      "Lift each wheel and shake it side to side. It should not clunk.",
      "Check the quick release or axle nuts are fully tight on both wheels.",
      "Squeeze each brake and push the bike forward. It should hold.",
      "If either one fails, walk it. Do not ride it home.",
    ],
  },
  {
    id: "unsafe",
    title: "Feeling unsafe",
    category: "SAFE_PLACE",
    words: ["unsafe", "sketchy", "scared", "creepy", "afraid", "someone behind", "weird guy", "nervous"],
    pin: { text: "If you are in danger, call 911.", unless: /911/ },
    say: "Trust that. Go to people and light, not home, until it passes.",
    steps: [
      "Head for the nearest open business or busy, lit street.",
      "Go inside and tell a worker you are waiting for a ride.",
      "Send someone your location now.",
      "If you are in danger, call 911.",
    ],
  },
  {
    id: "phone",
    title: "Phone is dying",
    category: "RIDE",
    weight: 0.4, // A low phone is usually a side note. The actual problem should win the match.
    words: ["phone dying", "phone at", "low battery", "battery low", "percent", "phone dead", "phone is about to die"],
    pin: { text: "Send your location and your plan to one person, right now.", unless: /location/i },
    say: "Do the one thing that matters first. Tell someone where you are, then save what is left.",
    steps: [
      "Send your location and your plan to one person, right now.",
      "Turn on low power mode and turn the brightness all the way down.",
      "Write down or memorize the next three turns.",
      "Put the phone away and only wake it to check a turn.",
    ],
  },
  {
    id: "lost",
    title: "Lost",
    category: "RIDE",
    words: ["lost", "wrong way", "dont know where", "don't know where", "where am i", "no map", "turned around"],
    say: "Stop moving and get your bearings. A wrong turn costs minutes. Riding blind costs more.",
    steps: [
      "Stop somewhere lit, off the road.",
      "Find the nearest street sign and read the cross street.",
      "Check whether you already saved this area in your maps app.",
      "Ask inside any open business if the map will not load.",
    ],
  },
  {
    id: "stolen",
    title: "Bike stolen",
    category: "SAFE_PLACE",
    words: ["stolen", "stole my", "took my bike", "bike is gone", "bike was gone", "bike is missing"],
    pin: { text: "Do not chase anyone. If someone threatens you, call 911.", unless: /chase|911/i },
    say: "Do not chase anyone. Get yourself home first. The report can come after.",
    steps: [
      "Go somewhere lit and open, and stay there while you sort this out.",
      "Tell someone what happened and where you are.",
      "Write down the time, the place and your serial number if you have it.",
      "Report it to the police non-emergency line when you are safe.",
      "Ask the store if a camera covers where it was parked.",
    ],
  },
  {
    id: "walking",
    title: "Walking home",
    category: "RIDE",
    words: ["last bus", "missed the bus", "missed my bus", "missed my ride", "walking home", "walk home", "no ride", "stranded", "on foot"],
    say: "Stay on the main streets. Longer and lit beats shorter and dark.",
    steps: [
      "Stick to lit main streets, and use the sidewalk.",
      "If there is no sidewalk, walk facing traffic.",
      "Send someone your route and when you expect to get home.",
      "Keep your head up and your ears free.",
      "If it stops feeling right, go into the nearest open business and get a ride from there.",
    ],
  },
  {
    id: "rain",
    title: "Rain",
    category: "SAFE_PLACE",
    words: ["rain", "raining", "storm", "downpour", "soaked", "wet road", "lightning", "flooded"],
    say: "Wet roads mean longer stops and slick paint. Slow down, or wait it out under cover.",
    steps: [
      "Slow down and start braking much earlier than usual.",
      "Stay off painted lines, metal plates and grates. They get slick.",
      "If you are on an e-bike, take the battery inside with you if you stop for long.",
      "In lightning or flooding, get indoors and wait.",
    ],
  },
];

const FALLBACK = {
  id: "general",
  title: "Get to a safe spot",
  category: "SAFE_PLACE",
  words: [],
  say: "No model is available right now, so here is the basic plan.",
  steps: [
    "Get off the road to somewhere lit.",
    "Check yourself first, then the bike.",
    "Tell one person where you are.",
    "If you are hurt or in danger, call 911.",
  ],
};

export function matchCard(text) {
  const t = String(text || "").toLowerCase().replace(/[’]/g, "'");
  let best = FALLBACK;
  let bestScore = 0;
  for (const card of CARDS) {
    // Longer phrases count for more, so "chain snapped" beats a stray "battery".
    const score = card.words.reduce((sum, w) => sum + (t.includes(w) ? w.length : 0), 0) * (card.weight ?? 1);
    if (score > bestScore) {
      best = card;
      bestScore = score;
    }
  }
  return best;
}
