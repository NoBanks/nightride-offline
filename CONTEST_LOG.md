# Built during the #BuildHybridAI submission period

Submission period opened Nov 11 2026, 1:30 PM PT. Tag `pre-contest` (commit 8d10751) is the state before that. Everything below came after.

## Before the period (tag `pre-contest`)

Hybrid router (guard, Gemini Nano, cloud Gemini, field cards), card picking with structured output, photo input, message drafts, OpenStreetMap places, offline service worker, voice playback code tested with placeholder tones. Local only, never deployed or published.

## During the period

- Nov 11: App Check moved to reCAPTCHA Enterprise; app deployed to Firebase Hosting at https://nightride-hybrid.web.app; on-device and cloud answers verified on the live site; Apache 2.0 license; public repo.
- Nov 11: the red 911 bar no longer shows just because the model said EMERGENCY. It needs a sign of danger in the rider's words (pain, a fall, fear, someone following, smoke) or a photo. Fixes the snapped chain, dead throttle and stolen bike false alarms from the Nov 2 eval. The guard's full-screen 911 is unchanged. 33 tests.
- Nov 11: recorded voice for all 89 card lines (the builder's own voice, rendered locally before shipping) in `public/voice`, precached by the service worker so "Read it to me" works with no signal. `tools/install_voice.mjs` copies picked takes in. Deployed.
- Nov 11 to 17: demo video recorded from real runs of the live site; published at https://youtu.be/IJw1TWp-m-4.
