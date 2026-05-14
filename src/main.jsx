import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BadgeCheck,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Globe2,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
          {error && <p className="error">{error}</p>}
        </aside>

        <section className="output">
          {!result ? <WelcomePanel /> : <Studio result={result} />}
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

function Studio({ result }) {
  return (
    <div className="studio">
      <header className="result-header">
        <div>
          <p className="eyebrow">Generated lesson</p>
          <h1>{result.title}</h1>
        </div>
        <div className="stats">
          <span><Clock3 size={17} /> {result.sourceStats.readingMinutes} min read</span>
          <span><FileText size={17} /> {result.sourceStats.words} words</span>
        </div>
      </header>
      <VideoExperience scenes={result.scenes} />
      <div className="lower-grid">
        <Quiz quiz={result.quiz} />
        <MindMap map={result.mindMap} />
      </div>
    </div>
  );
}

function VideoExperience({ scenes }) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [elapsed, setElapsed] = useState(0);
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

  return (
    <section className="video-shell">
      <div className="stage" style={{ background: `linear-gradient(135deg, ${scene.color}, #fffaf5)` }}>
        <div className="stage-top">
          <span>Scene {scene.id} / {scenes.length}</span>
          <span>{Math.round(absoluteTime)}s / {totalDuration}s</span>
        </div>
        <div className="visual-cluster">
          <div className="icon-bubble"><Icon size={54} /></div>
          {scene.visual.map((word, index) => (
            <span className={`keyword k${index}`} key={`${word}-${index}`}>{word}</span>
          ))}
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
