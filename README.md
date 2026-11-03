# STARK INTELLIGENCE

A browser-based personal AI assistant using React, Express and Google Gemini.

## Deploy on Render

Create a **Web Service** and connect this repository.

- Runtime: Node
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment variable: `GEMINI_API_KEY` = your Google AI Studio API key

Do not put your real API key in this repository or in frontend code. Add it only in the Render service's Environment settings.

## Local development

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Set `GEMINI_API_KEY` in your environment (or create a local `.env` file using `.env.example` as a guide).
4. Run `npm run build` and then `npm start`.

The app serves the built interface and its `/api` endpoints from the same server. Browser speech recognition and speech synthesis availability depends on the browser and operating system. Microphone access requires a secure context (HTTPS or localhost).
