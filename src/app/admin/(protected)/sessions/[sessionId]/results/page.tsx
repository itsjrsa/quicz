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

  // Compute scoreboard
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
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link href={`/admin/quizzes/${session.quizId}/sessions`} className="text-sm text-gray-500 hover:text-black">
            ← Sessions
          </Link>
          <h1 className="text-3xl font-bold mt-2">{quiz?.title ?? "Session Results"}</h1>
          <p className="text-gray-500 mt-1">
            Code: <span className="font-mono font-bold">{session.code}</span>
            {" · "}
            {sessionParticipants.length} participant{sessionParticipants.length !== 1 ? "s" : ""}
            {" · "}
            {session.status === "finished" ? "Finished" : "Active"}
          </p>
        </div>
        <a
          href={`/api/sessions/${sessionId}/export`}
          className="px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50"
        >
          Export CSV
        </a>
      </div>

      {/* Scoreboard */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-4">Scoreboard</h2>
        {scoreboard.length === 0 ? (
          <p className="text-gray-400">No participants.</p>
        ) : (
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-10">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Score</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Correct</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {scoreboard.map((p, i) => (
                  <tr key={p.participantId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 font-mono">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{p.displayName}</td>
                    <td className="px-4 py-3 text-right font-bold">{p.score}</td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {p.correctCount}/{quizQuestions.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Per-question breakdown */}
      <section>
        <h2 className="text-xl font-bold mb-6">Question Breakdown</h2>
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
              <div key={q.id} className="border border-gray-100 rounded-lg p-5">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Q{qi + 1} · {q.type}</p>
                  <p className="text-xs text-gray-400">
                    {correctResponses}/{totalResponses} correct
                  </p>
                </div>
                <h3 className="font-semibold text-lg mb-4">{q.title}</h3>
                {totalResponses > 0 ? (
                  <ResponseChart data={chartData} totalResponses={totalResponses} />
                ) : (
                  <p className="text-gray-400 text-sm">No responses</p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
