import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import { existsSync, readFileSync } from "node:fs";
import mongoose from "mongoose";
import { YoutubeTranscript } from "youtube-transcript";

const lessonSchema = new mongoose.Schema({
  title: String,
  aiProvider: String,

  sourceStats: {
    words: Number,
    characters: Number,
    readingMinutes: Number
  },

  summary: [String],

  scenes: [
    {
      id: Number,
      title: String,
      narration: String,
      caption: String,
      visual: [String],
      duration: Number,
      color: String,
      icon: String,
      imageUrl: String,
      visualPrompt: String
    }
  ],

  quiz: [
    {
      id: Number,
      question: String,
      options: [String],
      answer: String,
      explanation: String
    }
  ],

  mindMap: {
    central: String,
    branches: [
      {
        id: String,
        label: String,
        strength: Number,
        children: [String]
      }
    ]
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Lesson = mongoose.model("Lesson", lessonSchema);

function loadLocalEnv() {
  if (!existsSync(".env")) return;
  const lines = readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = valueParts.join("=").trim();
  }
}

loadLocalEnv();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Error:", err));

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const PORT = process.env.PORT || 5174;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_IMAGE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;

app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));

const STOPWORDS = new Set(
  "a an and are as at be been being but by can could did do does doing for from had has have he her hers him his i if in into is it its itself just me more most my no not of on or our ours she should so than that the their theirs them then there these they this those to too up very was we were what when where which who why will with you your yours".split(
    " "
  )
);

