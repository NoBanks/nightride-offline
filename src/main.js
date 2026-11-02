// Fonts are bundled, never fetched, so the type survives losing signal.
import "@fontsource/big-shoulders-display/latin-700";
import "@fontsource/big-shoulders-display/latin-900";
import "@fontsource/overpass/latin-400";
import "@fontsource/overpass/latin-600";
import "@fontsource/overpass/latin-700";
import "@fontsource/overpass-mono/latin-400";
import "@fontsource/overpass-mono/latin-600";
import "./styles.css";
import { ask, ROUTE } from "./brain/router.js";
import { generate, readyDeviceModel, draftMessage } from "./brain/firebase.js";
import { geocode, findPlaces, savedPlaces } from "./places.js";
import { startSignalWatch, deviceModelStatus } from "./signal.js";
import { setupVoice } from "./voice.js";

const $ = (id) => document.getElementById(id);
const CHIPS = [
  ["Flat tire", "My rear tire is flat."],
  ["Chain snapped", "My chain snapped."],
  ["E-bike died", "My e-bike lost power."],
  ["No lights", "My lights died and it is dark."],
  ["Feel unsafe", "I feel unsafe where I am."],
  ["Lost", "I am lost and my map will not load."],
];
const CATEGORY_LABEL = { FIX_IT: "Fix it", RIDE: "Get home", SAFE_PLACE: "Get somewhere safe" };
const ROUTE_LABEL = {
  [ROUTE.ON_DEVICE]: "ON DEVICE",
  [ROUTE.IN_CLOUD]: "CLOUD",
  [ROUTE.CARDS]: "FIELD CARD",
  [ROUTE.GUARD]: "SAFETY GUARD",
  map: "MAP DATA",
};

const state = { mode: "auto", image: null, lastText: "", steps: [], step: 0, location: "" };

// --- Status gauges ---
startSignalWatch((online) => {
  document.body.dataset.signal = online ? "on" : "off";
  const g = $("g-signal");
  g.textContent = online ? "Connected" : "None";
  g.className = online ? "cool" : "bad";
  const anchor = document.body.dataset.route;
  if (anchor === "idle") $("road-status").textContent = online ? "Nothing asked yet." : "No signal. On-device AI and field cards still work.";
  $("open-places").querySelector("small").textContent = online ? "Real places from the map. Saved for later." : "No signal. Your last search is saved.";
});

async function refreshModel() {
  const status = await deviceModelStatus();
  const g = $("g-model");
  const ready = $("ready");
  const text = { available: "Ready", downloadable: "Not downloaded", downloading: "Downloading", unavailable: "Not on this device", unsupported: "Desktop Chrome only" }[status] || status;
  g.textContent = text;
  g.className = status === "available" ? "good" : status === "unavailable" || status === "unsupported" ? "bad" : "";
  if (status === "unavailable" || status === "unsupported") {
    ready.hidden = true;
    return status;
  }
  return status;
}
refreshModel();

if (navigator.getBattery) {
  navigator.getBattery().then((b) => {
    const show = () => {
      const pct = Math.round(b.level * 100);
      const g = $("g-battery");
      g.textContent = `${pct}%${b.charging ? " +" : ""}`;
      g.className = pct < 15 && !b.charging ? "bad" : "";
    };
    show();
    b.addEventListener("levelchange", show);
    b.addEventListener("chargingchange", show);
  });
} else {
  $("g-battery").textContent = "n/a";
}

const tick = () => {
  $("g-clock").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};
tick();
setInterval(tick, 20000);

function markWarm(text = "On-device AI warm") {
  $("ready").classList.add("done");
  $("ready-text").textContent = text;
  $("ready-bar").style.width = "100%";
}

