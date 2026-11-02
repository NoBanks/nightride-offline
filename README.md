# NIGHTRIDE Offline

A companion for the ride home at night. It keeps working when the signal dies.

Built for #BuildHybridAI 2026 with Firebase AI Logic hybrid inference.

## How an answer gets made

Every request runs down this list and stops at the first thing that can answer honestly.

1. **Safety guard.** Plain rules, no model, no network. If someone is hurt or in danger, the whole screen becomes one button: dial 911.
2. **On device.** Gemini Nano in desktop Chrome, through Firebase AI Logic in `PREFER_ON_DEVICE` mode. Text and photos. Nothing leaves the laptop.
3. **Cloud.** Gemini through the same SDK call, when Nano is not available and there is signal.
4. **Field cards.** Repair cards stored in the app. No model, no network. This is what a phone with no signal gets, because Gemini Nano only runs in desktop Chrome.

The road across the top of the screen shows how far each answer traveled. The route log shows the route, the time and the reason for every request.

## Honest limits

- It contacts nobody. Gemini Nano tried to promise "I will dispatch an ambulance" in testing, so a filter removes any claim of sending help.
- On-device AI needs desktop Chrome with a supported GPU or 16 GB of RAM. Phones use the cloud or the field cards.
- The first on-device answer in a session takes about 20 seconds on the test laptop (RTX 3050 Ti, CPU path). After that, about 3 to 6 seconds.
- Places come from OpenStreetMap. Hours can be out of date, and the app says so.

## Run it

```
npm install
cp .env.example .env.local   # fill in your Firebase web config and App Check debug token
npm run dev                  # http://127.0.0.1:5183
npm test
```

In the Firebase console: add a web app, enable Firebase AI Logic with the Gemini Developer API (no billing), and add an App Check debug token for local development.

## License

MIT