function cleanText(text = "") {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitSentences(text) {
  return cleanText(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 24);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9'-]{2,}/g)
    ?.filter((word) => !STOPWORDS.has(word)) ?? [];
}

function keywords(text, limit = 14) {
  const counts = new Map();
  for (const word of tokenize(text)) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

function summarize(text, limit = 6) {
  const sentences = splitSentences(text);
  const keySet = new Set(keywords(text, 28).map((item) => item.word));
  return sentences
    .map((sentence, index) => {
      const words = tokenize(sentence);
      const score = words.reduce((total, word) => total + (keySet.has(word) ? 2 : 0.35), 0) / Math.max(5, words.length) + (index < 5 ? 0.35 : 0);
      return { sentence, index, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);
}

function titleFromText(text) {
  const firstLine = cleanText(text).split("\n").find((line) => line.trim().length > 8);
  if (!firstLine) return "Untitled lesson";
  const sentence = firstLine.replace(/^#+\s*/, "").split(/(?<=[.!?])\s+/)[0];
  if (sentence.length <= 72) return sentence;
  return `${sentence.slice(0, 69).replace(/\s+\S*$/, "")}...`;
}

function buildScenes(text) {
  const summary = summarize(text, 7);
  const keyTerms = keywords(text, 12);
  const palette = ["#EFD8F7", "#CDEAE4", "#FFE3C8", "#D9E7FF", "#F8D7DA", "#DCF5D4", "#FDECC8"];
  const icons = ["Sparkles", "BookOpen", "Network", "Lightbulb", "Target", "Brain", "CheckCircle2"];
  const scenes = summary.map((sentence, index) => {
    const sceneKeywords = keywords(sentence, 4).map((item) => item.word);
    return {
      id: index + 1,
      title: index === 0 ? titleFromText(text) : `Idea ${index + 1}`,
      narration: sentence,
      caption: sentence,
      visual: sceneKeywords.length ? sceneKeywords : keyTerms.slice(index, index + 4).map((item) => item.word),
      duration: Math.max(7, Math.min(15, Math.ceil(sentence.split(/\s+/).length / 2.6))),
      color: palette[index % palette.length],
      icon: icons[index % icons.length],
      visualPrompt: `A pastel educational illustration about ${sceneKeywords.join(", ") || sentence}. Clean modern learning-video style, no text labels.`
    };
  });
  if (scenes.length === 0) {
    scenes.push({
      id: 1,
      title: "Your lesson",
      narration: "Add richer source material to generate a complete explanatory video, quiz, and mind map.",
      caption: "Add richer source material to generate a complete explanatory video, quiz, and mind map.",
      visual: ["source", "lesson", "ideas"],
      duration: 9,
      color: "#EFD8F7",
      icon: "Sparkles",
      visualPrompt: "A pastel educational illustration of organized study notes becoming a clear lesson video, no text labels."
    });
  }
  return scenes;
}

function buildQuiz(text) {
  const sourceSentences = summarize(text, 8);
  const keyTerms = keywords(text, 16).map((item) => item.word);
  return sourceSentences.slice(0, 6).map((sentence, index) => {
    const answer = keywords(sentence, 1)[0]?.word ?? keyTerms[index] ?? "concept";
    const distractors = keyTerms.filter((term) => term !== answer).slice(index, index + 3);
    while (distractors.length < 3) distractors.push(["context", "evidence", "summary"][distractors.length]);
    const options = [answer, ...distractors].sort((a, b) => a.localeCompare(b));
    return {
      id: index + 1,
      question: `Which idea is most connected to: "${sentence.slice(0, 110)}${sentence.length > 110 ? "..." : ""}"?`,
      options,
      answer,
      explanation: sentence
    };
  });
}

function buildMindMap(text) {
  const central = titleFromText(text);
  const branches = keywords(text, 8).map((term, index) => {
    const related = splitSentences(text)
      .filter((sentence) => sentence.toLowerCase().includes(term.word))
      .slice(0, 3)
      .map((sentence) => keywords(sentence, 3).map((item) => item.word))
      .flat()
      .filter((word) => word !== term.word);
    return {
      id: `branch-${index}`,
      label: term.word,
      strength: term.count,
      children: [...new Set(related)].slice(0, 4)
    };
  });
  return { central, branches };
}

function buildAlgorithmLesson(text) {
  return {
    title: titleFromText(text),
    aiProvider: "Local algorithm",
    sourceStats: {
      words: text.split(/\s+/).filter(Boolean).length,
      characters: text.length,
      readingMinutes: Math.max(1, Math.round(text.split(/\s+/).length / 190))
    },
    keywords: keywords(text, 14),
    summary: summarize(text, 7),
    scenes: buildScenes(text),
    quiz: buildQuiz(text),
    mindMap: buildMindMap(text)
  };
}

function extractJson(content) {
  const trimmed = cleanText(content);
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI response did not contain JSON.");
    return JSON.parse(match[0]);
  }
}

function normalizeAiLesson(aiLesson, fallback, text) {
  const palette = ["#EFD8F7", "#CDEAE4", "#FFE3C8", "#D9E7FF", "#F8D7DA", "#DCF5D4", "#FDECC8"];
  const icons = ["Sparkles", "BookOpen", "Network", "Lightbulb", "Target", "Brain", "CheckCircle2"];
  const title = cleanText(aiLesson.title || fallback.title || titleFromText(text));
  const scenes = Array.isArray(aiLesson.scenes) ? aiLesson.scenes : [];
  const quiz = Array.isArray(aiLesson.quiz) ? aiLesson.quiz : [];
  const branches = Array.isArray(aiLesson.mindMap?.branches) ? aiLesson.mindMap.branches : [];

  return {
    ...fallback,
    title: title || fallback.title,
    aiProvider: `Gemini ${GEMINI_MODEL}`,
    summary: Array.isArray(aiLesson.summary) && aiLesson.summary.length ? aiLesson.summary.map((item) => cleanText(String(item))).filter(Boolean).slice(0, 7) : fallback.summary,
    scenes: scenes.length
      ? scenes.slice(0, 7).map((scene, index) => ({
          id: index + 1,
          title: cleanText(scene.title || `Idea ${index + 1}`).slice(0, 90),
          narration: cleanText(scene.narration || scene.caption || fallback.scenes[index]?.narration || ""),
          caption: cleanText(scene.caption || scene.narration || fallback.scenes[index]?.caption || ""),
          visual: Array.isArray(scene.visual) && scene.visual.length ? scene.visual.map((item) => cleanText(String(item)).slice(0, 24)).filter(Boolean).slice(0, 4) : fallback.scenes[index]?.visual || [],
          duration: Number.isFinite(Number(scene.duration)) ? Math.max(7, Math.min(18, Number(scene.duration))) : fallback.scenes[index]?.duration || 9,
          color: palette[index % palette.length],
          icon: icons.includes(scene.icon) ? scene.icon : icons[index % icons.length],
          imageUrl: cleanText(scene.imageUrl || ""),
          visualPrompt: cleanText(
            scene.visualPrompt ||
              `A pastel educational illustration for this lesson scene: ${scene.title || scene.narration || fallback.scenes[index]?.narration || ""}. Clean modern learning-video style, no text labels.`
          )
        }))
      : fallback.scenes,
    quiz: quiz.length
      ? quiz.slice(0, 6).map((item, index) => {
          const options = Array.isArray(item.options) ? item.options.map((option) => cleanText(String(option))).filter(Boolean).slice(0, 4) : [];
          const answer = cleanText(String(item.answer || options[0] || ""));
          if (answer && !options.includes(answer)) options.unshift(answer);
          while (options.length < 4) options.push(["Main idea", "Evidence", "Context", "Result"][options.length]);
          return {
            id: index + 1,
            question: cleanText(item.question || fallback.quiz[index]?.question || `Question ${index + 1}`),
            options: options.slice(0, 4),
            answer: answer || options[0],
            explanation: cleanText(item.explanation || fallback.quiz[index]?.explanation || "")
          };
        })
      : fallback.quiz,
    mindMap: {
      central: cleanText(aiLesson.mindMap?.central || title || fallback.mindMap.central),
      branches: branches.length
        ? branches.slice(0, 8).map((branch, index) => ({
            id: `branch-${index}`,
            label: cleanText(branch.label || `Idea ${index + 1}`).slice(0, 24),
            strength: Number.isFinite(Number(branch.strength)) ? Number(branch.strength) : index + 1,
            children: Array.isArray(branch.children) ? branch.children.map((child) => cleanText(String(child)).slice(0, 24)).filter(Boolean).slice(0, 4) : []
          }))
        : fallback.mindMap.branches
    }
  };
}

async function generateWithGemini(text, fallback) {
  if (!GEMINI_API_KEY) return fallback;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  const source = text.slice(0, 12000);
  const prompt = `You are intelliNote, an educational AI lesson agent.
Create a concise interactive learning lesson from the source text.
Return only valid JSON with this exact structure:
{
  "title": "short lesson title",
  "summary": ["5 to 7 clear bullet sentences"],
  "scenes": [
    {
      "title": "scene title",
      "narration": "friendly voiceover script, 1 or 2 sentences",
      "caption": "short caption",
      "visual": ["keyword", "keyword", "keyword", "keyword"],
      "duration": 8,
      "icon": "Sparkles"
    }
  ],
  "quiz": [
    {
      "question": "multiple choice question",
      "options": ["A", "B", "C", "D"],
      "answer": "exact correct option",
      "explanation": "why it is correct"
    }
  ],
  "mindMap": {
    "central": "central concept",
    "branches": [
      { "label": "concept", "strength": 3, "children": ["detail", "detail"] }
    ]
  }
}
Use 4 to 7 scenes, 4 to 6 quiz questions, and 5 to 8 mind-map branches.
Allowed icons: Sparkles, BookOpen, Network, Lightbulb, Target, Brain, CheckCircle2.

Source text:
${source}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.35,
          maxOutputTokens: 2800
        }
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Gemini responded with ${response.status}`);
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
    return normalizeAiLesson(extractJson(content), fallback, text);
  } catch (error) {
    console.warn(`Gemini unavailable, using local algorithm: ${error.message}`);
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

async function extractFromUrl(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "intelliNote/1.0 educational summarizer"
    }
  });
  if (!response.ok) throw new Error(`Could not fetch URL (${response.status})`);
  const html = await response.text();
  return cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
  );
}