// --- Warm up: creating the first on-device session takes about 20 s on this laptop ---
$("ready").addEventListener("click", async () => {
  const btn = $("ready");
  if (btn.classList.contains("done")) return;
  const label = $("ready-text");
  label.textContent = "Warming up...";
  try {
    await readyDeviceModel((p) => {
      const pct = Math.round((p <= 1 ? p * 100 : p));
      $("ready-bar").style.width = `${pct}%`;
      label.textContent = `Downloading model ${pct}%`;
    });
    const t0 = performance.now();
    label.textContent = "Loading the model into memory...";
    await generate({ prompt: "Reply with category RIDE, say OK, steps OK.", mode: "device" });
    markWarm(`On-device AI warm (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (err) {
    label.textContent = `Could not warm up: ${String(err?.message || err).slice(0, 70)}`;
  }
  refreshModel();
});

// --- Ask ---
const chips = $("chips");
for (const [label, text] of CHIPS) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.textContent = label;
  b.addEventListener("click", () => {
    $("q").value = text;
    $("q").focus();
  });
  chips.append(b);
}

$("ask").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("q").value.trim();
  if (!text && !state.image) {
    $("q").focus();
    return;
  }
  await runAsk(text || "What is wrong in this photo, and what do I do?");
});

$("q").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("ask").requestSubmit();
  }
});

async function runAsk(text) {
  const go = $("go");
  state.lastText = text;
  go.disabled = true;
  go.firstElementChild.textContent = "Thinking...";
  document.body.dataset.route = "thinking";
  $("road-status").textContent = "Working it out...";
  try {
    const r = await ask({ text, image: state.image, mode: state.mode }, { generate });
    addLog(text, r);
    if (r.route === ROUTE.ON_DEVICE) markWarm();
    show(r);
  } finally {
    go.disabled = false;
    go.firstElementChild.textContent = "Tell me what to do";
  }
}

function show(r) {
  if (r.route === ROUTE.GUARD) {
    openSiren(r.kind);
    document.body.dataset.route = "idle";
    $("road-status").textContent = "Safety guard. No model involved in that decision.";
    return;
  }
  document.body.dataset.route = r.route;
  const secs = (r.ms / 1000).toFixed(1);
  const where =
    r.route === ROUTE.ON_DEVICE
      ? `Answered on this laptop in ${secs} s. Nothing left the device.`
      : r.route === ROUTE.IN_CLOUD
        ? `Answered by cloud Gemini in ${secs} s.`
        : "No model available. Field card, stored in the app.";
  $("road-status").textContent = where;
  $("a-cat").textContent = r.title || CATEGORY_LABEL[r.category] || "";
  $("a-src").textContent = `${ROUTE_LABEL[r.route]} / ${secs} s`;
  $("a-say").textContent = r.say;
  state.steps = r.steps;
  state.step = 0;
  const ol = $("a-steps");
  ol.replaceChildren(
    ...r.steps.map((s) => {
      const li = document.createElement("li");
      li.textContent = s;
      return li;
    }),
  );
  renderStep();
  $("answer").hidden = false;
  $("answer").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderStep() {
  const items = [...$("a-steps").children];
  items.forEach((li, i) => li.classList.toggle("now", i === state.step));
  $("a-count").textContent = items.length ? `Step ${state.step + 1} of ${items.length}` : "";
  $("prev").disabled = state.step === 0;
  $("next").disabled = state.step >= items.length - 1;
  $("next").textContent = state.step >= items.length - 1 ? "Last step" : "Next step";
}
$("next").addEventListener("click", () => {
  state.step = Math.min(state.step + 1, state.steps.length - 1);
  renderStep();
});
$("prev").addEventListener("click", () => {
  state.step = Math.max(state.step - 1, 0);
  renderStep();
});
$("speak").addEventListener("click", () => {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const words = [$("a-say").textContent, state.steps[state.step]].filter(Boolean).join(" ");
  const u = new SpeechSynthesisUtterance(words);
  u.rate = 0.95;
  // Prefer a voice that lives on the device so this keeps working with no signal.
  const local = speechSynthesis.getVoices().find((v) => v.localService && v.lang.startsWith("en"));
  if (local) u.voice = local;
  speechSynthesis.speak(u);
});

function addLog(text, r) {
  const li = document.createElement("li");
  const top = document.createElement("div");
  top.className = "r-top";
  const route = document.createElement("span");
  route.className = `r-${r.route}`;
  route.textContent = ROUTE_LABEL[r.route] || r.route;
  const ms = document.createElement("span");
  ms.textContent = `${(r.ms / 1000).toFixed(1)} s`;
  top.append(route, ms);
  const q = document.createElement("div");
  q.className = "r-q";
  q.textContent = text;
  const why = document.createElement("div");
  why.className = "r-why";
  why.textContent = r.reason;
  li.append(top, q, why);
  $("log").prepend(li);
}

// --- Routing mode, so a judge can force each path ---
document.querySelectorAll(".seg button").forEach((b) =>
  b.addEventListener("click", () => {
    state.mode = b.dataset.mode;
    document.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }),
);

// --- Emergency ---
function openSiren(kind) {
  const crisis = kind === "crisis";
  $("siren-title").textContent = crisis ? "Call 988" : "Call 911";
  $("siren-call").textContent = crisis ? "Call or text 988" : "Dial 911";
  $("siren-call").href = crisis ? "tel:988" : "tel:911";
  $("siren").hidden = false;
  $("siren-call").focus();
}
$("siren-back").addEventListener("click", () => {
  $("siren").hidden = true;
  $("q").focus();
});

// --- Photo ---
$("photo").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  state.image = await toJpeg(file);
  $("preview").src = `data:image/jpeg;base64,${state.image.base64}`;
  $("attached").hidden = false;
});
$("unattach").addEventListener("click", () => {
  state.image = null;
  $("photo").value = "";
  $("attached").hidden = true;
});

// On-device input is JPEG or PNG only, so every photo is converted and sized down first.
async function toJpeg(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { mimeType: "image/jpeg", base64: canvas.toDataURL("image/jpeg", 0.85).split(",")[1] };
}

// --- Panels ---
function togglePanel(btnId, panelId) {
  const open = $(panelId).hidden;
  $(panelId).hidden = !open;
  $(btnId).setAttribute("aria-expanded", String(open));
  if (open) $(panelId).scrollIntoView({ behavior: "smooth", block: "nearest" });
}
$("open-places").addEventListener("click", () => {
  togglePanel("open-places", "places");
  if (document.body.dataset.signal === "off") showSaved("No signal.");
});
$("open-tell").addEventListener("click", () => {
  togglePanel("open-tell", "tell");
  if (!$("msg").value && state.lastText) $("msg").value = state.lastText;
  syncSms();
});

const NO_PLACES_TIP = "Head for the nearest lit street and look for a gas station, grocery store or hospital.";

function renderPlaces(places, note) {
  $("places-note").textContent = note;
  $("places-note").hidden = false;
  const list = $("places-list");
  list.replaceChildren(
    ...places.map((p) => {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=walking`;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = p.name;
      const meta = document.createElement("div");
      meta.className = "place-meta";
      meta.textContent = `${p.kind} / ${(p.km * 0.621371).toFixed(1)} mi /${p.always ? "Listed as open 24 hours" : p.hours ? `Hours: ${p.hours}` : "Hours not listed"}`;
      li.append(link, meta);
      return li;
    }),
  );
  list.hidden = false;
}

