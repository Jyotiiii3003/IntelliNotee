import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const PORT = process.env.PORT || 5174;

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
      icon: icons[index % icons.length]
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
      icon: "Sparkles"
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
  const id = new URL(url).searchParams.get("v") ?? url.match(/youtu\.be\/([^?]+)/)?.[1];
  if (!id) throw new Error("Could not identify the YouTube video id.");
  const transcriptUrl = `https://video.google.com/timedtext?lang=en&v=${id}`;
  const response = await fetch(transcriptUrl);
  const xml = await response.text();
  const transcript = xml
    .replace(/<text[^>]*>/g, " ")
    .replace(/<\/text>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  if (cleanText(transcript).length < 80) {
    throw new Error("No public English transcript was found. Paste the transcript text to analyze this video.");
  }
  return cleanText(transcript);
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

    const scenes = buildScenes(text);
    res.json({
      title: titleFromText(text),
      sourceStats: {
        words: text.split(/\s+/).filter(Boolean).length,
        characters: text.length,
        readingMinutes: Math.max(1, Math.round(text.split(/\s+/).length / 190))
      },
      keywords: keywords(text, 14),
      summary: summarize(text, 7),
      scenes,
      quiz: buildQuiz(text),
      mindMap: buildMindMap(text)
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Analysis failed." });
  }
});

app.listen(PORT, () => {
  console.log(`intelliNote backend running on http://127.0.0.1:${PORT}`);
});
