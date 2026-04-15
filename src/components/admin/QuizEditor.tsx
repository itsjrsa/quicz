"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

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
  questions: Question[];
}

interface Props {
  initialData: QuizData;
  quizId: string;
}

export default function QuizEditor({ initialData, quizId }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData.title);
  const [description, setDescription] = useState(initialData.description ?? "");
  const [questions, setQuestions] = useState<Question[]>(initialData.questions);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

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
    setQuestions(questions.map((q) => (q.id === qId ? { ...q, ...updates } : q)));
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
          // Toggle for multi
          return {
            ...q,
            choices: q.choices.map((c) =>
              c.id === cId ? { ...c, isCorrect: c.isCorrect ? 0 : 1 } : c
            ),
          };
        } else {
          // Single/binary: only one correct
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
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch(`/api/quizzes/${quizId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: description || null, questions }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError("Failed to save. Please try again.");
    }
  }

  async function handleStartSession() {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId }),
    });
    if (res.ok) {
      const session = await res.json() as { id: string };
      router.push(`/admin/sessions/${session.id}/present`);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this quiz? This cannot be undone.")) return;
    await fetch(`/api/quizzes/${quizId}`, { method: "DELETE" });
    router.push("/admin/quizzes");
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex-1 mr-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-3xl font-bold w-full border-0 border-b-2 border-transparent focus:border-black focus:outline-none bg-transparent"
            placeholder="Quiz title"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-sm text-gray-500 w-full border-0 focus:outline-none bg-transparent mt-1"
            placeholder="Description (optional)"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </button>
          <button
            onClick={handleStartSession}
            className="px-4 py-2 border border-black text-sm font-medium rounded-md hover:bg-gray-50"
          >
            Start Session
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm text-red-600 hover:text-red-800"
          >
            Delete
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* Questions */}
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
              className="group relative rounded-xl bg-gray-50/60 ring-1 ring-gray-200/70 hover:ring-gray-300 focus-within:ring-gray-400 focus-within:bg-white transition p-5"
            >
              <button
                type="button"
                onClick={() => removeQuestion(q.id)}
                className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
                title="Remove question"
              >
                ×
              </button>

              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-black text-white text-[11px] font-semibold tracking-wide">
                  Q{qi + 1}
                </span>
              </div>

              <input
                type="text"
                value={q.title}
                onChange={(e) => updateQuestion(q.id, { title: e.target.value })}
                className="w-full text-lg font-medium border-0 focus:outline-none bg-transparent placeholder:text-gray-300"
                placeholder="Question text"
              />

              <div className="flex items-center gap-3 mt-2 mb-4">
                <div className="inline-flex p-0.5 rounded-full bg-gray-200/70 text-xs">
                  {types.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => updateQuestion(q.id, { type: t.value })}
                      className={`px-3 py-1 rounded-full transition ${
                        q.type === t.value
                          ? "bg-white text-black shadow-sm font-medium"
                          : "text-gray-500 hover:text-black"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="inline-flex items-center gap-1 rounded-full bg-gray-200/70 text-xs px-1 py-0.5">
                  <span className="pl-2 pr-1 text-gray-500">Points</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateQuestion(q.id, { points: Math.max(0, q.points - 1) })
                    }
                    className="w-6 h-6 rounded-full hover:bg-white text-gray-600 hover:text-black flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-medium tabular-nums">
                    {q.points}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuestion(q.id, { points: q.points + 1 })}
                    className="w-6 h-6 rounded-full hover:bg-white text-gray-600 hover:text-black flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Choices */}
              <div className="space-y-1">
                {q.choices.map((c, ci) => {
                  const isCorrect = Boolean(c.isCorrect);
                  return (
                    <div
                      key={c.id}
                      className="group/choice flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white transition"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCorrect(q.id, c.id, q.type)}
                        title="Mark as correct"
                        className={`shrink-0 w-5 h-5 flex items-center justify-center transition ${
                          q.type === "multi" ? "rounded-[5px]" : "rounded-full"
                        } ${
                          isCorrect
                            ? "bg-black border-2 border-black"
                            : "border-2 border-gray-300 hover:border-gray-500"
                        }`}
                      >
                        {isCorrect && (
                          <svg
                            viewBox="0 0 12 12"
                            className="w-3 h-3 text-white"
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
                      <input
                        type="text"
                        value={c.text}
                        onChange={(e) =>
                          updateChoice(q.id, c.id, { text: e.target.value })
                        }
                        className="flex-1 text-sm border-0 focus:outline-none bg-transparent placeholder:text-gray-300"
                        placeholder={`Choice ${ci + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeChoice(q.id, c.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover/choice:opacity-100 transition"
                        title="Remove choice"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => addChoice(q.id)}
                  className="ml-2 mt-1 text-xs text-gray-400 hover:text-black transition"
                >
                  + Add choice
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addQuestion}
          className="w-full py-4 rounded-xl border border-dashed border-gray-300 text-gray-400 hover:border-black hover:text-black hover:bg-gray-50 text-sm font-medium transition"
        >
          + Add Question
        </button>
      </div>
    </div>
  );
}
