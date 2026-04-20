"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";
import { validateImportedQuiz, type ImportedQuiz } from "@/lib/quiz-import";

type Props = {
  quizId: string;
  onClose: () => void;
};

type PreviewState =
  | { kind: "empty" }
  | { kind: "parsing"; fileName: string }
  | { kind: "valid"; fileName: string; quiz: ImportedQuiz; raw: unknown }
  | { kind: "invalid"; fileName: string; error: string };

const FORMAT_EXAMPLE = `{
  "title": "Quiz title",           // required
  "description": "Optional",       // optional
  "questions": [
    {
      "title": "Question text",    // required
      "description": "Optional",   // optional
      "type": "single",            // "single" | "multi" | "binary"
      "points": 1,                 // optional, default 1
      "choices": [                 // >= 2 required
        { "text": "Answer A", "isCorrect": true },
        { "text": "Answer B", "isCorrect": false }
      ]
    }
  ]
}`;

export default function ImportQuizModal({ quizId, onClose }: Props) {
  const [preview, setPreview] = useState<PreviewState>({ kind: "empty" });
  const [importing, setImporting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setSubmitError("");
    setPreview({ kind: "parsing", fileName: file.name });
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const quiz = validateImportedQuiz(json);
      setPreview({ kind: "valid", fileName: file.name, quiz, raw: json });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid JSON file.";
      setPreview({ kind: "invalid", fileName: file.name, error: msg });
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function handleImport() {
    if (preview.kind !== "valid") return;
    setImporting(true);
    setSubmitError("");
    const res = await fetch(`/api/quizzes/${quizId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preview.raw),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setSubmitError(data.error ?? "Import failed.");
      setImporting(false);
    }
  }

  const stats =
    preview.kind === "valid"
      ? {
          questionCount: preview.quiz.questions.length,
          totalPoints: preview.quiz.questions.reduce(
            (sum, q) => sum + (q.points ?? 1),
            0
          ),
          totalChoices: preview.quiz.questions.reduce(
            (sum, q) => sum + q.choices.length,
            0
          ),
          byType: {
            single: preview.quiz.questions.filter((q) => q.type === "single").length,
            multi: preview.quiz.questions.filter((q) => q.type === "multi").length,
            binary: preview.quiz.questions.filter((q) => q.type === "binary").length,
          },
        }
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Import quiz"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface rounded-2xl shadow-xl border border-line p-6 quicz-fade-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold tracking-tight">Import quiz</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-md text-ink-faint hover:text-ink hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-ink-muted mb-4">
          Import replaces all questions and choices in this quiz. This cannot be undone.
        </p>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            if (!dragOver) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`block rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition ${
            dragOver
              ? "border-ink bg-surface-muted"
              : "border-line-strong hover:border-ink hover:bg-surface-muted"
          }`}
        >
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <p className="text-sm font-medium break-all">
            {preview.kind === "empty"
              ? "Drop a .json file here or click to browse"
              : preview.kind === "parsing"
              ? "Reading…"
              : preview.fileName}
          </p>
          {preview.kind !== "empty" && preview.kind !== "parsing" && (
            <p className="text-xs text-ink-faint mt-1">Click to pick a different file</p>
          )}
        </label>

        {preview.kind === "invalid" && (
          <div className="mt-4 text-sm text-danger bg-danger-soft border border-danger/20 rounded-md p-3">
            {preview.error}
          </div>
        )}

        {preview.kind === "valid" && stats && (
          <div className="mt-4 rounded-xl border border-line bg-surface-muted p-4">
            <p className="text-xs uppercase tracking-wider text-ink-faint font-mono mb-2">
              Preview
            </p>
            <p className="font-semibold truncate">{preview.quiz.title}</p>
            {preview.quiz.description && (
              <p className="text-sm text-ink-muted truncate mt-0.5">
                {preview.quiz.description}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-sm">
              <dt className="text-ink-muted">Questions</dt>
              <dd className="tabular-nums font-medium text-right">
                {stats.questionCount}
              </dd>
              <dt className="text-ink-muted">Total points</dt>
              <dd className="tabular-nums font-medium text-right">
                {stats.totalPoints}
              </dd>
              <dt className="text-ink-muted">Total choices</dt>
              <dd className="tabular-nums font-medium text-right">
                {stats.totalChoices}
              </dd>
            </dl>
            <div className="flex flex-wrap gap-2 mt-3">
              {stats.byType.single > 0 && (
                <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface text-ink-muted border border-line">
                  Single × {stats.byType.single}
                </span>
              )}
              {stats.byType.multi > 0 && (
                <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface text-ink-muted border border-line">
                  Multi × {stats.byType.multi}
                </span>
              )}
              {stats.byType.binary > 0 && (
                <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface text-ink-muted border border-line">
                  Binary × {stats.byType.binary}
                </span>
              )}
            </div>
          </div>
        )}

        <details className="mt-4 rounded-lg border border-line bg-surface-muted group">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium hover:bg-surface-sunken rounded-lg select-none flex items-center justify-between">
            <span>Expected JSON format</span>
            <span className="text-ink-faint text-xs transition group-open:rotate-180">▾</span>
          </summary>
          <div className="px-4 pb-4 pt-1 text-sm space-y-3">
            <p className="text-ink-muted">
              The file must match this shape:
            </p>
            <pre className="text-xs bg-surface border border-line rounded-md p-3 overflow-x-auto font-mono leading-relaxed">
{FORMAT_EXAMPLE}
            </pre>
            <p className="text-xs text-ink-faint">
              Tip: use the <strong className="text-ink-muted">Export</strong> button on any existing quiz to get a valid template.
            </p>
          </div>
        </details>

        {submitError && (
          <div className="mt-4 text-sm text-danger bg-danger-soft border border-danger/20 rounded-md p-3">
            {submitError}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className={buttonClass("secondary", "md")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={preview.kind !== "valid" || importing}
            className={buttonClass("danger", "md")}
          >
            {importing ? "Importing…" : "Replace quiz"}
          </button>
        </div>
      </div>
    </div>
  );
}
