# NIGHTRIDE Offline

A companion for the ride home at night. It keeps working when the signal dies.

**Try it:** https://nightride-hybrid.web.app (desktop Chrome for on-device AI; any phone browser for the cloud and the field cards)

Built for #BuildHybridAI 2026 with Firebase AI Logic hybrid inference.

## The problem

You are on a bike, an e-bike, a skateboard or on foot, it is late, and something goes wrong: a flat, a dropped chain, a dead battery, a wrong turn, a stolen bike. That is often exactly where the signal is weakest. A cloud-only assistant goes quiet at the worst moment. A static FAQ can't read "the thing that makes the pedals go came off the gears."

NIGHTRIDE Offline answers in plain words, shows where the answer came from, and still gives a real answer with no model and no network.

## How an answer gets made

Every request runs down this list and stops at the first thing that can answer honestly.

1. **Safety guard.** Plain rules, no model, no network. If someone is hurt, in danger, or a battery is smoking, the whole screen becomes one button: dial 911. Crisis words route to 988.
2. **On device.** Gemini Nano in desktop Chrome, through Firebase AI Logic in `PREFER_ON_DEVICE` mode. Text and photos. Nothing leaves the laptop.
3. **Cloud.** Gemini through the same Firebase AI Logic call, when Nano is not available and there is signal.
4. **Field cards.** Vetted repair cards stored in the app. No model, no network. This is what a phone with no signal gets.

The model never writes repair steps on its own when a vetted card fits. It reads the rider's words (and photo), picks one card from a fixed list using structured output on both sides (`responseSchema` in the cloud, `responseConstraint` on device), and the app shows that card's checked steps. If the model picks the wrong card, "Wrong problem? Pick another" fixes it in one tap.

The road across the top of the screen shows how far each answer traveled. The route log shows the route, the time and the reason for every request.

## Firebase AI Logic in the code

- `src/brain/firebase.js`: `getAI` with `GoogleAIBackend`, `getGenerativeModel` with `mode` (`PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`, `ONLY_IN_CLOUD`), `inCloudParams` and `onDeviceParams`, `initializeDeviceModel` from a click, `response.inferenceSource` to report the route. App Check with reCAPTCHA Enterprise.
- `src/brain/router.js`: guard first, then the hybrid call, then cards on any failure.
- `src/brain/sanitize.js`: strips any claim that help is coming. Gemini Nano tried to promise "I will dispatch an ambulance" in testing.

## Also in the app

- **Photo of the problem.** Point the camera at the wheel or chain; on-device Nano names the part it sees.
- **Text someone.** Drafts a short message to a person you trust, on device when possible.
- **Places.** Open late spots near you from OpenStreetMap, saved for offline.
- **Read it to me.** Pre-recorded voice for every card step, works with no signal; device voice as the fallback.
- **Works offline.** A service worker caches the app, the cards and the voice clips.

## Honest limits

- It contacts nobody. It cannot call, text or send anyone for you.
- On-device AI needs desktop Chrome with Gemini Nano available. Phones use the cloud or the field cards.
- The first on-device answer in a session takes about 20 seconds on the test laptop. After that, a few seconds.
- Places come from OpenStreetMap. Hours can be out of date, and the app says so.

## Built during the contest

The project existed before the submission period opened (Nov 11 2026, 1:30 PM PT). The tag [`pre-contest`](../../tree/pre-contest) marks that state. Everything after it was built during the contest. See `CONTEST_LOG.md`.

## Run it

```
npm install
cp .env.example .env.local   # fill in your Firebase web config and App Check debug token
npm run dev                  # http://127.0.0.1:5183
npm test
```

In the Firebase console: add a web app, enable Firebase AI Logic with the Gemini Developer API (no billing needed), and add an App Check debug token for local development. For a hosted copy, register a reCAPTCHA Enterprise score key with App Check and set `VITE_RECAPTCHA_SITE_KEY`.

## License

Apache 2.0. See `LICENSE`.
