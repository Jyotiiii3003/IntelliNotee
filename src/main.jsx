import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BadgeCheck,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Globe2,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  Network,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  Target,
  UploadCloud,
  Volume2
} from "lucide-react";
import "./styles.css";

const iconMap = { Sparkles, BookOpen: FileText, Network, Lightbulb, Target, Brain, CheckCircle2 };

function App() {
  const [sourceType, setSourceType] = useState("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [savedLessons, setSavedLessons] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/ai-status")
      .then((response) => response.json())
      .then(setAiStatus)
      .catch(() => setAiStatus(null));
  }, []);

    async function fetchSavedLessons() {
  try {
    const response = await fetch("/api/lessons");

    const data = await response.json();

    setSavedLessons(data);

  } catch (error) {
    console.error(error);
  }
}
  useEffect(() => {
  fetchSavedLessons();
}, []);

  async function analyze() {
    setLoading(true);
    setError("");
    const formData = new FormData();
    if (sourceType === "text" && text.trim()) formData.append("text", text);
    if (sourceType === "url" && text.trim()) formData.append("text", text);
    if (sourceType === "url" && url.trim()) formData.append("url", url.trim());
    if (sourceType === "file" && file) formData.append("file", file);

    try {
      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed.");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="workspace">
        <aside className="source-panel">
          <div className="brand">
            <div className="brand-mark"><Sparkles size={28} /></div>
            <div>
              <p>intelliNote</p>
              <span>AI lesson studio</span>
            </div>
          </div>

          <div className={`ai-status ${aiStatus?.available ? "online" : ""}`}>
            <BadgeCheck size={18} />
            <div>
              <strong>{aiStatus?.available ? "Gemini AI agent active" : "Local fallback ready"}</strong>
              <span>{aiStatus?.available ? `${aiStatus.model} + ${aiStatus.imageModel}` : "Add GEMINI_API_KEY to enable cloud AI generation"}</span>
            </div>
          </div>

          <div className="type-tabs">
            {[
              ["text", "Paste", FileText],
              ["file", "Files", UploadCloud],
              ["url", "URL", Globe2]
            ].map(([id, label, Icon]) => (
              <button
                className={sourceType === id ? "active" : ""}
                onClick={() => {
                  setSourceType(id);
                }}
                key={id}
              >
                <Icon size={18} /> {label}
              </button>
            ))}
          </div>

          {sourceType === "text" && (
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
              placeholder="Paste copied text, Markdown, notes, or a transcript..."
            />
          )}

          {sourceType === "file" && (
            <label className="drop-zone">
              <UploadCloud size={34} />
              <strong>{file ? file.name : "Drop in a PDF, Markdown, or text file"}</strong>
              <span>Google Docs/Slides exports, .pdf, .md, and .txt are supported.</span>
              <input type="file" accept=".pdf,.md,.txt,text/plain,application/pdf,text/markdown" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </label>
          )}

          {sourceType === "url" && (
            <div className="url-box">
              <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a website, Google Docs/Slides, or YouTube link" />
              <textarea
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                }}
                placeholder="Optional: add copied text or a YouTube transcript fallback..."
              />
            </div>
          )}

          <button className="generate" onClick={analyze} disabled={loading}>
            {loading ? <Loader2 className="spin" size={20} /> : <Sparkles size={20} />}
            Generate learning video
          </button>

            <div className="saved-lessons">
  <h3> Saved Lessons</h3>

  {savedLessons.length === 0 ? (
    <p className="empty-lessons">
      No saved lessons yet.
    </p>
  ) : (
    savedLessons.map((lesson) => (
      <button
        key={lesson._id}
        className="lesson-card"
        onClick={() => setResult(lesson)}
      >
        <strong>{lesson.title}</strong>

        <span>
          {new Date(lesson.createdAt).toLocaleDateString()}
        </span>
      </button>
    ))
  )}
</div>

          {error && <p className="error">{error}</p>}
        </aside>

        <section className="output">
          {!result ? <WelcomePanel /> : <Studio result={result} fetchSavedLessons={fetchSavedLessons} />}
        </section>
      </section>
    </main>
  );
}

