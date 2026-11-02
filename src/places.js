// Real places from OpenStreetMap: free, no key, no card. Gemini is never asked what is open,
// because without search grounding it invents hours. Results are saved on the device, so
// the last search still works after the signal dies.
// Public servers, and they do return 502s, so there is more than one.
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const SAVE_KEY = "nightride.places";
const RADIUS_M = 4000;

const KINDS = {
  hospital: "Hospital",
  fire_station: "Fire station",
  police: "Police",
  fuel: "Gas station",
  pharmacy: "Pharmacy",
  convenience: "Convenience store",
  supermarket: "Grocery store",
  bicycle: "Bike shop",
};

export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Places listed as always open come first, then nearest. Unnamed places are not useful at night.
export function rankPlaces(elements, here, limit = 5) {
  return elements
    .map((e) => {
      const tags = e.tags || {};
      const kind = KINDS[tags.amenity] || KINDS[tags.shop];
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      if (!tags.name || !kind || lat == null) return null;
      const hours = tags.opening_hours || "";
      return {
        name: tags.name,
        kind,
        lat,
        lon,
        km: distanceKm(here, { lat, lon }),
        hours,
        always: /^\s*24\/7\s*$/.test(hours),
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.always) - Number(a.always) || a.km - b.km)
    // A gas station and its shop are often mapped separately. One stop is one result.
    .filter((p, i, all) => !all.slice(0, i).some((q) => q.name === p.name && distanceKm(p, q) < 0.25))
    .slice(0, limit);
}

// The geocoder does not understand intersections, so "A and B, City" falls back to "A, City".
export function addressCandidates(where) {
  const text = String(where || "").trim();
  const single = text.replace(/\s+(?:and|&|at)\s+[^,]+/i, "");
  return [...new Set([text, single])];
}

export async function geocode(where) {
  for (const q of addressCandidates(where)) {
    const res = await fetch(`${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);
    const [hit] = await res.json();
    if (hit) return { lat: Number(hit.lat), lon: Number(hit.lon) };
  }
  throw new Error("Could not find that address. Add the city.");
}

export async function findPlaces(here) {
  const around = `(around:${RADIUS_M},${here.lat},${here.lon})`;
  const query = `[out:json][timeout:12];(
    nwr["amenity"~"^(hospital|fire_station|police|fuel|pharmacy)$"]${around};
    nwr["shop"~"^(convenience|supermarket|bicycle)$"]${around};
  );out center 80;`;
  // Someone stranded cannot wait on a busy server: first good answer wins, 8 s at most.
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 8000);
  let elements;
  try {
    elements = await Promise.any(
      OVERPASS.map(async (server) => {
        const res = await fetch(server, { method: "POST", body: new URLSearchParams({ data: query }), signal: stop.signal });
        if (!res.ok) throw new Error(`Map lookup failed (${res.status})`);
        return (await res.json()).elements || [];
      }),
    );
    stop.abort();
  } catch {
    elements = await searchByCategory(here);
  } finally {
    clearTimeout(timer);
  }
  const places = rankPlaces(elements, here);
  savePlaces(places);
  return places;
}

// Backup when every Overpass server is down. One request at a time, per Nominatim's usage policy.
async function searchByCategory(here) {
  const pad = RADIUS_M / 111000;
  const box = [here.lon - pad, here.lat + pad, here.lon + pad, here.lat - pad].join(",");
  const elements = [];
  for (const q of ["gas station", "hospital", "convenience store", "pharmacy"]) {
    const res = await fetch(`${NOMINATIM}?format=jsonv2&limit=6&extratags=1&bounded=1&viewbox=${box}&q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`Map lookup failed (${res.status})`);
    for (const hit of await res.json()) {
      elements.push({
        lat: Number(hit.lat),
        lon: Number(hit.lon),
        tags: { [hit.category]: hit.type, name: hit.name, opening_hours: hit.extratags?.opening_hours },
      });
    }
    await new Promise((r) => setTimeout(r, 1100));
  }
  return elements;
}

function savePlaces(places) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ at: Date.now(), places }));
  } catch {
    // Storage can be blocked. The live result still shows.
  }
}

export function savedPlaces() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}
