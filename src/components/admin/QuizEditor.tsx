"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { buttonClass } from "@/components/ui";

interface Choice {
  id: string;
  text: string;
  isCorrect: number;
  order: number;
}

interface Question {
  id: string;
  title: string;
  description: string | null;
  type: string;
  points: number;
  order: number;
  choices: Choice[];
}

interface QuizData {
  id: string;
  title: string;
  description: string | null;
  timeLimit: number | null;
  questions: Question[];
}

interface Props {
  initialData: QuizData;
  quizId: string;
}

function formatRelative(ms: number | null): string {
  if (ms == null) return "";
  const age = Date.now() - ms;
  if (age < 5000) return "just now";
  if (age < 60000) return `${Math.floor(age / 1000)}s ago`;
  const m = Math.floor(age / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ms).toLocaleString();
}

const QUESTION_TYPE_ICONS: Record<string, string> = {
  single: "●",
  multi: "☰",
  binary: "Y/N",
};

export default function QuizEditor({ initialData, quizId }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData.title);
  const [description, setDescription] = useState(initialData.description ?? "");
  const [timeLimit, setTimeLimit] = useState<number | null>(initialData.timeLimit ?? null);
  const [questions, setQuestions] = useState<Question[]>(initialData.questions);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [savedTick, setSavedTick] = useState(0);

  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({
      title: initialData.title,
      description: initialData.description ?? "",
      timeLimit: initialData.timeLimit ?? null,
      questions: initialData.questions,
    })
  );
  const currentSnapshot = useMemo(
    () => JSON.stringify({ title, description, timeLimit, questions }),
    [title, description, timeLimit, questions]
  );
  const isDirty = currentSnapshot !== savedSnapshot;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Tick label "Saved · 2m ago" forward
  useEffect(() => {
    if (!savedAt) return;
    const id = setInterval(() => setSavedTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [savedAt]);

  // Keep ref to state for the Cmd-S handler (which captures its closure)
  const stateRef = useRef({ isDirty, saving });
  stateRef.current = { isDirty, saving };
  const handleSaveRef = useRef<() => Promise<void>>(null!);

  function validateQuiz(): string[] {
    const problems: string[] = [];
    if (!title.trim()) problems.push("Quiz title is empty.");
    if (questions.length === 0) problems.push("Quiz has no questions.");
    questions.forEach((q, i) => {
      const label = `Question ${i + 1}`;
      if (!q.title.trim()) problems.push(`${label}: missing question text.`);
      if (q.choices.length < 2) problems.push(`${label}: needs at least 2 choices.`);
      const emptyChoices = q.choices.filter((c) => !c.text.trim()).length;
      if (emptyChoices > 0) problems.push(`${label}: ${emptyChoices} empty choice${emptyChoices > 1 ? "s" : ""}.`);
      const correctCount = q.choices.filter((c) => c.isCorrect).length;
      if (correctCount === 0) problems.push(`${label}: no correct answer marked.`);
      if ((q.type === "single" || q.type === "binary") && correctCount > 1) {
        problems.push(`${label}: ${q.type} question can only have one correct answer.`);
      }
    });
    return problems;
  }

  function addQuestion() {
    const newQ: Question = {
      id: uuidv4(),
      title: "",
      description: null,
      type: "single",
      points: 1,
      order: questions.length,
      choices: [
        { id: uuidv4(), text: "", isCorrect: 0, order: 0 },
        { id: uuidv4(), text: "", isCorrect: 0, order: 1 },
      ],
    };
    setQuestions([...questions, newQ]);
  }

  function removeQuestion(qId: string) {
    setQuestions(questions.filter((q) => q.id !== qId));
  }

  function updateQuestion(qId: string, updates: Partial<Question>) {
    setQuestions(
      questions.map((q) => {
        if (q.id !== qId) return q;
        const merged = { ...q, ...updates };
        if (updates.type === "binary" && q.type !== "binary") {
          merged.choices = [
            { id: uuidv4(), text: "Yes", isCorrect: 0, order: 0 },
            { id: uuidv4(), text: "No", isCorrect: 0, order: 1 },
          ];
        }
        if (q.type === "binary" && updates.type && updates.type !== "binary") {
          merged.choices = [
            { id: uuidv4(), text: "", isCorrect: 0, order: 0 },
            { id: uuidv4(), text: "", isCorrect: 0, order: 1 },
          ];
        }
        return merged;
      })
    );
  }

  function addChoice(qId: string) {
    setQuestions(
      questions.map((q) => {
        if (q.id !== qId) return q;
        return {
          ...q,
          choices: [
            ...q.choices,
            { id: uuidv4(), text: "", isCorrect: 0, order: q.choices.length },
          ],
        };
      })
    );
  }

  function removeChoice(qId: string, cId: string) {
    setQuestions(
      questions.map((q) => {
        if (q.id !== qId) return q;
        return { ...q, choices: q.choices.filter((c) => c.id !== cId) };
      })
    );
  }

  function updateChoice(qId: string, cId: string, updates: Partial<Choice>) {
    setQuestions(
      questions.map((q) => {
        if (q.id !== qId) return q;
        return {
          ...q,
          choices: q.choices.map((c) => (c.id === cId ? { ...c, ...updates } : c)),
        };
      })
    );
  }

  function toggleCorrect(qId: string, cId: string, type: string) {
    setQuestions(
      questions.map((q) => {
        if (q.id !== qId) return q;
        if (type === "multi") {
          return {
            ...q,
            choices: q.choices.map((c) =>
              c.id === cId ? { ...c, isCorrect: c.isCorrect ? 0 : 1 } : c
            ),
          };
        } else {
          return {
            ...q,
            choices: q.choices.map((c) => ({
              ...c,
              isCorrect: c.id === cId ? 1 : 0,
            })),
          };
        }
      })
    );
  }

  async function handleSave() {
    if (!stateRef.current.isDirty) return;
    setSaving(true);
    setError("");

    const res = await fetch(`/api/quizzes/${quizId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        timeLimit,
        questions,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setSavedAt(Date.now());
      setSavedSnapshot(JSON.stringify({ title, description, timeLimit, questions }));
    } else {
      setError("Failed to save. Please try again.");
    }
  }
  handleSaveRef.current = handleSave;

  // Cmd/Ctrl-S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!stateRef.current.saving && stateRef.current.isDirty) {
          void handleSaveRef.current?.();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function handleStartSession() {
    setError("");
    const problems = validateQuiz();
    if (problems.length > 0) {
      setError("Cannot start session:\n• " + problems.join("\n• "));
      return;
    }
    if (isDirty) {
      const ok = confirm("You have unsaved changes. Save before starting the session?");
      if (ok) {
        await handleSave();
      }
    }
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId }),
    });
    if (res.ok) {
      const session = (await res.json()) as { id: string };
      router.push(`/admin/sessions/${session.id}/present`);
    } else {
      setError("Failed to start session.");
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this quiz? This cannot be undone.")) return;
    await fetch(`/api/quizzes/${quizId}`, { method: "DELETE" });
    router.push("/admin/quizzes");
  }

  void savedTick;
  const saveLabel = saving
    ? "Saving…"
    : isDirty
    ? "Save"
    : savedAt
    ? `Saved · ${formatRelative(savedAt)}`
    : "Saved";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-3xl font-bold tracking-tight w-full border-0 border-b-2 border-transparent focus:border-ink focus:outline-none bg-transparent"
            placeholder="Quiz title"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-sm text-ink-muted w-full border-0 focus:outline-none bg-transparent mt-2 placeholder:text-ink-faint"
            placeholder="Description (optional)"
          />
          <div className="flex items-center gap-2 mt-3 text-xs text-ink-muted">
            <label htmlFor="quiz-time-limit">Time per question</label>
            <input
              id="quiz-time-limit"
              type="number"
              min={0}
              value={timeLimit ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  setTimeLimit(null);
                } else {
                  const n = parseInt(v, 10);
                  setTimeLimit(Number.isFinite(n) && n > 0 ? n : null);
                }
              }}
              placeholder="No limit"
              className="w-24 border border-line rounded px-2 py-1 text-xs focus-visible:outline-none focus-visible:border-ink"
            />
            <span className="text-ink-faint">seconds · blank for no limit</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-ink-faint hidden sm:inline mr-1 tabular-nums">
            {isDirty ? "Unsaved" : savedAt ? `Saved · ${formatRelative(savedAt)}` : ""}
          </span>
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={buttonClass("primary", "md")}
            title="Save (Cmd/Ctrl-S)"
          >
            {saveLabel}
          </button>
          <button
            onClick={handleStartSession}
            className={buttonClass("secondary", "md")}
          >
            Start session
          </button>
          <button
            onClick={handleDelete}
            className={buttonClass("danger", "md")}
          >
            Delete
          </button>
        </div>
      </div>

      {error && (
        <pre className="text-sm text-danger mb-4 whitespace-pre-wrap font-sans bg-danger-soft border border-danger/20 rounded-md p-3">
          {error}
        </pre>
      )}

      <div className="space-y-4">
        {questions.map((q, qi) => {
          const types: { value: string; label: string }[] = [
            { value: "single", label: "Single" },
            { value: "multi", label: "Multi" },
            { value: "binary", label: "Yes/No" },
          ];
          return (
            <div
              key={q.id}
              className="group relative rounded-xl bg-surface-muted ring-1 ring-line hover:ring-line-strong focus-within:ring-ink focus-within:bg-surface transition p-5"
            >
              <button
                type="button"
                onClick={() => removeQuestion(q.id)}
                className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-ink-faint hover:text-danger hover:bg-danger-soft transition opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                title="Remove question"
                aria-label={`Remove question ${qi + 1}`}
              >
                ×
              </button>

              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-ink-strong text-surface text-[11px] font-semibold tracking-wide font-mono">
                  Q{qi + 1}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                  <span aria-hidden>{QUESTION_TYPE_ICONS[q.type] ?? "?"}</span>
                  <span>{q.type}</span>
                </span>
              </div>

              <input
                type="text"
                value={q.title}
                onChange={(e) => updateQuestion(q.id, { title: e.target.value })}
                className="w-full text-lg font-medium border-0 focus:outline-none bg-transparent placeholder:text-ink-faint"
                placeholder="Question text"
              />

              <div className="flex items-center gap-3 mt-3 mb-4 flex-wrap">
                <div className="inline-flex p-0.5 rounded-full bg-surface-sunken text-xs">
                  {types.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => updateQuestion(q.id, { type: t.value })}
                      className={`px-3 py-1 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                        q.type === t.value
                          ? "bg-surface text-ink shadow-sm font-medium"
                          : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="inline-flex items-center gap-1 rounded-full bg-surface-sunken text-xs px-1 py-0.5">
                  <span className="pl-2 pr-1 text-ink-muted">Points</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateQuestion(q.id, { points: Math.max(0, q.points - 1) })
                    }
                    className="w-6 h-6 rounded-full hover:bg-surface text-ink-muted hover:text-ink flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    aria-label="Decrease points"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-medium tabular-nums">
                    {q.points}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuestion(q.id, { points: q.points + 1 })}
                    className="w-6 h-6 rounded-full hover:bg-surface text-ink-muted hover:text-ink flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    aria-label="Increase points"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                {q.choices.map((c, ci) => {
                  const isCorrect = Boolean(c.isCorrect);
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-surface transition"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCorrect(q.id, c.id, q.type)}
                        title="Mark as correct"
                        aria-label={isCorrect ? "Correct answer" : "Mark as correct"}
                        className={`shrink-0 w-5 h-5 flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                          q.type === "multi" ? "rounded-[5px]" : "rounded-full"
                        } ${
                          isCorrect
                            ? "bg-ink-strong border-2 border-ink-strong"
                            : "border-2 border-line-strong hover:border-ink"
                        }`}
                      >
                        {isCorrect && (
                          <svg
                            viewBox="0 0 12 12"
                            className="w-3 h-3 text-surface"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="2.5,6.5 5,9 9.5,3.5" />
                          </svg>
                        )}
                      </button>
                      {q.type === "binary" ? (
                        <span className="flex-1 text-sm text-ink-muted select-none">{c.text}</span>
                      ) : (
                        <input
                          type="text"
                          value={c.text}
                          onChange={(e) =>
                            updateChoice(q.id, c.id, { text: e.target.value })
                          }
                          className="flex-1 text-sm border-0 focus:outline-none bg-transparent placeholder:text-ink-faint"
                          placeholder={`Choice ${ci + 1}`}
                        />
                      )}
                      {q.type !== "binary" && (
                        <button
                          type="button"
                          onClick={() => removeChoice(q.id, c.id)}
                          className="w-6 h-6 flex items-center justify-center rounded-full text-ink-faint hover:text-danger hover:bg-danger-soft transition opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                          title="Remove choice"
                          aria-label={`Remove choice ${ci + 1}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
                {q.type !== "binary" && (
                  <button
                    type="button"
                    onClick={() => addChoice(q.id)}
                    className="ml-2 mt-1 text-xs text-ink-muted hover:text-ink transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded px-1"
                  >
                    + Add choice
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addQuestion}
          className="w-full py-4 rounded-xl border border-dashed border-line-strong text-ink-muted hover:border-ink hover:text-ink hover:bg-surface-muted text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          + Add question
        </button>
      </div>
    </div>
  );
}
