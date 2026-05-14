# intelliNote

intelliNote is an AI-style learning studio that turns source material into an interactive explanatory lesson. It accepts files, links, and pasted text, then generates a visual video-style walkthrough, narration, captions, quizzes, and a mind map.

## Features

- Upload PDF, Markdown, and text files
- Paste copied text, notes, transcripts, or Markdown
- Analyze website URLs
- Analyze YouTube links when a public English transcript is available
- Generate interactive explanatory video scenes
- Play generated narration with browser speech synthesis
- Toggle captions on and off
- Change playback speed
- Skip backward or forward by 10 seconds
- Generate quizzes with answers and explanations
- Generate a concept mind map
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

## How It Works

The backend extracts text from the selected source, then uses a local NLP-style algorithm to:

- clean and segment the text
- identify important keywords
- choose high-value summary sentences
- create lesson scenes
- create quiz questions
- build mind-map branches

The current version does not call an external LLM or video-generation API. It is designed so a hosted AI provider can be added later for richer narration, image generation, and rendered video export.

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
├── server/
│   └── index.js
├── src/
│   ├── main.jsx
│   └── styles.css
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Notes

- Google Docs and Google Slides should be shared through accessible URLs or exported as readable files.
- YouTube transcript support depends on whether YouTube exposes a public English transcript for the video.
- Browser speech synthesis is used for audio playback, so voice quality depends on the user's browser and system voices.

