# IntelliNote

IntelliNote is an AI learning studio that turns source material into an interactive explanatory lesson. It accepts files, links, and pasted text, then generates a visual video-style walkthrough, narration, captions, quizzes, and a mind map.

## Features

- Upload PDF, Markdown, and text files
- Paste copied text, notes, transcripts, or Markdown
- Analyze website URLs
- Analyze YouTube links when a public English transcript is available
- Generate interactive explanatory video scenes
- Edit generated scene titles, narration, captions, keywords, and visual prompts
- Generate AI visuals for individual scenes
- Play generated narration with browser speech synthesis
- Toggle captions on and off
- Change playback speed
- Skip backward or forward by 10 seconds
- Generate quizzes with answers and explanations
- Generate a concept mind map
- Optional Gemini AI generation through a backend API key
- Automatic fallback when Gemini is not configured
- Pastel, responsive React interface
- No login required

## Tech Stack

- React
- Vite
- Node.js
- Express
- Multer
- pdf-parse
- Lucide React icons
- Gemini API for text and optional image generation

## How It Works

The backend extracts text from the selected source, then tries to use Gemini as the AI lesson agent. When `GEMINI_API_KEY` is configured on the backend, Gemini generates structured JSON for:

- video scenes
- narration
- captions
- quiz questions
- mind-map branches
- optional scene visuals

If Gemini is not configured or an API call fails, intelliNote automatically falls back to a local NLP-style algorithm that can:

- clean and segment the text
- identify important keywords
- choose high-value summary sentences
- create lesson scenes
- create quiz questions
- build mind-map branches

The app can run without an API key by using the local fallback. For stronger AI generation in deployment, add a Gemini API key to the backend environment. It does not yet export a rendered MP4 video; the current video experience is an interactive browser lesson with speech synthesis, captions, scene controls, and generated visuals.

## Gemini AI Setup

Create a Gemini API key in Google AI Studio:

```text
https://aistudio.google.com/app/apikey
```

Create a `.env` file:

```text
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

Then run intelliNote:

```bash
npm run dev
```

For deployed apps, set the same environment variables in your hosting provider's backend settings. Never put the Gemini API key in frontend React code.

You can use a different Gemini model by changing:

```text
GEMINI_MODEL=gemini-2.5-flash
```

For generated scene visuals, intelliNote uses `gemini-2.5-flash-image` by default. It uses the same Google AI Studio API key as the text agent. Image availability and free-tier limits can vary by region and Google account tier.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the full app:

```bash
npm run dev
```

The frontend runs at:

```text
http://127.0.0.1:5173
```

The backend runs at:

```text
http://127.0.0.1:5174
```

## Build

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```text
.
|-- server/
|   `-- index.js
|-- src/
|   |-- main.jsx
|   `-- styles.css
|-- .env.example
|-- index.html
|-- package.json
|-- vite.config.js
`-- README.md
```

## Notes

- Google Docs and Google Slides should be shared through accessible URLs or exported as readable files.
- YouTube transcript support depends on whether YouTube exposes a public English transcript for the video.
- Browser speech synthesis is used for audio playback, so voice quality depends on the user's browser and system voices.
