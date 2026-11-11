// Firebase AI Logic wiring. All Gemini access goes through here.
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, Schema } from "firebase/ai";
import { CARDS } from "./cards.js";

const CLOUD_MODEL = "gemini-3.5-flash-lite";

const SYSTEM = `You help someone on a bike, e-bike, skateboard or on foot, at night, with a problem on the way home.
Reply calmly, like a friend who has fixed a hundred flats. Short sentences. Never cheerful.
You are an app on their device. You cannot contact anyone, send anyone, or see where they are.
Never say you will dispatch, send, call or notify anybody. Never say help is coming.
Every step is something the person does themselves with their own hands or phone.
Never give medical advice.
category is FIX_IT if they can repair it, RIDE if they need a way home, SAFE_PLACE if they should get somewhere lit and open, EMERGENCY if someone is hurt or in danger.
Only when card is none, steps is 3 to 5 short instructions.
If a photo is included, name the part you see in say and only describe what is visible.`;

const ANSWER_SCHEMA = Schema.object({
  properties: {
    category: Schema.enumString({ enum: ["FIX_IT", "RIDE", "SAFE_PLACE", "EMERGENCY"] }),
    card: Schema.enumString({ enum: [...CARDS.map((c) => c.id), "none"] }),
    say: Schema.string(),
    steps: Schema.array({ items: Schema.string() }),
  },
});

const MESSAGE_SYSTEM = `Write a short text message from a person on a night ride to someone they trust.
Plain, calm, first person, under 30 words. Only repeat facts the person gave. Do not say they are okay or safe unless they said so. Do not add a greeting or a name. End by asking the reader to call or text back.`;

const config = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

const MODES = {
  auto: InferenceMode.PREFER_ON_DEVICE,
  device: InferenceMode.ONLY_ON_DEVICE,
  cloud: InferenceMode.ONLY_IN_CLOUD,
};

const INPUTS = [{ type: "text", languages: ["en"] }, { type: "image" }];
const OUTPUTS = [{ type: "text", languages: ["en"] }];

let ai = null;
const cache = new Map();

function getClient() {
  if (ai) return ai;
  const app = initializeApp(config);
  if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  }
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "dev-only-no-recaptcha";
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: !import.meta.env.DEV });
  ai = getAI(app, { backend: new GoogleAIBackend() });
  return ai;
}

function answerModel(mode) {
  const key = `answer:${mode}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      getGenerativeModel(getClient(), {
        mode: MODES[mode] || MODES.auto,
        inCloudParams: {
          model: CLOUD_MODEL,
          systemInstruction: SYSTEM,
          generationConfig: { responseMimeType: "application/json", responseSchema: ANSWER_SCHEMA },
        },
        onDeviceParams: {
          createOptions: {
            expectedInputs: INPUTS,
            expectedOutputs: OUTPUTS,
            initialPrompts: [{ role: "system", content: SYSTEM }],
          },
          promptOptions: { responseConstraint: ANSWER_SCHEMA },
        },
      }),
    );
  }
  return cache.get(key);
}

function sourceFor(response, mode) {
  if (response.inferenceSource) return response.inferenceSource;
  return mode === "device" ? "on_device" : "in_cloud";
}

export async function generate({ prompt, image, mode = "auto" }) {
  const model = answerModel(mode);
  const parts = image ? [prompt, { inlineData: { mimeType: image.mimeType, data: image.base64 } }] : prompt;
  const result = await model.generateContent(parts);
  return { text: result.response.text(), source: sourceFor(result.response, mode) };
}

// Must be called from a click: Chrome requires a user gesture if the model has to download.
export async function readyDeviceModel(onProgress) {
  await answerModel("auto").initializeDeviceModel(onProgress);
}

export async function draftMessage(situation, mode = "auto") {
  const key = `message:${mode}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      getGenerativeModel(getClient(), {
        mode: MODES[mode] || MODES.auto,
        inCloudParams: { model: CLOUD_MODEL, systemInstruction: MESSAGE_SYSTEM },
        onDeviceParams: {
          createOptions: {
            expectedInputs: [INPUTS[0]],
            expectedOutputs: OUTPUTS,
            initialPrompts: [{ role: "system", content: MESSAGE_SYSTEM }],
          },
        },
      }),
    );
  }
  const result = await cache.get(key).generateContent(situation);
  return { text: result.response.text().trim(), source: sourceFor(result.response, mode) };
}
