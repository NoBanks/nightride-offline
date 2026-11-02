// NIGHTRIDE contacts nobody. Gemini Nano was measured promising "I will dispatch
// an ambulance" on this exact app's prompts, so anything claiming to send help is cut.

const CLAIM = new RegExp(
  [
    "\\bdispatch(?:ing|ed|es)?\\b",
    "\\b(?:i|we)(?:'ll| will| am| are|'m|'re)?(?: going to| about to)?\\s+(?:send|call|contact|notify|alert|get|have)\\b.{0,30}\\b(?:help|ambulance|police|mechanic|someone|paramedics?|911|tow|ride)\\b",
    "\\b(?:help|an ambulance|police|paramedics?|a mechanic|a tow)\\b.{0,16}\\b(?:is|are)\\s+(?:on (?:the|their|its) way|coming|en route)\\b",
    "\\bestimated arrival\\b",
    "\\bmonitor(?:ing)? (?:the |your )?(?:call|location|situation)\\b",
    "\\bmaintain communication\\b",
    "\\bstay on the line\\b",
  ].join("|"),
  "i",
);

const CATEGORIES = new Set(["FIX_IT", "RIDE", "SAFE_PLACE", "EMERGENCY"]);

const sentences = (s) => String(s || "").match(/[^.!?]+[.!?]*\s*/g) || [];

function cleanSay(say) {
  return sentences(say)
    .filter((s) => !CLAIM.test(s))
    .slice(0, 2) // Nano sometimes repeats every step here. The steps have their own screen.
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

// Returns a usable answer, or null when the model output cannot be trusted at all.
export function parseAnswer(raw) {
  let data;
  try {
    const text = String(raw || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || !CATEGORIES.has(data.category)) return null;

  // Never trim the list here. Cutting a repair short can leave a wheel off the bike.
  const rawSteps = (Array.isArray(data.steps) ? data.steps : []).filter((s) => typeof s === "string" && s.trim());
  const steps = rawSteps.filter((s) => !CLAIM.test(s)).map((s) => s.trim());
  const say = cleanSay(data.say);

  const claimInSay = sentences(data.say).some((s) => CLAIM.test(s));
  return { category: data.category, say, steps, removedClaims: steps.length < rawSteps.length || claimInSay };
}
