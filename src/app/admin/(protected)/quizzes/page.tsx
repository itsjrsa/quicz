import Link from "next/link";
import { db } from "@/db";
import { quizzes, questions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

async function getQuizzesWithCounts() {
  const allQuizzes = db.select().from(quizzes).orderBy(desc(quizzes.createdAt)).all();
  return allQuizzes.map((quiz) => ({
    ...quiz,
    questionCount: db.select().from(questions).where(eq(questions.quizId, quiz.id)).all().length,
  }));
}

function formatRelative(input: Date | number | null | undefined): string {
  if (input == null) return "";
  const d = typeof input === "number" ? new Date(input) : input;
  const ms = Date.now() - d.getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default async function QuizzesPage() {
  const allQuizzes = await getQuizzesWithCounts();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {allQuizzes.length} quiz{allQuizzes.length !== 1 ? "zes" : ""}
          </p>
        </div>
        <Link
          href="/admin/quizzes/new"
          className={buttonClass("primary", "md")}
        >
          + New Quiz
        </Link>
      </div>

      {allQuizzes.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-line rounded-xl bg-surface-muted">
          <p className="text-lg font-medium text-ink">No quizzes yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Create your first quiz to get started.
          </p>
          <Link
            href="/admin/quizzes/new"
            className={buttonClass("primary", "md", "mt-5")}
          >
            + New Quiz
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line border border-line rounded-xl overflow-hidden bg-surface">
          {allQuizzes.map((quiz) => {
            const updated = formatRelative(quiz.updatedAt ?? quiz.createdAt);
            return (
              <li
                key={quiz.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-surface-muted transition-colors"
              >
                <div className="min-w-0 flex-1 mr-4">
                  <Link
                    href={`/admin/quizzes/${quiz.id}/edit`}
                    className="font-medium text-ink hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded"
                  >
                    {quiz.title}
                  </Link>
                  <p className="text-sm text-ink-muted mt-1 truncate">
                    <span>
                      {quiz.questionCount} question{quiz.questionCount !== 1 ? "s" : ""}
                    </span>
                    {updated && (
                      <>
                        <span className="text-ink-faint"> · </span>
                        <span>updated {updated}</span>
                      </>
                    )}
                    {quiz.description && (
                      <>
                        <span className="text-ink-faint"> · </span>
                        <span>{quiz.description}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-3 text-sm shrink-0">
                  <Link
                    href={`/admin/quizzes/${quiz.id}/edit`}
                    className="text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded px-1"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/admin/quizzes/${quiz.id}/sessions`}
                    className="text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded px-1"
                  >
                    Sessions
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
