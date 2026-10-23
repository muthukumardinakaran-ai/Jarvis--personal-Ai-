# JARVIS Personal AI — Starter v0.1.0

A practical starter for a Tamil / English / Tanglish personal assistant with a web UI, speech input/output, local reminders, and an optional OpenAI-compatible chat-completions backend.

## Current capabilities

- Responsive web app that can be installed as a PWA in supported browsers.
- Android packaging path through Capacitor.
- Chat UI with locally saved chat history.
- Speech input via the browser Web Speech API where available.
- Spoken responses via SpeechSynthesis where available.
- Reminders stored in local browser storage, with in-app due checks while the app is open.
- Optional Capacitor Local Notifications scheduling when running as a native app and the plugin is installed.
- Simple safe shortcuts for opening YouTube / Google, plus a clear explanation when browser security prevents Android system actions.
- AI endpoint/model configuration in Settings.

## Requirements

- Node.js 20 LTS or newer recommended.
- npm.
- For Android builds: Android Studio, Android SDK, and a compatible JDK (Android Studio's bundled JDK is recommended).
- An AI provider endpoint or a local OpenAI-compatible server is optional. The UI still runs without one.

## Run on your computer

```bash
npm install
npm run dev
```

Open the URL printed by Vite. For testing on a phone on the same Wi-Fi, use the network URL shown by Vite. The phone and computer must be on the same network; your firewall may need to allow the port.

## Configure AI

Open **Settings** and fill in:

- **AI endpoint**: base URL such as `https://your-provider.example/v1` or a local compatible server URL.
- **Model name**: exact model name accepted by that server.
- **API key**: optional for local servers; required by many hosted providers.

The app calls `<endpoint>/chat/completions` unless the endpoint already ends with `/chat/completions`.

### Local AI option

You can run a local model server such as Ollama on a computer you control. The computer and phone must be able to reach the server over your local network, and the server must expose a compatible API. Configure the exact endpoint and model according to your server's current documentation. Many local servers restrict cross-origin browser calls by default; configure CORS carefully or use a small backend proxy.

**Important:** Do not put a secret API key in a public frontend deployment. Browser local storage is not encrypted. For production, add an authenticated backend proxy and keep provider keys on the server.

## Build the web version

```bash
npm run build
npm run preview
```

The generated website is in `dist/`. Deploy the contents of `dist/` to a static host that supports HTTPS. For a PWA, HTTPS is generally required outside localhost. The included manifest is a minimal starting point; add app icons before publishing.

## Build the Android app

Install dependencies first:

```bash
npm install
npx cap add android
npm run android:sync
npm run android:open
```

If `npx cap add android` says the Android platform already exists, skip that command and run `npm run android:sync`.

Then in Android Studio:
1. Wait for Gradle sync to finish.
2. Connect a test Android device with USB debugging enabled, or create an emulator.
3. Press Run.
4. Accept microphone and notification permissions when requested.

For later code changes, run `npm run android:sync` and rebuild from Android Studio.

## Test checklist

1. Load the app and send a text message without AI configured. It should explain how to connect a model.
2. Open Settings and configure a compatible AI endpoint.
3. Try voice input in Chrome on Android. Speech recognition availability varies by browser and device.
4. Create a reminder a few minutes in the future while the app is open.
5. Test YouTube / Google shortcut commands.
6. Install the PWA from the browser menu and confirm the layout works in standalone mode.
7. Build the native Android wrapper and verify notification permission and scheduling on your own device.

## Important limitations in this starter

- No always-on wake word or background microphone service.
- Browser speech recognition is browser/device-dependent and may use an online service.
- In-app reminder polling is only reliable while the app is open. Native local notifications are attempted in the Capacitor build, but should be tested on a real device and Android version.
- This starter does not directly send SMS/WhatsApp messages, make calls, read notifications, control arbitrary apps, or change protected Android settings. Those require separate native integrations, user permissions, and sometimes default-app roles.
- No cloud sync or user account system.
- No secure backend proxy is included.
- No claim is made that the app has performed an action unless the app itself receives confirmation.

## Suggested next milestones

1. Add a small authenticated backend proxy for AI requests.
2. Add a proper native reminder scheduler and notification action buttons.
3. Add Android native intents for selected approved actions.
4. Add encrypted sync / optional account sign-in if needed.
5. Add wake-word support only with a clear opt-in and foreground service.
6. Add tests, accessibility checks, icons, privacy policy, and release signing before public distribution.

## Project layout

```text
jarvis-personal-ai/
  public/manifest.webmanifest
  src/App.jsx
  src/assistant.js
  src/main.jsx
  src/style.css
  capacitor.config.json
  package.json
  README.md
```
