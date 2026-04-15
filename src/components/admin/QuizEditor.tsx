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
    <div className="max-w-3xl">
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
      <div className="space-y-6">
        {questions.map((q, qi) => (
          <div key={q.id} className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-start gap-3">
              <span className="text-sm text-gray-400 font-mono pt-2 shrink-0">Q{qi + 1}</span>
              <div className="flex-1 space-y-3">
                <input
                  type="text"
                  value={q.title}
                  onChange={(e) => updateQuestion(q.id, { title: e.target.value })}
                  className="w-full text-base font-medium border-0 border-b border-gray-200 focus:border-black focus:outline-none pb-1 bg-transparent"
                  placeholder="Question text"
                />
                <div className="flex gap-3 text-sm">
                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(q.id, { type: e.target.value })}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="single">Single choice</option>
                    <option value="multi">Multiple choice</option>
                    <option value="binary">Binary (Yes/No)</option>
                  </select>
                  <label className="flex items-center gap-1 text-gray-600">
                    Points:
                    <input
                      type="number"
                      value={q.points}
                      onChange={(e) => updateQuestion(q.id, { points: Number(e.target.value) })}
                      className="w-12 border border-gray-300 rounded px-1 py-0.5 text-sm"
                      min={0}
                    />
                  </label>
                </div>

                {/* Choices */}
                <div className="space-y-2">
                  {q.choices.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <input
                        type={q.type === "multi" ? "checkbox" : "radio"}
                        checked={Boolean(c.isCorrect)}
                        onChange={() => toggleCorrect(q.id, c.id, q.type)}
                        className="shrink-0"
                        title="Mark as correct"
                      />
                      <input
                        type="text"
                        value={c.text}
                        onChange={(e) => updateChoice(q.id, c.id, { text: e.target.value })}
                        className="flex-1 text-sm border-0 border-b border-gray-200 focus:border-black focus:outline-none pb-0.5 bg-transparent"
                        placeholder={`Choice ${q.choices.indexOf(c) + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeChoice(q.id, c.id)}
                        className="text-gray-300 hover:text-red-500 text-lg leading-none"
                        title="Remove choice"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addChoice(q.id)}
                    className="text-sm text-gray-400 hover:text-black mt-1"
                  >
                    + Add choice
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeQuestion(q.id)}
                className="text-gray-300 hover:text-red-500 text-xl leading-none shrink-0"
                title="Remove question"
              >
                ×
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addQuestion}
          className="w-full py-3 border-2 border-dashed border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 rounded-lg text-sm"
        >
          + Add Question
        </button>
      </div>
    </div>
  );
}
