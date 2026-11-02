// navigator.onLine alone lies (true on Wi-Fi with no internet), so it is backed by a real ping.
const PING_URL = "https://www.gstatic.com/generate_204";
const PING_EVERY_MS = 20000;

async function ping() {
  if (!navigator.onLine) return false;
  try {
    await fetch(PING_URL, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(4000) });
    return true;
  } catch {
    return false;
  }
}

export function startSignalWatch(onChange) {
  let last = null;
  const check = async () => {
    const online = await ping();
    if (online !== last) {
      last = online;
      onChange(online);
    }
  };
  check();
  setInterval(check, PING_EVERY_MS);
  window.addEventListener("online", check);
  window.addEventListener("offline", check);
}

export async function deviceModelStatus() {
  if (typeof LanguageModel === "undefined") return "unsupported";
  try {
    const text = [{ type: "text", languages: ["en"] }];
    return await LanguageModel.availability({ expectedInputs: [...text, { type: "image" }], expectedOutputs: text });
  } catch {
    return "unavailable";
  }
}
