// Hold to talk. Uses on-device speech recognition when Chrome has the language pack,
// because the default Web Speech path sends audio to a server and dies with no signal.
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const LANG = "en-US";

export function setupVoice({ button, onText, onFinal }) {
  const hint = button.lastElementChild;
  if (!Recognition) {
    button.setAttribute("aria-disabled", "true");
    hint.textContent = "not available here";
    return;
  }

  let rec = null;
  let heard = "";

  async function localReady() {
    if (!Recognition.available) return false;
    try {
      const status = await Recognition.available({ langs: [LANG], processLocally: true });
      if (status === "available") return true;
      if ((status === "downloadable" || status === "downloading") && Recognition.install) {
        hint.textContent = "getting voice pack";
        return await Recognition.install({ langs: [LANG], processLocally: true });
      }
    } catch {
      return false;
    }
    return false;
  }

  const start = async (e) => {
    e.preventDefault();
    if (rec) return;
    const local = await localReady();
    if (!local && !navigator.onLine) {
      hint.textContent = "needs signal, type it";
      return;
    }
    heard = "";
    rec = new Recognition();
    rec.lang = LANG;
    rec.interimResults = true;
    rec.continuous = true;
    if (local) rec.processLocally = true;
    rec.onresult = (ev) => {
      heard = [...ev.results].map((r) => r[0].transcript).join(" ").trim();
      onText(heard);
    };
    rec.onerror = () => {
      hint.textContent = "did not catch that";
    };
    rec.onend = () => {
      rec = null;
      button.setAttribute("aria-pressed", "false");
      if (heard) {
        hint.textContent = "to talk";
        onFinal();
      }
    };
    rec.start();
    button.setAttribute("aria-pressed", "true");
    hint.textContent = local ? "listening, on device" : "listening";
  };

  const stop = () => rec?.stop();

  button.addEventListener("pointerdown", start);
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointerleave", stop);
  button.addEventListener("pointercancel", stop);
}
