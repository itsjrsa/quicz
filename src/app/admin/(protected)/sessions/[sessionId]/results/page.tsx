import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  liveSessions,
  quizzes,
  questions,
  choices,
  participants,
  responses,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import ResponseChart from "@/components/charts/ResponseChart";
import { buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sessionId: string }> };

export default async function ResultsPage({ params }: Params) {
  const { sessionId } = await params;

  const session = db.select().from(liveSessions).where(eq(liveSessions.id, sessionId)).get();
  if (!session) notFound();

  const quiz = db.select().from(quizzes).where(eq(quizzes.id, session.quizId)).get();

  const quizQuestions = db
    .select()
    .from(questions)
    .where(eq(questions.quizId, session.quizId))
    .orderBy(questions.order)
    .all();

  const questionIds = quizQuestions.map((q) => q.id);

  const allChoices =
    questionIds.length > 0
      ? db.select().from(choices).where(inArray(choices.questionId, questionIds)).orderBy(choices.order).all()
      : [];

  const sessionParticipants = db
    .select()
    .from(participants)
    .where(eq(participants.sessionId, sessionId))
    .all();

  const sessionResponses =
    sessionParticipants.length > 0
      ? db.select().from(responses).where(eq(responses.sessionId, sessionId)).all()
      : [];

  const scoreMap = new Map<string, { score: number; correctCount: number }>();
  for (const p of sessionParticipants) {
    scoreMap.set(p.id, { score: 0, correctCount: 0 });
  }
  for (const r of sessionResponses) {
    const entry = scoreMap.get(r.participantId);
    if (entry) {
      entry.score += r.pointsEarned ?? 0;
      entry.correctCount += r.isCorrect === 1 ? 1 : 0;
    }
  }

  const participantMap = new Map(sessionParticipants.map((p) => [p.id, p]));
  const scoreboard = Array.from(scoreMap.entries())
    .map(([participantId, { score, correctCount }]) => ({
      participantId,
      displayName: participantMap.get(participantId)?.displayName ?? "",
      score,
      correctCount,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return a.displayName.localeCompare(b.displayName);
    });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/quizzes/${session.quizId}/sessions`}
            className="text-sm text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded px-1"
          >
            ← Sessions
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mt-2">
            {quiz?.title ?? "Session results"}
          </h1>
          <p className="text-ink-muted mt-1 text-sm">
            <span>
              Code{" "}
              <span className="font-mono font-bold text-ink">{session.code}</span>
            </span>
            <span className="text-ink-faint"> · </span>
            <span>
              {sessionParticipants.length} participant
              {sessionParticipants.length !== 1 ? "s" : ""}
            </span>
            <span className="text-ink-faint"> · </span>
            <span className="capitalize">{session.status}</span>
          </p>
        </div>
        <a
          href={`/api/sessions/${sessionId}/export`}
          className={buttonClass("primary", "md")}
        >
          <svg
            viewBox="0 0 16 16"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M8 2v8" />
            <polyline points="5,7 8,10 11,7" />
            <path d="M3 12v2h10v-2" />
          </svg>
          Export CSV
        </a>
      </div>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-4 tracking-tight">Scoreboard</h2>
        {scoreboard.length === 0 ? (
          <p className="text-ink-faint">No participants.</p>
        ) : (
          <div className="border border-line rounded-xl overflow-hidden bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted border-b border-line">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-ink-muted w-10">#</th>
                  <th className="px-4 py-3 text-left font-medium text-ink-muted">Name</th>
                  <th className="px-4 py-3 text-right font-medium text-ink-muted">Score</th>
                  <th className="px-4 py-3 text-right font-medium text-ink-muted">Correct</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {scoreboard.map((p, i) => (
                  <tr key={p.participantId} className="hover:bg-surface-muted transition-colors">
                    <td className="px-4 py-3 text-ink-faint font-mono tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{p.displayName}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{p.score}</td>
                    <td className="px-4 py-3 text-right text-ink-muted tabular-nums">
                      {p.correctCount}/{quizQuestions.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold mb-6 tracking-tight">Question breakdown</h2>
        <div className="space-y-8">
          {quizQuestions.map((q, qi) => {
            const questionChoices = allChoices.filter((c) => c.questionId === q.id);
            const questionResponses = sessionResponses.filter((r) => r.questionId === q.id);
            const totalResponses = questionResponses.length;

            const chartData = questionChoices.map((c) => {
              const count = questionResponses.filter((r) => {
                try {
                  return (JSON.parse(r.choiceIds) as string[]).includes(c.id);
                } catch {
                  return false;
                }
              }).length;
              return { text: c.text, count, isCorrect: c.isCorrect === 1 };
            });

            const correctResponses = questionResponses.filter((r) => r.isCorrect === 1).length;

            return (
              <div key={q.id} className="border border-line rounded-xl p-5 bg-surface">
                <div className="flex items-start justify-between mb-1 gap-4">
                  <p className="text-xs text-ink-faint uppercase tracking-wider font-mono">
                    Q{qi + 1} · {q.type}
                  </p>
                  <p className="text-xs text-ink-muted tabular-nums">
                    {correctResponses}/{totalResponses} correct
                  </p>
                </div>
                <h3 className="font-semibold text-lg mb-4 tracking-tight">{q.title}</h3>
                {totalResponses > 0 ? (
                  <ResponseChart data={chartData} totalResponses={totalResponses} />
                ) : (
                  <p className="text-ink-faint text-sm">No responses</p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