function showSaved(reason) {
  const saved = savedPlaces();
  if (saved?.places?.length) {
    const mins = Math.round((Date.now() - saved.at) / 60000);
    renderPlaces(saved.places, `${reason} Showing your last search, saved ${mins} min ago, so distances are from there.`);
    return true;
  }
  $("places-list").hidden = true;
  $("places-note").hidden = false;
  $("places-note").textContent = `${reason} ${NO_PLACES_TIP}`;
  return false;
}

async function searchFrom(getHere, label) {
  const t0 = performance.now();
  if (document.body.dataset.signal === "off" || !navigator.onLine) {
    const had = showSaved("No signal.");
    addLog(`Places: ${label}`, { route: ROUTE.CARDS, ms: 0, reason: had ? "Saved results, no network used" : "No signal and nothing saved" });
    return;
  }
  $("places-note").hidden = false;
  $("places-note").textContent = "Searching the map...";
  try {
    const here = await getHere();
    const places = await findPlaces(here);
    if (places.length) renderPlaces(places, "Hours come from OpenStreetMap and can be out of date. Call ahead if you can.");
    else {
      $("places-list").hidden = true;
      $("places-note").textContent = `Nothing listed nearby. ${NO_PLACES_TIP}`;
    }
    addLog(`Places: ${label}`, { route: "map", ms: performance.now() - t0, reason: `${places.length} real places from OpenStreetMap, saved on device` });
  } catch (err) {
    const had = showSaved("Could not reach the map.");
    addLog(`Places: ${label}`, { route: ROUTE.CARDS, ms: performance.now() - t0, reason: `${had ? "Saved results" : "No results"}: ${String(err?.message || err).slice(0, 60)}` });
  }
}

