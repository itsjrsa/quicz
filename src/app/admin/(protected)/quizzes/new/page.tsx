"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, Input } from "@/components/ui";

export default function NewQuizPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
    });

    if (res.ok) {
      const quiz = (await res.json()) as { id: string };
      router.push(`/admin/quizzes/${quiz.id}/edit`);
    } else {
      setError("Failed to create quiz.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-2">New quiz</h1>
      <p className="text-sm text-ink-muted mb-8">
        Give it a title — you can add questions next.
      </p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="quiz-title" className="block text-sm font-medium text-ink mb-2">
            Title <span className="text-ink-faint">*</span>
          </label>
          <Input
            id="quiz-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Safety Training Quiz"
            required
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="quiz-description" className="block text-sm font-medium text-ink mb-2">
            Description
          </label>
          <textarea
            id="quiz-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface placeholder:text-ink-faint focus-visible:outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/10"
            rows={3}
            placeholder="Optional description"
          />
        </div>
        {error && (
          <p className="text-sm text-danger" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className={buttonClass("primary", "md")}
          >
            {loading ? "Creating…" : "Create & edit"}
          </button>
          <Link
            href="/admin/quizzes"
            className="text-sm text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded px-2 py-1"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