async function getYouTubeTranscript(url) {
  let videoId = "";

  if (url.includes("youtube.com")) {
    videoId = new URL(url).searchParams.get("v");
  } else if (url.includes("youtu.be")) {
    videoId = url.split("youtu.be/")[1]?.split("?")[0];
  }

  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    const text = transcript
      .map((item) => item.text)
      .join(" ");

    if (!text || text.length < 50) {
      throw new Error("Transcript too short");
    }

    return cleanText(text);

  } catch (error) {
    console.error(error);

    throw new Error(
      "Could not fetch YouTube transcript. This video may not have captions enabled."
    );
  }
}

app.post("/api/analyze", upload.single("file"), async (req, res) => {
  try {
    let text = cleanText(req.body.text ?? "");
    const url = cleanText(req.body.url ?? "");

    if (req.file) {
      if (req.file.mimetype === "application/pdf" || req.file.originalname.toLowerCase().endsWith(".pdf")) {
        const parsed = await pdfParse(req.file.buffer);
        text = cleanText(`${text}\n\n${parsed.text}`);
      } else {
        text = cleanText(`${text}\n\n${req.file.buffer.toString("utf8")}`);
      }
    }

    if (url) {
      const remoteText = /youtube\.com|youtu\.be/.test(url) ? await getYouTubeTranscript(url) : await extractFromUrl(url);
      text = cleanText(`${text}\n\n${remoteText}`);
    }

    if (text.length < 80) {
      return res.status(422).json({ error: "Please provide more source text, a readable file, or a URL with enough content." });
    }

    const fallback = buildAlgorithmLesson(text);
    const lesson = await generateWithGemini(text, fallback);
    res.json(lesson);
  } catch (error) {
    res.status(500).json({ error: error.message || "Analysis failed." });
  }
});

