// Emergency guard. Runs before any model, on every request, with no network.
// A model must never be the thing standing between a rider and 911.

const VEHICLE = "(?:car|truck|van|suv|bus|driver|vehicle|motorcycle|drunk driver)";

const EMERGENCY = [
  new RegExp(`\\b(?:hit|struck|clipped|doored|run over|ran over)\\b.{0,12}\\bby\\s+(?:a|an|the|some)?\\s*${VEHICLE}\\b`),
  new RegExp(`\\b${VEHICLE}\\b.{0,20}\\b(?:hit|struck|ran over|ran me|run me|knocked)\\b.{0,8}\\bme\\b`),
  /\b(?:ran|run) me over\b/,
  /\bbleeding\b.{0,20}\b(?:a lot|badly|bad|heavily|heavy|won'?t stop|wont stop|everywhere|really)\b/,
  /\b(?:won'?t|can'?t|cannot) stop\b.{0,12}\bbleed/,
  /\b(?:blood everywhere|lots? of blood|so much blood)\b/,
  /\b(?:broke|broken|snapped|fractured)\b.{0,10}\b(?:arm|leg|wrist|ankle|collarbone|rib|ribs|hip|neck|back|jaw|bone|bones)\b/,
  /\b(?:hit|hurt|cracked|smashed)\s+(?:my|his|her|their)\s+head\b/,
  /\bhead injury\b/,
  /\b(?:can'?t|cannot|can not) (?:feel|move) my (?:legs?|arms?|hands?|feet|foot|neck|body)\b/,
  /\b(?:badly|seriously|really) (?:hurt|injured)\b|\bhurt (?:bad|badly)\b/,
  /\b(?:can'?t|cannot|can not|hard to|trouble) (?:breathe|breathing)\b/,
  /\bnot breathing\b/,
  /\bchest pain\b/,
  /\bheart attack\b/,
  /\b(?:a )?stroke\b.{0,8}\b(?:happening|having|symptoms)\b|\bhaving a stroke\b/,
  /\bseizure\b/,
  /\b(?:passed out|unconscious|knocked out|blacked out)\b/,
  /\b(?:crashed|fell|wrecked)\b.{0,30}\b(?:can'?t move|cannot move|can'?t get up|cannot get up|can'?t feel)\b/,
  /\b(?:being|getting)\s+(?:followed|chased|attacked|robbed|mugged|stabbed|assaulted)\b/,
  /\b(?:someone|somebody|a guy|a man|a person|guy|man|they|he|she)\b.{0,16}\b(?:following|chasing|attacking|grabbed|robbing|mugging)\b.{0,6}\bme\b/,
  /\b(?:stabbed|mugged|robbed|assaulted)\s+me\b/,
  /\b(?:has|have|got|with|pulled)\s+a\s+(?:gun|knife)\b/,
  /\b(?:i|i'?ve|been|got|he|she|they)\s+(?:was |been |got |just )?shot\b(?!\s+(?:past|through|a\b|some|the\b|up|down|out|across))/,
  /\bshot me\b/,
  /\b(?:on fire|battery (?:is )?(?:smoking|exploded|on fire))\b/,
  /\bbattery\b.{0,40}\b(?:smok\w*|smells?|smelling|swollen|swelling|burning|sparks?|sparking|melting)\b/,
  /\b(?:call|need)\s+(?:an?\s+)?(?:911|ambulance|paramedics?)\b/,
];

const CRISIS = [
  /\b(?:kill|killing|hurt|hurting) myself\b/,
  /\bsuicid/,
  /\b(?:want|wanna|going) to die\b/,
  /\b(?:don'?t|do not) want to (?:be here|live|be alive)\b/,
  /\bend (?:it all|my life)\b/,
];

export function checkEmergency(text) {
  const t = String(text || "").toLowerCase().replace(/[’]/g, "'");
  if (CRISIS.some((r) => r.test(t))) return "crisis";
  if (EMERGENCY.some((r) => r.test(t))) return "emergency";
  return null;
}