$("find").addEventListener("click", () => {
  const where = $("where").value.trim();
  if (!where) {
    $("where").focus();
    $("places-note").hidden = false;
    $("places-note").textContent = "Type a street or area first, or use your location.";
    return;
  }
  searchFrom(() => geocode(where), where);
});

$("find-here").addEventListener("click", () => {
  searchFrom(
    () =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Location is not available here"));
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => reject(new Error("Could not get your location")),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
        );
      }),
    "my location",
  );
});

function syncSms() {
  $("sms").href = `sms:?&body=${encodeURIComponent($("msg").value)}`;
}
$("msg").addEventListener("input", syncSms);

$("draft").addEventListener("click", async () => {
  const situation = $("q").value.trim() || state.lastText || "I had a problem on my ride home.";
  const t0 = performance.now();
  const before = $("msg").value;
  $("msg").value = "Drafting...";
  try {
    const r = await draftMessage(situation, state.mode);
    $("msg").value = r.text + (state.location ? ` ${state.location}` : "");
    addLog("Draft a text", { route: r.source === "on_device" ? ROUTE.ON_DEVICE : ROUTE.IN_CLOUD, ms: performance.now() - t0, reason: "Message draft" });
  } catch {
    $("msg").value = before || `Having trouble on my ride home: ${situation}${state.location ? ` ${state.location}` : ""}`;
    addLog("Draft a text", { route: ROUTE.CARDS, ms: performance.now() - t0, reason: "No model available, used a plain template" });
  }
  syncSms();
});

$("share-loc").addEventListener("click", () => {
  const btn = $("share-loc");
  if (!navigator.geolocation) {
    btn.lastElementChild.textContent = "not available here";
    return;
  }
  btn.lastElementChild.textContent = "finding...";
  navigator.geolocation.getCurrentPosition(
    (p) => {
      state.location = `https://maps.google.com/?q=${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`;
      $("msg").value = `${$("msg").value.trim()} ${state.location}`.trim();
      btn.lastElementChild.textContent = "added";
      syncSms();
    },
    () => {
      btn.lastElementChild.textContent = "could not get it";
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  );
});

$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("msg").value);
    $("copy").lastElementChild.textContent = "copied";
  } catch {
    $("copy").lastElementChild.textContent = "copy failed";
  }
});

setupVoice({
  button: $("talk"),
  onText: (text) => {
    $("q").value = text;
  },
  onFinal: () => $("ask").requestSubmit(),
});

if (!import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").then(async () => {
    const reg = await navigator.serviceWorker.ready;
    const urls = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((u) => u.startsWith(location.origin));
    reg.active?.postMessage({ type: "cache", urls: [location.pathname, ...urls] });
  });
}