app.get("/api/ai-status", async (req, res) => {
  res.json({
    provider: GEMINI_API_KEY ? "Gemini" : "Local algorithm",
    model: GEMINI_MODEL,
    imageModel: GEMINI_IMAGE_MODEL,
    available: Boolean(GEMINI_API_KEY),
    configured: Boolean(GEMINI_API_KEY)
  });
});

app.post("/api/generate-visual", async (req, res) => {
  try {
    const { scene } = req.body;

    if (!scene) {
      return res.status(400).json({
        error: "Scene data missing"
      });
    }

    const query = [
  scene.title,
  ...(scene.visual || []),
  "education",
  "diagram",
  "technology"
]
  .filter(Boolean)
  .join(" ");

   const imageUrl = `https://loremflickr.com/1200/700/${encodeURIComponent(query)}?random=${Date.now()}`;

    res.json({
      imageUrl
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to generate visual"
    });
  }
});
app.listen(PORT, () => {
  console.log(`intelliNote backend running on http://127.0.0.1:${PORT}`);
});

app.post("/api/save-lesson", async (req, res) => {
  try {
    console.log("Saving lesson...");

    const lesson = new Lesson(req.body);

    await lesson.save();

    console.log("Lesson saved!");

    res.json({
      success: true,
      lesson
    });

  } catch (error) {
    console.error("SAVE ERROR:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

app.get("/api/lessons", async (req, res) => {
  try {
    const lessons = await Lesson.find()
      .sort({ createdAt: -1 });

    res.json(lessons);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch lessons"
    });
  }
});

app.delete("/api/lessons/:id", async (req, res) => {
  try {
    await Lesson.findByIdAndDelete(req.params.id);

    res.json({
      success: true
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to delete lesson"
    });
  }
});