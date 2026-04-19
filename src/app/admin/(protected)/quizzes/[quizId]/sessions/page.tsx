import { db } from "@/db";
import { liveSessions, quizzes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ quizId: string }> };

export default async function QuizSessionsPage({ params }: Params) {
  const { quizId } = await params;

  const quiz = db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) notFound();

  const sessions = db
    .select()
    .from(liveSessions)
    .where(eq(liveSessions.quizId, quizId))
    .orderBy(desc(liveSessions.createdAt))
    .all();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <Link
          href="/admin/quizzes"
          className="text-sm text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded px-1"
        >
          ← Quizzes
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-2">
          {quiz.title}
          <span className="text-ink-faint font-normal"> · </span>
          <span className="font-normal text-ink-muted">Sessions</span>
        </h1>
      </div>

      {sessions.length === 0 ? (
        <p className="text-ink-faint">No sessions yet.</p>
      ) : (
        <ul className="divide-y divide-line border border-line rounded-xl overflow-hidden bg-surface">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between px-5 py-4 hover:bg-surface-muted transition-colors"
            >
              <div>
                <span className="font-mono font-bold text-lg tracking-wider">{s.code}</span>
                <p className="text-sm text-ink-muted mt-0.5">
                  {s.status === "active" ? (
                    <span className="text-success font-medium">Active</span>
                  ) : (
                    <span className="text-ink-faint">Finished</span>
                  )}
                  <span className="text-ink-faint"> · </span>
                  {new Date(s.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                {s.status === "active" && (
                  <Link
                    href={`/admin/sessions/${s.id}/present`}
                    className="text-ink font-medium hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded px-1"
                  >
                    Present
                  </Link>
                )}
                <Link
                  href={`/admin/sessions/${s.id}/results`}
                  className="text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded px-1"
                >
                  Results
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