function WelcomePanel() {
  return (
    <div className="welcome">
      <div className="hero-visual">
        <div className="orbital one" />
        <div className="orbital two" />
        <div className="lesson-card">
          <Sparkles size={32} />
          <h1>Turn dense notes into a guided explanatory video.</h1>
          <p>Upload, paste, or link a source. intelliNote builds scenes, narration, captions, a quiz, and a mind map from the same material.</p>
        </div>
      </div>
      <div className="feature-row">
        {[
          ["Video", "Captions, voice, speed controls, and 10 second jumps."],
          ["Quiz", "Auto-generated checks with explanations."],
          ["Mind map", "A visual concept graph from the source."]
        ].map(([title, body]) => (
          <article className="mini-card" key={title}>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function Studio({ result,fetchSavedLessons }) {
  const [scenes, setScenes] = useState(result.scenes);
  const [activeTab, setActiveTab] = useState("video");
  const [saveMessage, setSaveMessage] = useState("");

  async function saveLesson() {
  try {
    const response = await fetch("/api/save-lesson", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(result)
    });

    const data = await response.json();

    if (data.success) {
      setSaveMessage(" Lesson saved successfully!");
      fetchSavedLessons();
      setTimeout(() => {
      setSaveMessage("");
      }, 3000);
    }

  } catch (error) {
    console.error(error);
  }
}

  useEffect(() => {
    setScenes(result.scenes);
  }, [result]);

  return (
    
    <div className="studio">
      
      
      <div className="studio-tabs">
        <button
          className={activeTab === "video" ? "active" : ""}
          onClick={() => setActiveTab("video")}
        >
          🎥 Video
        </button>

        <button
          className={activeTab === "quiz" ? "active" : ""}
          onClick={() => setActiveTab("quiz")}
        >
          🧠 Quiz
        </button>

        <button
          className={activeTab === "mindmap" ? "active" : ""}
          onClick={() => setActiveTab("mindmap")}
        >
          🕸 Mind Map
        </button>
      </div>

      
      
      <header className="result-header">
        <div>
          <p className="eyebrow">Generated lesson</p>
          <h1>{result.title}</h1>
        </div>

        <div className="stats">
          <span><Brain size={17} /> {result.aiProvider || "AI lesson engine"}</span>
          <span><Clock3 size={17} /> {result.sourceStats.readingMinutes} min read</span>
          <span><FileText size={17} /> {result.sourceStats.words} words</span>
        </div>
      </header>

      <button className="save-btn" onClick={saveLesson}>
           Save Lesson
      </button>
      {saveMessage && (
        <div className="save-message">
        {saveMessage}
        </div>
        )}

      {activeTab === "video" && (
        <VideoExperience
          scenes={scenes}
          onScenesChange={setScenes}
        />
      )}

        

      {activeTab === "quiz" && (
        <div className="lower-grid">
          <Quiz quiz={result.quiz} />
        </div>
      )}

      {activeTab === "mindmap" && (
        <div className="lower-grid">
          <MindMap map={result.mindMap} />
        </div>
      )}

    </div>
  );
}
function VideoExperience({ scenes, onScenesChange }) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [visualLoading, setVisualLoading] = useState(false);
  const [visualError, setVisualError] = useState("");
  const timerRef = useRef(null);
  const scene = scenes[sceneIndex];
  const Icon = iconMap[scene.icon] ?? Sparkles;

  const totalDuration = useMemo(() => scenes.reduce((total, item) => total + item.duration, 0), [scenes]);
  const absoluteTime = scenes.slice(0, sceneIndex).reduce((total, item) => total + item.duration, 0) + elapsed;

  useEffect(() => {
    window.speechSynthesis?.cancel();
    if (playing && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(scene.narration);
      utterance.rate = speed;
      utterance.pitch = 1.04;
      window.speechSynthesis.speak(utterance);
    }
    return () => window.speechSynthesis?.cancel();
  }, [sceneIndex, playing, speed]);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = window.setInterval(() => {
      setElapsed((value) => {
        const next = value + 0.25 * speed;
        if (next >= scene.duration) {
          setSceneIndex((index) => Math.min(index + 1, scenes.length - 1));
          return 0;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(timerRef.current);
  }, [playing, speed, scene.duration, scenes.length]);

  function jump(seconds) {
    let target = Math.max(0, Math.min(totalDuration - 1, absoluteTime + seconds));
    let cursor = 0;
    for (let index = 0; index < scenes.length; index++) {
      const end = cursor + scenes[index].duration;
      if (target < end) {
        setSceneIndex(index);
        setElapsed(target - cursor);
        return;
      }
      cursor = end;
    }
  }

  function updateScene(field, value) {
    onScenesChange(
      scenes.map((item, index) => {
        if (index !== sceneIndex) return item;
        if (field === "visual") {
          return {
            ...item,
            visual: value
              .split(",")
              .map((word) => word.trim())
              .filter(Boolean)
              .slice(0, 4)
          };
        }
        return { ...item, [field]: value };
      })
    );
  }

  async function generateVisual() {
    setVisualLoading(true);
    setVisualError("");
    try {
      const response = await fetch("/api/generate-visual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scene })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Visual generation failed.");
      onScenesChange(scenes.map((item, index) => (index === sceneIndex ? { ...item, imageUrl: data.imageUrl } : item)));
    } catch (error) {
      setVisualError(error.message);
    } finally {
      setVisualLoading(false);
    }
  }

  return (
    <section className="video-shell">
      <div className="stage" style={{ background: `linear-gradient(135deg, ${scene.color}, #fffaf5)` }}>
        <div className="stage-top">
          <span>Scene {scene.id} / {scenes.length}</span>
          <span>{Math.round(absoluteTime)}s / {totalDuration}s</span>
        </div>
        <div className="visual-cluster">
          {scene.imageUrl ? (
            <div className="scene-image">
  <img
    src={scene.imageUrl}
    alt={scene.title}
    onError={(e) => {
      e.target.src =
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3";
    }}
  />
</div>
          ) : (
            <>
              <div className="icon-bubble"><Icon size={54} /></div>
              {scene.visual.map((word, index) => (
                <span className={`keyword k${index}`} key={`${word}-${index}`}>{word}</span>
              ))}
            </>
          )}
        </div>
        <h2>{scene.title}</h2>
        {captions && <p className="caption">{scene.caption}</p>}
        <div className="progress"><span style={{ width: `${(absoluteTime / totalDuration) * 100}%` }} /></div>
      </div>
      <div className="controls">
        <button onClick={() => jump(-10)} title="Back 10 seconds"><RotateCcw size={20} /></button>
        <button className="play" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={22} /> : <Play size={22} />}</button>
        <button onClick={() => jump(10)} title="Forward 10 seconds"><RotateCw size={20} /></button>
        <button onClick={() => setSceneIndex(Math.max(0, sceneIndex - 1))}><ChevronLeft size={20} /></button>
        <button onClick={() => setSceneIndex(Math.min(scenes.length - 1, sceneIndex + 1))}><ChevronRight size={20} /></button>
        <label className="toggle"><input type="checkbox" checked={captions} onChange={(event) => setCaptions(event.target.checked)} /> Captions</label>
        <label className="speed"><Volume2 size={17} /> <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={0.75}>0.75x</option><option value={1}>1x</option><option value={1.25}>1.25x</option><option value={1.5}>1.5x</option><option value={2}>2x</option></select></label>
      </div>
      <div className="scene-editor">
        <div className="editor-header">
          <div>
            <p className="eyebrow">Scene editor</p>
            <h3>Edit before exporting or presenting</h3>
          </div>
          <button className="visual-button" onClick={generateVisual} disabled={visualLoading}>
            {visualLoading ? <Loader2 className="spin" size={18} /> : <ImageIcon size={18} />}
            Generate visual
          </button>
        </div>
        {visualError && <p className="error">{visualError}</p>}
        <div className="editor-grid">
          <label>
            Title
            <input value={scene.title} onChange={(event) => updateScene("title", event.target.value)} />
          </label>
          <label>
            Keywords
            <input value={scene.visual.join(", ")} onChange={(event) => updateScene("visual", event.target.value)} />
          </label>
          <label className="wide">
            Narration
            <textarea value={scene.narration} onChange={(event) => updateScene("narration", event.target.value)} />
          </label>
          <label className="wide">
            Caption
            <textarea value={scene.caption} onChange={(event) => updateScene("caption", event.target.value)} />
          </label>
          <label className="wide">
            Visual prompt
            <textarea value={scene.visualPrompt || ""} onChange={(event) => updateScene("visualPrompt", event.target.value)} />
          </label>
        </div>
      </div>
    </section>
  );
}

function Quiz({ quiz }) {
  const [answers, setAnswers] = useState({});
  return (
    <section className="panel">
      <h2>Knowledge Quiz</h2>
      <div className="quiz-list">
        {quiz.map((item) => (
          <article className="question" key={item.id}>
            <h3>{item.question}</h3>
            <div className="options">
              {item.options.map((option) => {
                const picked = answers[item.id] === option;
                const correct = option === item.answer;
                return (
                  <button
                    className={picked ? (correct ? "correct" : "wrong") : ""}
                    onClick={() => setAnswers({ ...answers, [item.id]: option })}
                    key={option}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {answers[item.id] && <p className="explain">{item.explanation}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function MindMap({ map }) {
  return (
    <section className="panel mind-panel">
      <h2>Mind Map</h2>
      <div className="mindmap">
        <div className="center-node">{map.central}</div>
        {map.branches.map((branch, index) => (
          <div className={`branch branch-${index}`} key={branch.id}>
            <strong>{branch.label}</strong>
            {branch.children.slice(0, 3).map((child) => <span key={child}>{child}</span>)}
          </div>
        ))}
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
